import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { canAccessSelfTrackingSetup } from "@/server/authorization/policies";
import { logAudit } from "@/lib/audit";

export async function POST(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const allowed = await canAccessSelfTrackingSetup(session, params.orgId);
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only active organization admins and mentors can manage self-tracking." } },
      { status: 403 }
    );
  }

  const existing = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: params.orgId, userId: session.id } },
    select: { id: true, selfTrackingEnabled: true },
  });
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Membership not found" } }, { status: 404 });
  }

  const updated = await prisma.organizationMembership.update({
    where: { id: existing.id },
    data: { selfTrackingEnabled: false },
    select: { selfTrackingEnabled: true },
  });

  if (existing.selfTrackingEnabled) {
    await logAudit({
      organizationId: params.orgId,
      actorId: session.id,
      action: "SELF_TRACKING_DISABLED",
      targetType: "OrganizationMembership",
      targetId: existing.id,
    });
  }

  return NextResponse.json({
    success: true,
    selfTrackingEnabled: updated.selfTrackingEnabled,
  });
}

