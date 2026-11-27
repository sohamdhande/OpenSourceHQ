import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { createSelfTrackedTask, createTask } from "@/features/tasks/tasks-service";
import { SelfTrackedTaskCreateSchema, TaskCreateSchema } from "@/lib/schemas";
import { canUseSelfTracking } from "@/server/authorization/policies";
import { TaskAssignmentStatus } from "@prisma/client";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId") || session.activeOrgId;
  const cohortId = searchParams.get("cohortId");
  const menteeId = searchParams.get("menteeId");
  const status = searchParams.get("status") as TaskAssignmentStatus | null;
  const mode = searchParams.get("mode");
  const validAssignmentStatuses = new Set(["TODO", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "RESUBMITTED", "COMPLETED", "BLOCKED", "CANCELLED", "OVERDUE"]);
  if (status && !validAssignmentStatuses.has(status)) {
    return NextResponse.json({ error: { code: "INVALID_STATUS", message: "Unsupported task assignment status." } }, { status: 400 });
  }

  if (!organizationId) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "organizationId required" } }, { status: 400 });
  }

  if (mode === "self") {
    if (!(await canUseSelfTracking(session, organizationId))) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Self-tracking is not enabled for this organization." } }, { status: 403 });
    }
    const tasks = await prisma.task.findMany({
      where: {
        organizationId,
        createdById: session.id,
        isSelfTracked: true,
        archivedAt: null,
      },
      include: {
        repository: { select: { id: true, fullName: true } },
        assignments: {
          where: { menteeId: session.id },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ tasks });
  }

  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.id } },
  });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });
  }

  if (membership?.role === "OBSERVER") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Observers can view program-level summaries, not individual task assignments or submission evidence" } }, { status: 403 });
  }

  const whereClause: any = { organizationId, archivedAt: null, isSelfTracked: false };
  let scopedMenteeIdsForAssignments: string[] = [];
  if (cohortId) whereClause.cohortId = cohortId;

  if (membership?.role === "MENTEE") {
    const enrollments = await prisma.cohortEnrollment.findMany({ where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } }, select: { cohortId: true } });
    const enrolledCohortIds = enrollments.map((item) => item.cohortId);
    if (cohortId && !enrolledCohortIds.includes(cohortId)) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not enrolled in this active cohort" } }, { status: 403 });
    }
    whereClause.assignments = { some: { menteeId: session.id, ...(status ? { status } : { status: { not: "CANCELLED" } }) } };
    whereClause.AND = [{ OR: [{ cohortId: null }, { cohortId: { in: enrolledCohortIds } }] }];
  } else if (membership?.role === "MENTOR") {
    const assigned = await prisma.cohortMentor.findMany({ where: { mentorId: session.id, cohort: { organizationId, status: "ACTIVE" } }, select: { cohortId: true } });
    const cohortIds = assigned.map((item) => item.cohortId);
    if (cohortId && !cohortIds.includes(cohortId)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not assigned to this active cohort" } }, { status: 403 });
    const scopedEnrollments = await prisma.cohortEnrollment.findMany({
      where: { cohortId: { in: cohortIds }, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" }, mentee: { memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } } } },
      select: { menteeId: true },
    });
    const scopedMenteeIds = [...new Set(scopedEnrollments.map((row) => row.menteeId))];
    scopedMenteeIdsForAssignments = scopedMenteeIds;
    whereClause.AND = [{ OR: [{ cohortId: null }, { cohortId: { in: cohortIds } }] }];
    whereClause.OR = [
      { createdById: session.id },
      { cohortId: { in: cohortIds } },
      { cohortId: null, assignments: { some: { menteeId: { in: scopedMenteeIds } } } },
    ];
    if (menteeId) {
      if (!scopedMenteeIds.includes(menteeId)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You do not mentor this active mentee" } }, { status: 403 });
      whereClause.assignments = { some: { menteeId } };
    }
  } else if (menteeId) {
    const targetMembership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: menteeId } } });
    if (targetMembership?.status !== "ACTIVE" || targetMembership.role !== "MENTEE") return NextResponse.json({ error: { code: "INVALID_MENTEE", message: "Target must be an active mentee in this organization" } }, { status: 400 });
    whereClause.assignments = { some: { menteeId } };
  }
  if (cohortId && membership?.role !== "MENTEE" && membership?.role !== "MENTOR") {
    const cohort = await prisma.cohort.findFirst({ where: { id: cohortId, organizationId, status: "ACTIVE" }, select: { id: true } });
    if (!cohort) return NextResponse.json({ error: { code: "INVALID_COHORT", message: "Choose an active cohort in this organization" } }, { status: 400 });
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    include: {
      creator: { select: { id: true, name: true } },
      repository: { select: { id: true, fullName: true } },
      cohort: { select: { id: true, name: true } },
      assignments: {
        where: {
          ...(membership?.role === "MENTEE" ? { menteeId: session.id } : menteeId ? { menteeId } : {}),
          ...(membership?.role === "MENTOR" && !menteeId ? { menteeId: { in: scopedMenteeIdsForAssignments } } : {}),
          ...(status ? { status } : membership?.role === "MENTEE" ? { status: { not: "CANCELLED" } } : {}),
        },
        include: {
          mentee: { select: { id: true, name: true, email: true } },
          submissions: { orderBy: { submittedAt: "desc" } },
          reviews: { orderBy: { createdAt: "desc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : session.activeOrgId;
    if (body?.mode === "self") {
      if (!organizationId) {
        return NextResponse.json({ error: { code: "BAD_REQUEST", message: "organizationId required" } }, { status: 400 });
      }
      const parsedSelf = SelfTrackedTaskCreateSchema.safeParse({ ...body, organizationId });
      if (!parsedSelf.success) {
        return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsedSelf.error.message } }, { status: 400 });
      }
      const task = await createSelfTrackedTask(session, parsedSelf.data);
      return NextResponse.json({ success: true, task });
    }

    const parsed = TaskCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    }

    const task = await createTask(session, parsed.data);
    return NextResponse.json({ success: true, task });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Task creation failed";
    return NextResponse.json({ error: { code: "TASK_CREATE_FAILED", message: msg } }, { status: 400 });
  }
}

