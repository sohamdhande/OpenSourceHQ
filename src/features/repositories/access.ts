import prisma from "@/lib/db";
import { SessionUser } from "@/server/auth/session";

export async function getActiveOrganizationMembership(user: SessionUser, organizationId: string) {
  if (user.isPlatformSuperAdmin) return null;
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  if (!membership || membership.status !== "ACTIVE") return null;
  return membership;
}

export async function canMentorAccessMentee(mentorId: string, menteeId: string, organizationId: string): Promise<boolean> {
  const sharedAssignedCohort = await prisma.cohort.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      mentors: { some: { mentorId } },
      enrollments: { some: { menteeId, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  return Boolean(sharedAssignedCohort);
}

export async function canManageMemberRepositories(
  actor: SessionUser,
  organizationId: string,
  targetUserId: string
): Promise<boolean> {
  if (actor.isPlatformSuperAdmin) return true;
  const [actorMembership, targetMembership] = await Promise.all([
    prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: actor.id } } }),
    prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: targetUserId } } }),
  ]);
  if (actorMembership?.status !== "ACTIVE" || targetMembership?.status !== "ACTIVE") return false;
  if (actor.id === targetUserId) {
    return (
      actorMembership.role === "MENTEE" ||
      actorMembership.role === "MENTOR" ||
      (actorMembership.role === "ORG_ADMIN" && actorMembership.selfTrackingEnabled)
    );
  }
  if (actorMembership.role === "ORG_ADMIN") return targetMembership.role === "MENTEE";
  if (actorMembership.role === "MENTOR" && targetMembership.role === "MENTEE") {
    return canMentorAccessMentee(actor.id, targetUserId, organizationId);
  }
  return false;
}
