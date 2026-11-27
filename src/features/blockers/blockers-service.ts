import prisma from "@/lib/db";
import { BlockerStatus, BlockerUrgency, BlockerSource } from "@prisma/client";
import { SessionUser } from "@/server/auth/session";
import { logAudit } from "@/lib/audit";
import { canUseSelfTracking } from "@/server/authorization/policies";

export interface CreateBlockerInput {
  organizationId: string;
  cohortId?: string | null;
  title: string;
  description: string;
  category?: string;
  urgency?: BlockerUrgency;
  source?: BlockerSource;
  sourceId?: string | null;
}

function sourceIdRequired(source: BlockerSource, sourceId?: string | null): sourceId is string {
  return Boolean(sourceId && source !== BlockerSource.GENERAL);
}

export async function createSelfTrackedBlocker(user: SessionUser, input: CreateBlockerInput) {
  if (!(await canUseSelfTracking(user, input.organizationId))) {
    throw new Error("Self-tracking must be enabled for your organization membership to log personal blockers.");
  }

  const blocker = await prisma.blocker.create({
    data: {
      organizationId: input.organizationId,
      cohortId: null,
      menteeId: user.id,
      mentorId: null,
      isSelfTracked: true,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category || "General",
      urgency: input.urgency || BlockerUrgency.MEDIUM,
      status: BlockerStatus.OPEN,
      source: BlockerSource.GENERAL,
    },
    include: {
      cohort: { select: { id: true, name: true } },
      mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
      mentor: { select: { id: true, name: true, email: true, imageUrl: true } },
    },
  });

  await logAudit({
    organizationId: input.organizationId,
    actorId: user.id,
    action: "SELF_BLOCKER_CREATED",
    targetType: "Blocker",
    targetId: blocker.id,
    metadata: { urgency: blocker.urgency, title: blocker.title, isSelfTracked: true },
  });
  return blocker;
}

