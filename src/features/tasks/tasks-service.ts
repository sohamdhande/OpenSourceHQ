import prisma from "@/lib/db";
import { TaskPriority, TaskAssignmentStatus, TaskReviewDecision } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { SessionUser } from "@/server/auth/session";
import { canManageTask, canUseSelfTracking } from "@/server/authorization/policies";

export interface CreateTaskInput {
  organizationId: string;
  cohortId?: string | null;
  title: string;
  description: string;
  acceptanceCriteria?: string | null;
  priority?: TaskPriority;
  category?: string;
  repositoryId?: string | null;
  externalIssueUrl?: string | null;
  dueAt?: Date | string | null;
  assigneeIds: string[];
}

export interface CreateSelfTrackedTaskInput {
  organizationId: string;
  title: string;
  description: string;
  priority?: TaskPriority;
  category?: string;
  repositoryId?: string | null;
  externalIssueUrl?: string | null;
  dueAt?: Date | string | null;
}

export async function createSelfTrackedTask(user: SessionUser, input: CreateSelfTrackedTaskInput) {
  if (!input.title?.trim() || !input.description?.trim()) {
    throw new Error("Task title and description are required.");
  }
  const allowed = await canUseSelfTracking(user, input.organizationId);
  if (!allowed) {
    throw new Error("Self-tracking must be enabled for your organization membership to create personal tasks.");
  }

  if (input.repositoryId) {
    const repository = await prisma.repository.findFirst({
      where: { id: input.repositoryId, organizationId: input.organizationId },
      select: { id: true },
    });
    if (!repository) throw new Error("Selected repository does not belong to this organization.");
  }

  const dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("Due date is invalid.");

  const task = await prisma.task.create({
    data: {
      organizationId: input.organizationId,
      cohortId: null,
      isSelfTracked: true,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority || TaskPriority.NORMAL,
      category: input.category || "General",
      createdById: user.id,
      repositoryId: input.repositoryId || null,
      externalIssueUrl: input.externalIssueUrl || null,
      dueAt,
      assignments: {
        create: {
          menteeId: user.id,
          assignedById: user.id,
          status: TaskAssignmentStatus.TODO,
        },
      },
    },
    include: {
      assignments: { include: { mentee: { select: { id: true, name: true, email: true } } } },
      repository: { select: { id: true, fullName: true, url: true } },
    },
  });

  await logAudit({
    organizationId: input.organizationId,
    actorId: user.id,
    action: "SELF_TRACKED_TASK_CREATED",
    targetType: "Task",
    targetId: task.id,
    metadata: { title: task.title, isSelfTracked: true },
  });

  return task;
}

export async function updateSelfTrackedTaskStatus(
  user: SessionUser,
  taskId: string,
  status: "TODO" | "IN_PROGRESS" | "COMPLETED"
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignments: true },
  });
  if (!task || !task.isSelfTracked) {
    throw new Error("Personal task not found.");
  }
  if (task.createdById !== user.id) {
    throw new Error("You can only update your own personal tasks.");
  }
  if (!(await canUseSelfTracking(user, task.organizationId))) {
    throw new Error("Self-tracking is not enabled for this organization.");
  }

  const assignment = task.assignments.find((a) => a.menteeId === user.id);
  if (!assignment) {
    throw new Error("Personal task assignment not found.");
  }

  const nextStatus = status as TaskAssignmentStatus;
  const updatedAssignment = await prisma.taskAssignment.update({
    where: { id: assignment.id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === TaskAssignmentStatus.COMPLETED ? new Date() : null,
    },
  });

  return updatedAssignment;
}

export async function deleteSelfTrackedTask(user: SessionUser, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, organizationId: true, createdById: true, isSelfTracked: true },
  });
  if (!task || !task.isSelfTracked) {
    throw new Error("Personal task not found.");
  }
  if (task.createdById !== user.id) {
    throw new Error("You can only delete your own personal tasks.");
  }
  if (!(await canUseSelfTracking(user, task.organizationId))) {
    throw new Error("Self-tracking is not enabled for this organization.");
  }

  await prisma.task.delete({ where: { id: task.id } });
  return { deleted: true };
}

