import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import prisma from "@/lib/db";
import { MemberRoleUpdateSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgId: string; membershipId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const allowed = await canManageOrganization(session, params.orgId);
  if (!allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = MemberRoleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    }
    if (parsed.data.role === undefined && parsed.data.status === undefined) {
      return NextResponse.json({ error: { code: "NO_CHANGES", message: "Choose a role or status change." } }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMembership.findUnique({
        where: { id: params.membershipId },
        include: { user: { select: { id: true, name: true, email: true, imageUrl: true, status: true, createdAt: true } } },
      });
      if (!membership || membership.organizationId !== params.orgId) {
        throw Object.assign(new Error("Membership not found."), { status: 404, code: "NOT_FOUND" });
      }

      if (membership.userId === session.id && (parsed.data.status === "REMOVED" || parsed.data.status === "SUSPENDED")) {
        throw Object.assign(new Error("You cannot remove or suspend your own organization membership."), { status: 400, code: "SELF_LOCKOUT" });
      }

      const nextRole = parsed.data.role ?? membership.role;
      const nextStatus = parsed.data.status ?? membership.status;
      if (nextRole !== membership.role) {
        if (membership.role === "MENTEE") {
          await tx.cohortEnrollment.updateMany({
            where: { menteeId: membership.userId, status: "ACTIVE", cohort: { organizationId: params.orgId } },
            data: { status: "WITHDRAWN", endedAt: new Date() },
          });
        } else if (membership.role === "MENTOR") {
          await tx.cohortMentor.deleteMany({ where: { mentorId: membership.userId, cohort: { organizationId: params.orgId } } });
        }
      }
      const removingAdminPrivileges = membership.status === "ACTIVE" && membership.role === "ORG_ADMIN" &&
        (nextRole !== "ORG_ADMIN" || nextStatus !== "ACTIVE");
      if (removingAdminPrivileges) {
        // Serializable isolation prevents two concurrent admin changes from removing the final administrator.
        const activeAdmins = await tx.organizationMembership.count({
          where: { organizationId: params.orgId, role: "ORG_ADMIN", status: "ACTIVE" },
        });
        if (activeAdmins <= 1) {
          throw Object.assign(new Error("An organization must retain at least one active administrator."), { status: 409, code: "LAST_ADMIN" });
        }
      }

      return tx.organizationMembership.update({
        where: { id: params.membershipId },
        data: { role: parsed.data.role, status: parsed.data.status },
        include: { user: { select: { id: true, name: true, email: true, imageUrl: true, status: true, createdAt: true } } },
      });
    }, { isolationLevel: "Serializable" });

    await logAudit({
      organizationId: params.orgId,
      actorId: session.id,
      action: "MEMBER_UPDATED",
      targetType: "OrganizationMembership",
      targetId: updated.id,
      metadata: { role: updated.role, status: updated.status, userEmail: updated.user.email },
    });

    return NextResponse.json({ success: true, membership: updated });
  } catch (err: unknown) {
    const error = err as Error & { status?: number; code?: string };
    const status = error.status || (error.code === "P2034" ? 409 : 400);
    return NextResponse.json({ error: { code: error.code || "UPDATE_FAILED", message: error.message || "Failed to update member" } }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { orgId: string; membershipId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const allowed = await canManageOrganization(session, params.orgId);
  if (!allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 });
  }

  try {
    const removed = await prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMembership.findUnique({
        where: { id: params.membershipId },
        select: { id: true, organizationId: true, userId: true, role: true, status: true },
      });
      if (!membership || membership.organizationId !== params.orgId) {
        throw Object.assign(new Error("Membership not found."), { status: 404, code: "NOT_FOUND" });
      }
      if (membership.userId === session.id) {
        throw Object.assign(new Error("You cannot remove your own organization membership."), { status: 400, code: "SELF_LOCKOUT" });
      }
      if (membership.status === "ACTIVE" && membership.role === "ORG_ADMIN") {
        const activeAdmins = await tx.organizationMembership.count({
          where: { organizationId: params.orgId, role: "ORG_ADMIN", status: "ACTIVE" },
        });
        if (activeAdmins <= 1) {
          throw Object.assign(new Error("An organization must retain at least one active administrator."), { status: 409, code: "LAST_ADMIN" });
        }
      }
      return tx.organizationMembership.update({ where: { id: membership.id }, data: { status: "REMOVED" } });
    }, { isolationLevel: "Serializable" });

    await logAudit({ organizationId: params.orgId, actorId: session.id, action: "MEMBER_REMOVED", targetType: "OrganizationMembership", targetId: removed.id, metadata: { userId: removed.userId } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error & { status?: number; code?: string };
    const status = error.status || (error.code === "P2034" ? 409 : 400);
    return NextResponse.json({ error: { code: error.code || "REMOVE_FAILED", message: error.message || "Failed to remove member" } }, { status });
  }
}
