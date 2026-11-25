import prisma from "@/lib/db";
import { MilestoneStatus } from "@prisma/client";
import { SessionUser } from "@/server/auth/session";
import { logAudit } from "@/lib/audit";

export async function submitMilestoneEvidence(user: SessionUser, milestoneId: string, notes: string, evidenceUrl?: string | null) {
  const milestone = await prisma.learningMilestone.findUnique({ where: { id: milestoneId }, include: { learningPath: true } });
  if (!milestone) throw new Error("Learning milestone not found.");
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: milestone.learningPath.organizationId, userId: user.id } } });
  if (membership?.status !== "ACTIVE" || membership.role !== "MENTEE") throw new Error("Only active mentees in this organization can submit milestone evidence.");
  if (milestone.learningPath.cohortId) {
    const [enrollment, cohort] = await Promise.all([
      prisma.cohortEnrollment.findUnique({ where: { cohortId_menteeId: { cohortId: milestone.learningPath.cohortId, menteeId: user.id } } }),
      prisma.cohort.findUnique({ where: { id: milestone.learningPath.cohortId }, select: { status: true } }),
    ]);
    if (enrollment?.status !== "ACTIVE" || cohort?.status !== "ACTIVE") throw new Error("You are not actively enrolled in the cohort assigned to this learning path.");
  }
  if (notes.trim().length < 3) throw new Error("Describe your evidence in at least three characters.");
  const existing = await prisma.menteeMilestone.findUnique({ where: { menteeId_milestoneId: { menteeId: user.id, milestoneId } } });
  const editableStatuses: MilestoneStatus[] = [MilestoneStatus.NOT_STARTED, MilestoneStatus.IN_PROGRESS, MilestoneStatus.CHANGES_REQUESTED];
  if (existing && !editableStatuses.includes(existing.status)) {
    throw new Error("This milestone is already submitted or approved. Wait for mentor feedback before submitting again.");
  }
  const nextStatus = existing?.status === MilestoneStatus.CHANGES_REQUESTED ? MilestoneStatus.RESUBMITTED : MilestoneStatus.SUBMITTED;
  const result = await prisma.$transaction(async (tx) => {
    if (!existing) {
      return tx.menteeMilestone.create({ data: { menteeId: user.id, milestoneId, status: nextStatus, notes: notes.trim(), evidenceUrl: evidenceUrl || null } });
    }
    const updated = await tx.menteeMilestone.updateMany({
      where: { id: existing.id, status: { in: editableStatuses } },
      data: { status: nextStatus, notes: notes.trim(), evidenceUrl: evidenceUrl || null, reviewedById: null, reviewedAt: null, reviewComment: null },
    });
    if (updated.count !== 1) throw new Error("Milestone state changed. Refresh and try again.");
    return tx.menteeMilestone.findUniqueOrThrow({ where: { id: existing.id } });
  });

  const organizationId = milestone.learningPath.organizationId;
  const [mentorRows, adminRows] = await Promise.all([
    prisma.cohortMentor.findMany({
      where: {
        ...(milestone.learningPath.cohortId ? { cohortId: milestone.learningPath.cohortId } : {}),
        cohort: {
          organizationId,
          status: "ACTIVE",
          enrollments: { some: { menteeId: user.id, status: "ACTIVE" } },
        },
        mentor: { memberships: { some: { organizationId, role: { in: ["MENTOR", "ORG_ADMIN"] }, status: "ACTIVE" } } },
      },
      select: { mentorId: true },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId, role: "ORG_ADMIN", status: "ACTIVE" },
      select: { userId: true },
    }),
  ]);
  const recipients = [...new Set([...mentorRows.map((row) => row.mentorId), ...adminRows.map((row) => row.userId)])]
    .filter((id) => id !== user.id);
  if (recipients.length) {
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
    await prisma.notification.createMany({ data: recipients.map((userId) => ({
      organizationId, userId, type: "MILESTONE_SUBMITTED", title: "Learning milestone submitted",
      body: `${user.name} submitted evidence for “${milestone.title}”.`, targetUrl: `/org/${organization?.slug || organizationId}/mentor/reviews`,
    })) });
  }
  await logAudit({ organizationId: milestone.learningPath.organizationId, actorId: user.id, action: nextStatus === MilestoneStatus.RESUBMITTED ? "MILESTONE_RESUBMITTED" : "MILESTONE_SUBMITTED", targetType: "MenteeMilestone", targetId: result.id, metadata: { milestoneId } });
  return result;
}

