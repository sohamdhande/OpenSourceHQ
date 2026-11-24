import prisma from "@/lib/db";
import crypto from "crypto";
import { OrgRole } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { SessionUser } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";

export async function inviteOrganizationMember(
  user: SessionUser,
  organizationId: string,
  email: string,
  role: OrgRole,
  cohortId?: string | null
) {
  const allowed = await canManageOrganization(user, organizationId);
  if (!allowed) throw new Error("Unauthorized to invite members");

  const normalizedEmail = email.toLowerCase().trim();
  const existingMember = await prisma.organizationMembership.findFirst({ where: { organizationId, status: "ACTIVE", user: { email: normalizedEmail } } });
  if (existingMember) throw new Error("This person is already an active member of the organization.");
  if (cohortId) {
    if (role !== OrgRole.MENTEE && role !== OrgRole.MENTOR) throw new Error("Only mentee or mentor invitations can include a cohort assignment.");
    const cohort = await prisma.cohort.findFirst({ where: { id: cohortId, organizationId, status: "ACTIVE" }, select: { id: true } });
    if (!cohort) throw new Error("Selected cohort must be active and belong to this organization.");
  }
  const pending = await prisma.invitation.findFirst({ where: { organizationId, email: normalizedEmail, acceptedAt: null, expiresAt: { gt: new Date() } } });
  if (pending) throw new Error("A valid invitation for this email already exists.");
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      organizationId,
      email: normalizedEmail,
      role,
      cohortId,
      token,
      invitedById: user.id,
      expiresAt,
    },
  });

  await logAudit({
    organizationId,
    actorId: user.id,
    action: "MEMBER_INVITED",
    targetType: "Invitation",
    targetId: invitation.id,
    metadata: { email, role, cohortId },
  });

  return invitation;
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { token }, include: { organization: true } });
  if (!invitation) throw new Error("Invalid or expired invitation token.");
  if (invitation.acceptedAt) throw new Error("Invitation has already been accepted.");
  if (invitation.expiresAt <= new Date()) throw new Error("Invitation has expired.");
  if (invitation.organization.archivedAt) throw new Error("This organization is no longer accepting invitations.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
  if (!user || user.status !== "ACTIVE") throw new Error("Active user account required.");
  if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) throw new Error("This invitation was sent to a different email address. Sign in with the invited account.");
  if (invitation.cohortId) {
    const cohort = await prisma.cohort.findFirst({ where: { id: invitation.cohortId, organizationId: invitation.organizationId, status: "ACTIVE" }, select: { id: true } });
    if (!cohort) throw new Error("Invitation cohort is not active in this organization.");
    if (invitation.role !== OrgRole.MENTEE && invitation.role !== OrgRole.MENTOR) throw new Error("Only mentee or mentor invitations may include a cohort assignment.");
  }

  const membership = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const current = await tx.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId } } });
    if (current?.status === "ACTIVE") throw new Error("You already have an active membership in this organization.");
    if (current && current.role !== invitation.role) {
      if (current.role === OrgRole.MENTEE) {
        await tx.cohortEnrollment.updateMany({ where: { menteeId: userId, status: "ACTIVE", cohort: { organizationId: invitation.organizationId } }, data: { status: "WITHDRAWN", endedAt: now } });
      } else if (current.role === OrgRole.MENTOR) {
        await tx.cohortMentor.deleteMany({ where: { mentorId: userId, cohort: { organizationId: invitation.organizationId } } });
      }
    }
    const accepted = await tx.invitation.updateMany({ where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now } }, data: { acceptedAt: now } });
    if (accepted.count !== 1) throw new Error("Invitation has already been accepted or has expired.");
    const nextMembership = await tx.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
      create: { organizationId: invitation.organizationId, userId, role: invitation.role, status: "ACTIVE", invitedById: invitation.invitedById, joinedAt: now },
      update: { role: invitation.role, status: "ACTIVE", invitedById: invitation.invitedById, joinedAt: now },
    });
    if (invitation.cohortId && invitation.role === OrgRole.MENTEE) {
      await tx.cohortEnrollment.upsert({
        where: { cohortId_menteeId: { cohortId: invitation.cohortId, menteeId: userId } },
        create: { cohortId: invitation.cohortId, menteeId: userId, status: "ACTIVE" },
        update: { status: "ACTIVE", endedAt: null },
      });
    } else if (invitation.cohortId && invitation.role === OrgRole.MENTOR) {
      await tx.cohortMentor.upsert({
        where: { cohortId_mentorId: { cohortId: invitation.cohortId, mentorId: userId } },
        create: { cohortId: invitation.cohortId, mentorId: userId },
        update: {},
      });
    }
    return nextMembership;
  });

  await logAudit({ organizationId: invitation.organizationId, actorId: userId, action: "INVITATION_ACCEPTED", targetType: "OrganizationMembership", targetId: membership.id, metadata: { role: invitation.role } });
  return membership;
}

export async function listOrganizationMembers(organizationId: string) {
  return prisma.organizationMembership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          status: true,
          githubAccounts: { select: { username: true, profileUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

