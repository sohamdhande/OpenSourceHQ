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
      { error: { code: "FORBIDDEN", message: "Only active organization admins and mentors can enable self-tracking." } },
      { status: 403 }
    );
  }

  const existing = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: params.orgId, userId: session.id } },
    select: { id: true, selfTrackingEnabled: true, selfTrackingEnabledAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Membership not found" } }, { status: 404 });
  }

  const enabledAt = existing.selfTrackingEnabledAt ?? new Date();
  const updated = await prisma.organizationMembership.update({
    where: { id: existing.id },
    data: {
      selfTrackingEnabled: true,
      selfTrackingEnabledAt: enabledAt,
    },
    select: { selfTrackingEnabled: true, selfTrackingEnabledAt: true },
  });

  if (!existing.selfTrackingEnabled) {
    await logAudit({
      organizationId: params.orgId,
      actorId: session.id,
      action: "SELF_TRACKING_ENABLED",
      targetType: "OrganizationMembership",
      targetId: existing.id,
    });
  }

  return NextResponse.json({
    success: true,
    selfTrackingEnabled: updated.selfTrackingEnabled,
    selfTrackingEnabledAt: updated.selfTrackingEnabledAt?.toISOString() ?? null,
  });
}