export async function listSelfTrackedBlockers(user: SessionUser, organizationId: string, status?: BlockerStatus) {
  if (!(await canUseSelfTracking(user, organizationId))) {
    throw new Error("Self-tracking is not enabled for this organization.");
  }
  return prisma.blocker.findMany({
    where: {
      organizationId,
      menteeId: user.id,
      isSelfTracked: true,
      ...(status ? { status } : {}),
    },
    include: {
      cohort: { select: { id: true, name: true, slug: true } },
      mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
      mentor: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function createBlocker(user: SessionUser, input: CreateBlockerInput) {
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: input.organizationId, userId: user.id } } });
  if (membership?.status !== "ACTIVE" || membership.role !== "MENTEE") throw new Error("Only active mentees can raise blockers for themselves.");
  const enrollments = await prisma.cohortEnrollment.findMany({
    where: { menteeId: user.id, status: "ACTIVE", cohort: { organizationId: input.organizationId, status: "ACTIVE" } },
    include: { cohort: { include: { mentors: {
      where: { mentor: { memberships: { some: { organizationId: input.organizationId, role: { in: ["MENTOR", "ORG_ADMIN"] }, status: "ACTIVE" } } } },
      orderBy: { assignedAt: "asc" },
    } } } },
  });
  if (!enrollments.length) throw new Error("You must be actively enrolled in this organization before raising a blocker.");
  let selected = input.cohortId ? enrollments.find((item) => item.cohortId === input.cohortId) : enrollments.length === 1 ? enrollments[0] : null;
  if (input.cohortId && !selected) throw new Error("You are not actively enrolled in the selected cohort.");
  if (!selected && enrollments.length > 1) throw new Error("Choose the cohort this blocker belongs to.");
  const cohortId = selected?.cohortId || null;
  const mentorId = selected?.cohort.mentors[0]?.mentorId || null;
  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { slug: true } });
  if (!organization) throw new Error("Organization not found.");

  const source = input.source || BlockerSource.GENERAL;
  const sourceId = source === BlockerSource.GENERAL ? null : input.sourceId?.trim() || null;
  if (source !== BlockerSource.GENERAL && !sourceId) throw new Error("A source record is required for linked blockers.");

  // A linked blocker must reference an actual record owned by this mentee in this organization.
  // Never trust a source ID supplied by the browser without checking its ownership.
  if (source === BlockerSource.DAILY_REPORT && sourceId) {
    const report = await prisma.dailyReport.findFirst({
      where: { id: sourceId, organizationId: input.organizationId, menteeId: user.id, cohortId: cohortId || undefined, status: { not: "DRAFT" } },
      select: { id: true },
    });
    if (!report) throw new Error("The linked daily report was not found or is not yours.");
  } else if (source === BlockerSource.TASK && sourceId) {
    const assignment = await prisma.taskAssignment.findFirst({
      where: {
        menteeId: user.id,
        task: { organizationId: input.organizationId, ...(cohortId ? { OR: [{ cohortId }, { cohortId: null }] } : {}) },
        OR: [{ id: sourceId }, { taskId: sourceId }],
      },
      select: { id: true },
    });
    if (!assignment) throw new Error("The linked task is not assigned to you in this organization.");
  } else if (source === BlockerSource.LEARNING_MILESTONE && sourceId) {
    const milestone = await prisma.menteeMilestone.findFirst({
      where: {
        id: sourceId,
        menteeId: user.id,
        milestone: { learningPath: { organizationId: input.organizationId, ...(cohortId ? { OR: [{ cohortId }, { cohortId: null }] } : {}) } },
      },
      select: { id: true },
    });
    if (!milestone) throw new Error("The linked learning milestone is not assigned to you in this organization.");
  } else if (source === BlockerSource.GITHUB && sourceId) {
    const activity = await prisma.gitHubActivity.findFirst({
      where: {
        id: sourceId,
        organizationId: input.organizationId,
        isFixture: false,
        repository: { memberRepositories: { some: { organizationId: input.organizationId, userId: user.id } } },
      },
      select: { id: true },
    });
    if (!activity) throw new Error("The linked GitHub activity is not from one of your selected repositories.");
  }
  let created = false;
  let reopened = false;
  let blocker;
  const blockerData = {
    organizationId: input.organizationId, cohortId, menteeId: user.id, mentorId,
    title: input.title.trim(), description: input.description.trim(), category: input.category || "General",
    urgency: input.urgency || BlockerUrgency.MEDIUM,
  };

  if (sourceIdRequired(source, sourceId)) {
    const existing = await prisma.blocker.findFirst({ where: { organizationId: input.organizationId, menteeId: user.id, source, sourceId } });
    if (existing) {
      const reactivate = existing.status === BlockerStatus.RESOLVED;
      blocker = await prisma.blocker.update({ where: { id: existing.id }, data: {
        ...blockerData,
        ...(reactivate ? { status: BlockerStatus.OPEN, response: null, firstRespondedAt: null, resolvedAt: null } : {}),
      }, include: {
        cohort: { select: { id: true, name: true } },
        mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
        mentor: { select: { id: true, name: true, email: true, imageUrl: true } },
      } });
      reopened = reactivate;
    }
  }

  if (!blocker) {
    try {
      blocker = await prisma.blocker.create({
        data: { ...blockerData, status: BlockerStatus.OPEN, source, sourceId },
        include: {
          cohort: { select: { id: true, name: true } },
          mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
          mentor: { select: { id: true, name: true, email: true, imageUrl: true } },
        },
      });
      created = true;
    } catch (error) {
      // A concurrent duplicate report submission may have inserted the same source record.
      if (!sourceIdRequired(source, sourceId) || (error as { code?: string })?.code !== "P2002") throw error;
      const existing = await prisma.blocker.findFirst({ where: { organizationId: input.organizationId, menteeId: user.id, source, sourceId } });
      if (!existing) throw error;
      const reactivate = existing.status === BlockerStatus.RESOLVED;
      blocker = await prisma.blocker.update({ where: { id: existing.id }, data: {
        ...blockerData,
        ...(reactivate ? { status: BlockerStatus.OPEN, response: null, firstRespondedAt: null, resolvedAt: null } : {}),
      }, include: {
        cohort: { select: { id: true, name: true } },
        mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
        mentor: { select: { id: true, name: true, email: true, imageUrl: true } },
      } });
      reopened = reactivate;
    }
  }

  const recipients = mentorId
    ? [{ userId: mentorId, role: "MENTOR" as const }]
    : await prisma.organizationMembership.findMany({
        where: { organizationId: input.organizationId, role: "ORG_ADMIN", status: "ACTIVE" },
        select: { userId: true, role: true },
      });
  if ((created || reopened) && recipients.length) await prisma.notification.createMany({ data: recipients.map((recipient) => ({
    organizationId: input.organizationId, userId: recipient.userId, type: "BLOCKER_RAISED", title: `Blocker reported: ${input.title}`,
    body: `${user.name} reported a ${input.urgency || "MEDIUM"} urgency blocker: "${input.description.substring(0, 80)}"`,
    targetUrl: `/org/${organization.slug}/${recipient.role === "MENTOR" ? "mentor/blockers" : "admin"}`,
  })) });
  await logAudit({ organizationId: input.organizationId, actorId: user.id, action: reopened ? "BLOCKER_REOPENED_FROM_REPORT" : created ? "BLOCKER_RAISED" : "BLOCKER_UPDATED_FROM_REPORT", targetType: "Blocker", targetId: blocker.id, metadata: { urgency: blocker.urgency, title: blocker.title, source } });
  return blocker;
}

