import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { canManageOrganization } from "@/server/authorization/policies";
import { generateGoogleOAuthUrl } from "@/features/integrations/gmail-service";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login?error=auth_required", req.url));
  }

  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get("orgSlug");
  const orgId = searchParams.get("orgId");

  if (!orgSlug && !orgId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "orgSlug or orgId query parameter is required." } },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findFirst({
    where: orgId ? { id: orgId } : { slug: orgSlug! },
    select: { id: true, slug: true },
  });

  if (!org) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Organization not found." } },
      { status: 404 }
    );
  }

  // Security check: Must be an authenticated admin of this organization
  const isAllowed = await canManageOrganization(session, org.id);
  if (!isAllowed) {
    return NextResponse.redirect(
      new URL(`/org/${org.slug}/admin?error=unauthorized_admin_required`, req.url)
    );
  }

  try {
    const { url } = generateGoogleOAuthUrl({
      orgId: org.id,
      userId: session.id,
    });

    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initiate Google OAuth";
    return NextResponse.redirect(
      new URL(`/org/${org.slug}/admin/integrations/gmail?status=error&message=${encodeURIComponent(message)}`, req.url)
    );
  }
}

