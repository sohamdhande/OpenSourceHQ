import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";

/**
 * Return the signed-in user's session. When orgSlug is supplied, resolve the
 * session's active organization for that route after checking current membership.
 * This avoids relying on a stale cookie-selected organization when a member opens
 * a deep link into another organization they legitimately belong to.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200, headers: { "Cache-Control": "private, no-store" } });

  const orgSlug = request.nextUrl.searchParams.get("orgSlug");
  if (!orgSlug) return NextResponse.json({ user: session }, { headers: { "Cache-Control": "private, no-store" } });

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, slug: true, name: true, timezone: true },
  });
  if (!organization) return NextResponse.json({ user: null, error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." } }, { status: 404, headers: { "Cache-Control": "private, no-store" } });

  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: organization.id, userId: session.id } },
    select: { role: true, status: true },
  });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") {
    return NextResponse.json({ user: null, error: { code: "FORBIDDEN", message: "You do not have active access to this organization." } }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  return NextResponse.json({
    user: {
      ...session,
      activeOrgId: organization.id,
      activeOrgSlug: organization.slug,
      activeOrgName: organization.name,
      activeOrgTimezone: organization.timezone,
      activeOrgRole: membership?.role ?? (session.isPlatformSuperAdmin ? "ORG_ADMIN" : undefined),
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