export async function createTask(user: SessionUser, input: CreateTaskInput) {
  if (!input.title?.trim() || !input.description?.trim()) throw new Error("Task title and description are required.");
  if (!Array.isArray(input.assigneeIds)) throw new Error("Task assignees must be a list.");
  let assigneeIds = [...new Set(input.assigneeIds)];
  const membership = user.isPlatformSuperAdmin
    ? null
    : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: input.organizationId, userId: user.id } } });
  if (!user.isPlatformSuperAdmin && membership?.status !== "ACTIVE") throw new Error("Active organization membership is required.");
  const role = user.isPlatformSuperAdmin ? "ORG_ADMIN" : membership?.role;
  if (role !== "ORG_ADMIN" && role !== "MENTOR") throw new Error("Only organization administrators and assigned mentors can create tasks.");

  let cohort: { id: string; organizationId: string; status: string; mentors: { mentorId: string }[] } | null = null;
  if (input.cohortId) {
    cohort = await prisma.cohort.findUnique({ where: { id: input.cohortId }, include: { mentors: true } });
    if (!cohort || cohort.organizationId !== input.organizationId || cohort.status !== "ACTIVE") throw new Error("Selected cohort must be active and belong to this organization.");
    if (role === "MENTOR" && !cohort.mentors.some((mentor) => mentor.mentorId === user.id)) {
      throw new Error("Mentors can create tasks only for cohorts assigned to them.");
    }
  } else if (role === "MENTOR") {
    throw new Error("Mentor-created tasks must belong to one of your assigned cohorts.");
  }
  // A cohort-wide task means every currently active mentee in that cohort.
  // Persist assignments up front so every learner has a real state machine,
  // submission target, and review history instead of a non-actionable template.
  if (assigneeIds.length === 0 && cohort) {
    const cohortMentees = await prisma.cohortEnrollment.findMany({
      where: {
        cohortId: cohort.id,
        status: "ACTIVE",
        mentee: { memberships: { some: { organizationId: input.organizationId, role: "MENTEE", status: "ACTIVE" } } },
      },
      select: { menteeId: true },
    });
    assigneeIds = cohortMentees.map((row) => row.menteeId);
  }
  if (assigneeIds.length === 0) throw new Error("Select at least one active mentee, or choose a cohort with active mentees for cohort-wide assignment.");

  if (input.repositoryId) {
    const repository = await prisma.repository.findFirst({ where: { id: input.repositoryId, organizationId: input.organizationId } });
    if (!repository) throw new Error("Selected repository does not belong to this organization.");
  }

  const assigneeMemberships = await prisma.organizationMembership.findMany({
    where: { organizationId: input.organizationId, userId: { in: assigneeIds }, role: "MENTEE", status: "ACTIVE" },
    select: { userId: true },
  });
  if (assigneeMemberships.length !== assigneeIds.length) throw new Error("Every assignee must be an active mentee in this organization.");
  if (cohort) {
    const enrolled = await prisma.cohortEnrollment.findMany({
      where: { cohortId: cohort.id, menteeId: { in: assigneeIds }, status: "ACTIVE" },
      select: { menteeId: true },
    });
    if (enrolled.length !== assigneeIds.length) throw new Error("Every assignee must be actively enrolled in the selected cohort.");
  }

  const dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("Due date is invalid.");
  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { slug: true } });
  if (!organization) throw new Error("Organization not found.");

  const task = await prisma.task.create({
    data: {
      organizationId: input.organizationId,
      cohortId: input.cohortId || null,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority || TaskPriority.NORMAL,
      category: input.category || "General",
      createdById: user.id,
      repositoryId: input.repositoryId || null,
      externalIssueUrl: input.externalIssueUrl || null,
      dueAt,
      acceptanceCriteria: input.acceptanceCriteria || null,
      assignments: assigneeIds.length ? {
        create: assigneeIds.map((menteeId) => ({ menteeId, assignedById: user.id, status: TaskAssignmentStatus.TODO })),
      } : undefined,
    },
    include: {
      assignments: { include: { mentee: { select: { id: true, name: true, email: true } } } },
      repository: { select: { id: true, fullName: true, url: true } },
      cohort: { select: { id: true, name: true } },
    },
  });

  if (assigneeIds.length) await prisma.notification.createMany({
    data: assigneeIds.map((menteeId) => ({
      organizationId: input.organizationId, userId: menteeId, type: "TASK_ASSIGNED", title: "New task assigned",
      body: `You were assigned: "${input.title.trim()}" by ${user.name}`,
      targetUrl: `/org/${organization.slug}/student/tasks`,
    })),
  });

  await logAudit({
    organizationId: input.organizationId,
    actorId: user.id,
    action: "TASK_CREATED",
    targetType: "Task",
    targetId: task.id,
    metadata: { title: task.title, assigneeCount: assigneeIds.length },
  });

  return task;
}