export async function resolveBlocker(user: SessionUser, blockerId: string, response: string, status: BlockerStatus = BlockerStatus.RESOLVED) {
  const blocker = await prisma.blocker.findUnique({ where: { id: blockerId }, include: { cohort: true } });
  if (!blocker) throw new Error("Blocker not found");
  if (blocker.isSelfTracked) {
    if (blocker.menteeId !== user.id || !(await canUseSelfTracking(user, blocker.organizationId))) {
      throw new Error("Only the owner can update or resolve their personal blocker.");
    }
    if (!([BlockerStatus.RESOLVED, BlockerStatus.IN_PROGRESS] as BlockerStatus[]).includes(status)) {
      throw new Error("Choose In progress or Resolved.");
    }
    const now = new Date();
    const updated = await prisma.blocker.update({
      where: { id: blockerId },
      data: {
        response: response.trim(),
        status,
        firstRespondedAt: blocker.firstRespondedAt || now,
        resolvedAt: status === BlockerStatus.RESOLVED ? now : null,
      },
      include: {
        mentee: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
      },
    });
    await logAudit({
      organizationId: blocker.organizationId,
      actorId: user.id,
      action: status === BlockerStatus.RESOLVED ? "SELF_BLOCKER_RESOLVED" : "SELF_BLOCKER_UPDATED",
      targetType: "Blocker",
      targetId: blockerId,
      metadata: { status, isSelfTracked: true },
    });
    return updated;
  }
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: blocker.organizationId, userId: user.id } } });
  if (!user.isPlatformSuperAdmin && membership?.status !== "ACTIVE") throw new Error("Active organization membership is required.");
  let allowed = user.isPlatformSuperAdmin || membership?.role === "ORG_ADMIN";
  if (membership?.role === "MENTOR" && blocker.cohortId) {
    const assignment = await prisma.cohortMentor.findFirst({
      where: {
        cohortId: blocker.cohortId,
        mentorId: user.id,
        cohort: { organizationId: blocker.organizationId, status: "ACTIVE", enrollments: { some: { menteeId: blocker.menteeId, status: "ACTIVE" } } },
        mentor: { memberships: { some: { organizationId: blocker.organizationId, role: "MENTOR", status: "ACTIVE" } } },
      },
    });
    allowed = Boolean(assignment);
  }
  if (!allowed) throw new Error("Only an administrator or the assigned mentor of an active cohort can respond to this blocker.");
  if (!([BlockerStatus.RESOLVED, BlockerStatus.IN_PROGRESS] as BlockerStatus[]).includes(status)) throw new Error("Choose In progress or Resolved. Only the mentee can reopen a resolved blocker.");
  if (blocker.status === BlockerStatus.RESOLVED && status !== BlockerStatus.RESOLVED) throw new Error("A resolved blocker can be reopened by its mentee, not by changing its status here.");
  const now = new Date();
  const guarded = await prisma.blocker.updateMany({
    where: { id: blockerId, status: blocker.status },
    data: {
      response: response.trim(), status,
      firstRespondedAt: blocker.firstRespondedAt || now,
      resolvedAt: status === BlockerStatus.RESOLVED ? now : null,
      mentorId: membership?.role === "MENTOR" ? user.id : blocker.mentorId,
    },
  });
  if (guarded.count !== 1) throw new Error("Blocker status changed. Refresh and try again.");
  const updated = await prisma.blocker.findUniqueOrThrow({ where: { id: blockerId }, include: {
    mentee: { select: { id: true, name: true, email: true } },
    mentor: { select: { id: true, name: true, email: true } },
  } });
  const organization = await prisma.organization.findUnique({ where: { id: blocker.organizationId }, select: { slug: true } });
  await prisma.notification.create({ data: {
    organizationId: blocker.organizationId, userId: blocker.menteeId, type: "BLOCKER_RESPONDED",
    title: status === BlockerStatus.RESOLVED ? "Blocker resolved" : "Mentor replied to blocker",
    body: `${user.name} responded: "${response.substring(0, 100)}"`, targetUrl: `/org/${organization?.slug || blocker.organizationId}/student/blockers`,
  } });
  await logAudit({ organizationId: blocker.organizationId, actorId: user.id, action: "BLOCKER_RESPONDED", targetType: "Blocker", targetId: blockerId, metadata: { status } });
  return updated;
}

