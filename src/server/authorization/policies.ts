import prisma from "@/lib/db";
import { OrgRole, PlatformRoleType } from "@prisma/client";
import { SessionUser } from "@/server/auth/session";

/**
 * Centralized authorization policies for OpenSourceHQ
 * Never trust client-provided IDs or roles without verification
 */

export async function isPlatformSuperAdmin(user: SessionUser | null): Promise<boolean> {
  if (!user) return false;
  if (user.isPlatformSuperAdmin) return true;
  const platformRole = await prisma.platformRole.findUnique({
    where: { userId: user.id },
  });
  return platformRole?.role === PlatformRoleType.SUPER_ADMIN;
}

export async function getUserOrgMembership(userId: string, organizationId: string) {
  return prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      organization: true,
    },
  });
}

export async function canManageOrganization(user: SessionUser | null, organizationId: string): Promise<boolean> {
  if (!user) return false;
  if (await isPlatformSuperAdmin(user)) return true;

  const membership = await getUserOrgMembership(user.id, organizationId);
  return membership?.status === "ACTIVE" && membership.role === OrgRole.ORG_ADMIN;
}

export async function canManageCohort(user: SessionUser | null, cohortId: string): Promise<boolean> {
  if (!user) return false;
  if (await isPlatformSuperAdmin(user)) return true;

  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId, status: "ACTIVE" },
    include: { mentors: true },
  });
  if (!cohort) return false;

  const membership = await getUserOrgMembership(user.id, cohort.organizationId);
  if (membership?.status === "ACTIVE" && membership.role === OrgRole.ORG_ADMIN) {
    return true;
  }

  // Mentor assigned to cohort
  if (membership?.status === "ACTIVE" && membership.role === OrgRole.MENTOR) {
    return cohort.mentors.some((m) => m.mentorId === user.id);
  }

  return false;
}

export async function canViewMentee(
  user: SessionUser | null,
  menteeUserId: string,
  organizationId: string
): Promise<boolean> {
  if (!user) return false;
  if (await isPlatformSuperAdmin(user)) return true;

  const [viewerMembership, targetMembership] = await Promise.all([
    getUserOrgMembership(user.id, organizationId),
    getUserOrgMembership(menteeUserId, organizationId),
  ]);
  if (!viewerMembership || viewerMembership.status !== "ACTIVE") return false;
  if (user.id === menteeUserId) return true;
  if (!targetMembership || targetMembership.status !== "ACTIVE" || targetMembership.role !== OrgRole.MENTEE) return false;

  if (viewerMembership.role === OrgRole.ORG_ADMIN) return true;
  if (viewerMembership.role !== OrgRole.MENTOR && viewerMembership.role !== OrgRole.MENTEE) return false;

  const sharedCohort = await prisma.cohort.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      ...(viewerMembership.role === OrgRole.MENTOR ? { mentors: { some: { mentorId: user.id } } } : { enrollments: { some: { menteeId: user.id, status: "ACTIVE" } } }),
      enrollments: { some: { menteeId: menteeUserId, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  return Boolean(sharedCohort);
}

export async function canViewReport(user: SessionUser | null, reportId: string): Promise<boolean> {
  if (!user) return false;
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: {
      cohort: {
        include: {
          mentors: true,
          enrollments: true,
        },
      },
    },
  });
  if (!report) return false;

  if (await isPlatformSuperAdmin(user)) return true;
  // Draft reports are private to their author until they submit them.
  if (report.status === "DRAFT" && report.menteeId !== user.id) return false;

  const [membership, targetMembership] = await Promise.all([
    getUserOrgMembership(user.id, report.organizationId),
    getUserOrgMembership(report.menteeId, report.organizationId),
  ]);
  if (!membership || membership.status !== "ACTIVE") return false;
  if (report.menteeId === user.id) return true;
  if (!targetMembership || targetMembership.status !== "ACTIVE" || targetMembership.role !== OrgRole.MENTEE) return false;
  if (report.cohort.status !== "ACTIVE") return false;

  if (membership.role === OrgRole.ORG_ADMIN) return true;

  const reportOwnerIsActivelyEnrolled = report.cohort.enrollments.some(
    (enrollment) => enrollment.menteeId === report.menteeId && enrollment.status === "ACTIVE"
  );
  if (!reportOwnerIsActivelyEnrolled) return false;

  if (membership.role === OrgRole.MENTOR) {
    return report.cohort.mentors.some((m) => m.mentorId === user.id);
  }

  if (membership.role === OrgRole.MENTEE && report.visibility === "COHORT" && report.status !== "DRAFT") {
    return report.cohort.enrollments.some((e) => e.menteeId === user.id && e.status === "ACTIVE");
  }

  return false;
}