export async function startTaskAssignment(user: SessionUser, assignmentId: string) {
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: assignmentId },
    include: { task: true },
  });
  if (!assignment) throw new Error("Task assignment not found.");
  if (assignment.menteeId !== user.id) throw new Error("Only the assigned mentee can start this task.");
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: assignment.task.organizationId, userId: user.id } },
  });
  if (membership?.status !== "ACTIVE" || membership.role !== "MENTEE") throw new Error("Active mentee organization membership is required.");
  if (assignment.task.archivedAt) throw new Error("This task is archived and cannot be started.");
  if (assignment.task.cohortId) {
    const cohort = await prisma.cohort.findFirst({ where: { id: assignment.task.cohortId, organizationId: assignment.task.organizationId, status: "ACTIVE" }, select: { id: true } });
    if (!cohort) throw new Error("This task belongs to an inactive cohort and can no longer be started.");
  }
  if (assignment.status !== TaskAssignmentStatus.TODO) {
    if (assignment.status === TaskAssignmentStatus.IN_PROGRESS) return assignment;
    throw new Error("Only a task in the To do state can be started. Refresh to see its current status.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const guarded = await tx.taskAssignment.updateMany({
      where: { id: assignmentId, menteeId: user.id, status: TaskAssignmentStatus.TODO },
      data: { status: TaskAssignmentStatus.IN_PROGRESS },
    });
    if (guarded.count !== 1) throw new Error("Task status changed while you were starting it. Refresh and try again.");
    return tx.taskAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
  });
  await logAudit({ organizationId: assignment.task.organizationId, actorId: user.id, action: "TASK_STARTED", targetType: "TaskAssignment", targetId: assignmentId, metadata: { taskId: assignment.taskId } });
  return updated;
}

export async function submitTaskAssignment(
  user: SessionUser,
  assignmentId: string,
  notes: string,
  evidenceUrl?: string | null
) {
  const assignment = await prisma.taskAssignment.findUnique({ where: { id: assignmentId }, include: { task: true } });
  if (!assignment) throw new Error("Task assignment not found.");
  if (assignment.menteeId !== user.id) throw new Error("Only the assigned mentee can submit this task.");
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: assignment.task.organizationId, userId: user.id } } });
  if (membership?.status !== "ACTIVE" || membership.role !== "MENTEE") throw new Error("Active mentee organization membership is required.");
  if (assignment.task.archivedAt) throw new Error("This task is archived and can no longer receive submissions.");
  if (assignment.task.cohortId) {
    const cohort = await prisma.cohort.findFirst({ where: { id: assignment.task.cohortId, organizationId: assignment.task.organizationId, status: "ACTIVE" }, select: { id: true } });
    if (!cohort) throw new Error("This task belongs to an inactive cohort and can no longer receive submissions.");
  }
  if (notes.trim().length < 3) throw new Error("Add at least three characters describing your work.");
  const allowedStatuses: TaskAssignmentStatus[] = [TaskAssignmentStatus.TODO, TaskAssignmentStatus.IN_PROGRESS, TaskAssignmentStatus.CHANGES_REQUESTED];
  if (!allowedStatuses.includes(assignment.status)) throw new Error("This task is already submitted, completed, or cancelled.");
  const nextStatus = assignment.status === TaskAssignmentStatus.CHANGES_REQUESTED ? TaskAssignmentStatus.RESUBMITTED : TaskAssignmentStatus.SUBMITTED;
  const [submission, updatedAssignment] = await prisma.$transaction(async (tx) => {
    const guarded = await tx.taskAssignment.updateMany({ where: { id: assignmentId, menteeId: user.id, status: { in: allowedStatuses } }, data: { status: nextStatus } });
    if (guarded.count !== 1) throw new Error("Task status changed. Refresh and try again.");
    const created = await tx.taskSubmission.create({ data: { taskAssignmentId: assignmentId, submittedById: user.id, notes: notes.trim(), evidenceUrl: evidenceUrl || null } });
    const updated = await tx.taskAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    return [created, updated] as const;
  });
  await logAudit({ organizationId: assignment.task.organizationId, actorId: user.id, action: nextStatus === TaskAssignmentStatus.RESUBMITTED ? "TASK_RESUBMITTED" : "TASK_SUBMITTED", targetType: "TaskAssignment", targetId: assignmentId, metadata: { taskId: assignment.taskId } });
  return { submission, updatedAssignment };
}