export async function reopenBlocker(user: SessionUser, blockerId: string, reason?: string) {
  const blocker = await prisma.blocker.findUnique({ where: { id: blockerId } });
  if (!blocker) throw new Error("Blocker not found");
  if (blocker.isSelfTracked) {
    if (blocker.menteeId !== user.id || !(await canUseSelfTracking(user, blocker.organizationId))) {
      throw new Error("Only the owner can reopen their personal blocker.");
    }
    if (blocker.status !== BlockerStatus.RESOLVED) throw new Error("Only a resolved blocker can be reopened.");
    const updated = await prisma.blocker.update({
      where: { id: blockerId },
      data: { status: BlockerStatus.REOPENED, resolvedAt: null },
      include: {
        mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
        mentor: { select: { id: true, name: true, email: true, imageUrl: true } },
      },
    });
    return updated;
  }
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: blocker.organizationId, userId: user.id } } });
  if (blocker.menteeId !== user.id || (!user.isPlatformSuperAdmin && (membership?.status !== "ACTIVE" || membership.role !== "MENTEE"))) throw new Error("Only the active mentee who raised this blocker can reopen it.");
  if (blocker.status !== BlockerStatus.RESOLVED) throw new Error("Only a resolved blocker can be reopened.");
  if (blocker.cohortId) {
    const enrollment = await prisma.cohortEnrollment.findFirst({ where: { cohortId: blocker.cohortId, menteeId: user.id, status: "ACTIVE", cohort: { status: "ACTIVE", organizationId: blocker.organizationId } } });
    if (!enrollment) throw new Error("You are no longer actively enrolled in this blocker cohort.");
  }
  const updatedCount = await prisma.blocker.updateMany({
    where: { id: blockerId, organizationId: blocker.organizationId, menteeId: user.id, status: BlockerStatus.RESOLVED },
    data: {
      status: BlockerStatus.REOPENED,
      resolvedAt: null,
      ...(reason?.trim() ? { response: `${blocker.response ? `${blocker.response}\n\n` : ""}Reopened by mentee: ${reason.trim().slice(0, 500)}` } : {}),
    },
  });
  if (updatedCount.count !== 1) throw new Error("Blocker status changed. Refresh and try again.");
  const updated = await prisma.blocker.findUniqueOrThrow({ where: { id: blockerId }, include: {
    mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
    mentor: { select: { id: true, name: true, email: true, imageUrl: true } },
  } });
  const organization = await prisma.organization.findUnique({ where: { id: blocker.organizationId }, select: { slug: true } });
  if (blocker.mentorId) await prisma.notification.create({ data: {
    organizationId: blocker.organizationId, userId: blocker.mentorId, type: "BLOCKER_REOPENED", title: "Blocker reopened",
    body: `${user.name} reopened blocker: "${blocker.title}"`, targetUrl: `/org/${organization?.slug || blocker.organizationId}/mentor/blockers`,
  } });
  await logAudit({ organizationId: blocker.organizationId, actorId: user.id, action: "BLOCKER_REOPENED", targetType: "Blocker", targetId: blockerId, metadata: { reason: reason?.slice(0, 500) || null } });
  return updated;
}

export async function listBlockers(user: SessionUser, organizationId: string, status?: BlockerStatus) {
  const membership = user.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } });
  if (!user.isPlatformSuperAdmin && membership?.status !== "ACTIVE") throw new Error("Active organization membership is required.");
  if (membership?.role === "OBSERVER") throw new Error("Observers do not have access to individual blocker records.");
  const where: any = { organizationId, isSelfTracked: false, ...(status ? { status } : {}) };
  if (membership?.role === "MENTEE") where.menteeId = user.id;
  else if (membership?.role === "MENTOR") {
    const activeEnrollmentPairs = await prisma.cohortEnrollment.findMany({
      where: {
        status: "ACTIVE",
        cohort: {
          organizationId,
          status: "ACTIVE",
          mentors: { some: { mentorId: user.id } },
        },
        mentee: { memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } } },
      },
      select: { cohortId: true, menteeId: true },
    });
    where.OR = activeEnrollmentPairs.map((pair) => ({ cohortId: pair.cohortId, menteeId: pair.menteeId }));
  }
  return prisma.blocker.findMany({ where, include: {
    cohort: { select: { id: true, name: true, slug: true } },
    mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
    mentor: { select: { id: true, name: true, email: true } },
  }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
}