export async function canReviewReport(user: SessionUser | null, reportId: string): Promise<boolean> {
  if (!user) return false;
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: {
      cohort: {
        include: { mentors: true, enrollments: true },
      },
    },
  });
  if (!report) return false;
  if (report.menteeId === user.id) return false; // Mentee cannot review own report

  if (await isPlatformSuperAdmin(user)) return true;

  const [membership, targetMembership] = await Promise.all([
    getUserOrgMembership(user.id, report.organizationId),
    getUserOrgMembership(report.menteeId, report.organizationId),
  ]);
  if (!membership || membership.status !== "ACTIVE" || !targetMembership || targetMembership.status !== "ACTIVE" || targetMembership.role !== OrgRole.MENTEE) return false;
  if (report.cohort.status !== "ACTIVE") return false;

  if (membership.role === OrgRole.ORG_ADMIN) return true;

  const reportOwnerIsActivelyEnrolled = report.cohort.enrollments.some(
    (enrollment) => enrollment.menteeId === report.menteeId && enrollment.status === "ACTIVE"
  );
  if (!reportOwnerIsActivelyEnrolled) return false;

  if (membership.role === OrgRole.MENTOR) {
    return report.cohort.mentors.some((m) => m.mentorId === user.id);
  }

  return false;
}

export async function canManageTask(user: SessionUser | null, taskId: string, assigneeId?: string): Promise<boolean> {
  if (!user) return false;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      cohort: { include: { mentors: true } },
      assignments: { select: { menteeId: true } },
    },
  });
  if (!task) return false;
  if (await isPlatformSuperAdmin(user)) return true;

  const membership = await getUserOrgMembership(user.id, task.organizationId);
  if (!membership || membership.status !== "ACTIVE") return false;
  if (membership.role === OrgRole.ORG_ADMIN) return true;
  if (membership.role !== OrgRole.MENTOR || !assigneeId) return false;
  if (!task.assignments.some((assignment) => assignment.menteeId === assigneeId)) return false;

  const activeMenteeMembership = await getUserOrgMembership(assigneeId, task.organizationId);
  if (activeMenteeMembership?.status !== "ACTIVE" || activeMenteeMembership.role !== OrgRole.MENTEE) return false;

  if (task.cohortId) {
    if (task.cohort?.status !== "ACTIVE" || !task.cohort.mentors.some((mentor) => mentor.mentorId === user.id)) return false;
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: { cohortId: task.cohortId, menteeId: assigneeId, status: "ACTIVE" },
      select: { id: true },
    });
    return Boolean(enrollment);
  }

  // Organization-wide assignments are reviewable only by a mentor who
  // actively supervises the specific assigned mentee in an active cohort.
  const sharedActiveCohort = await prisma.cohort.findFirst({
    where: {
      organizationId: task.organizationId,
      status: "ACTIVE",
      mentors: { some: { mentorId: user.id } },
      enrollments: { some: { menteeId: assigneeId, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  return Boolean(sharedActiveCohort);
}

export async function canManageRepository(user: SessionUser | null, repositoryId: string): Promise<boolean> {
  if (!user) return false;
  const repo = await prisma.repository.findUnique({
    where: { id: repositoryId },
  });
  if (!repo) return false;

  return canManageOrganization(user, repo.organizationId);
}