export async function reviewTaskAssignment(
  user: SessionUser,
  assignmentId: string,
  decision: TaskReviewDecision,
  comment: string
) {
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: assignmentId },
    include: { task: true },
  });

  if (!assignment) throw new Error("Assignment not found");

  const allowed = await canManageTask(user, assignment.taskId, assignment.menteeId);
  if (!allowed) throw new Error("Unauthorized to review this task");
  if (assignment.task.archivedAt) throw new Error("Archived tasks cannot be reviewed.");
  const latestSubmission = await prisma.taskSubmission.findFirst({ where: { taskAssignmentId: assignmentId }, orderBy: { submittedAt: "desc" } });
  if (!latestSubmission || !([TaskAssignmentStatus.SUBMITTED, TaskAssignmentStatus.RESUBMITTED, TaskAssignmentStatus.UNDER_REVIEW] as TaskAssignmentStatus[]).includes(assignment.status)) {
    throw new Error("A current submission is required before reviewing this task.");
  }
  if (!comment.trim()) throw new Error("A review comment is required.");
  const reviewable = [TaskAssignmentStatus.SUBMITTED, TaskAssignmentStatus.RESUBMITTED, TaskAssignmentStatus.UNDER_REVIEW];
  const newStatus = decision === "ACCEPTED" ? TaskAssignmentStatus.COMPLETED : TaskAssignmentStatus.CHANGES_REQUESTED;

  const result = await prisma.$transaction(async (tx) => {
    const guarded = await tx.taskAssignment.updateMany({
      where: { id: assignmentId, status: { in: reviewable } },
      data: { status: newStatus, completedAt: decision === "ACCEPTED" ? new Date() : null },
    });
    if (guarded.count !== 1) throw new Error("The assignment changed while it was being reviewed. Refresh and try again.");
    const review = await tx.taskReview.create({
      data: { taskAssignmentId: assignmentId, reviewerId: user.id, decision, comment: comment.trim() },
    });
    const updated = await tx.taskAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    return { review, updated };
  });
  const { review, updated } = result;

  const organization = await prisma.organization.findUnique({ where: { id: assignment.task.organizationId }, select: { slug: true } });
  await prisma.notification.create({ data: {
    organizationId: assignment.task.organizationId, userId: assignment.menteeId, type: "TASK_REVIEWED",
    title: decision === "ACCEPTED" ? "Task accepted" : "Changes requested on task",
    body: `${user.name} reviewed your submission for "${assignment.task.title}": "${comment}"`,
    targetUrl: `/org/${organization?.slug || assignment.task.organizationId}/student/tasks`,
  } });

  await logAudit({
    organizationId: assignment.task.organizationId,
    actorId: user.id,
    action: "TASK_REVIEWED",
    targetType: "TaskAssignment",
    targetId: assignmentId,
    metadata: { decision, status: newStatus },
  });

  return { review, updated };
}