export async function reviewMenteeMilestone(user: SessionUser, menteeId: string, milestoneId: string, status: MilestoneStatus, comment?: string | null) {
  if (status !== MilestoneStatus.APPROVED && status !== MilestoneStatus.CHANGES_REQUESTED) throw new Error("Invalid milestone review decision.");
  if (status === MilestoneStatus.CHANGES_REQUESTED && (comment?.trim().length ?? 0) < 3) throw new Error("Add a mentor comment explaining the requested changes.");
  const existing = await prisma.menteeMilestone.findUnique({
    where: { menteeId_milestoneId: { menteeId, milestoneId } },
    include: { milestone: { include: { learningPath: true } } },
  });
  if (!existing) throw new Error("Mentee milestone submission not found.");
  const organizationId = existing.milestone.learningPath.organizationId;
  const [actorMembership, targetMembership] = await Promise.all([
    prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } }),
    prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: menteeId } } }),
  ]);
  if (targetMembership?.status !== "ACTIVE" || targetMembership.role !== "MENTEE") throw new Error("The target must be an active mentee in this organization.");
  if (!user.isPlatformSuperAdmin && actorMembership?.status !== "ACTIVE") throw new Error("Active organization membership is required.");
  if (!user.isPlatformSuperAdmin && actorMembership?.role !== "ORG_ADMIN" && actorMembership?.role !== "MENTOR") throw new Error("Only administrators and mentors can review milestones.");
  if (actorMembership?.role === "MENTOR") {
    const assigned = await prisma.cohort.findFirst({ where: {
      organizationId,
      status: "ACTIVE",
      ...(existing.milestone.learningPath.cohortId ? { id: existing.milestone.learningPath.cohortId } : {}),
      mentors: { some: { mentorId: user.id } },
      enrollments: { some: { menteeId, status: "ACTIVE" } },
    }, select: { id: true } });
    if (!assigned) throw new Error("You can review milestones only for mentees in your assigned cohorts.");
  }
  const eligible = [MilestoneStatus.SUBMITTED, MilestoneStatus.RESUBMITTED];
  const result = await prisma.$transaction(async (tx) => {
    const guarded = await tx.menteeMilestone.updateMany({
      where: { id: existing.id, status: { in: eligible } },
      data: { status, reviewedById: user.id, reviewedAt: new Date(), reviewComment: comment?.trim() || null },
    });
    if (guarded.count !== 1) throw new Error("This milestone has already been reviewed. Refresh to see the latest status.");
    return tx.menteeMilestone.findUniqueOrThrow({ where: { id: existing.id } });
  });
  await logAudit({ organizationId, actorId: user.id, action: "MILESTONE_REVIEWED", targetType: "MenteeMilestone", targetId: result.id, metadata: { status } });
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
  await prisma.notification.create({ data: {
    organizationId, userId: menteeId, type: "MILESTONE_REVIEWED", title: status === MilestoneStatus.APPROVED ? "Milestone approved" : "Changes requested on milestone",
    body: status === MilestoneStatus.APPROVED ? `${user.name} approved your learning milestone.` : `${user.name} requested changes: “${comment?.trim().slice(0, 100)}”`,
    targetUrl: `/org/${organization?.slug || organizationId}/student/learning`,
  } });
  return result;
}
