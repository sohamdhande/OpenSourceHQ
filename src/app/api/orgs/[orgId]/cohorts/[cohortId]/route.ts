import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { CohortUpdateSchema } from "@/lib/schemas";

function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: { orgId: string; cohortId: string } }) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);
  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: params.orgId, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return apiError("FORBIDDEN", "Active organization membership required", 403);

  const role = session.isPlatformSuperAdmin ? "ORG_ADMIN" : membership?.role;
  const cohort = await prisma.cohort.findFirst({
    where: {
      id: params.cohortId,
      organizationId: params.orgId,
      ...(role === "MENTOR" || role === "MENTEE" ? { status: "ACTIVE" } : {}),
    },
  });
  if (!cohort) return apiError("NOT_FOUND", "Cohort not found", 404);
  if (role === "MENTOR") {
    const assigned = await prisma.cohortMentor.findFirst({
      where: { cohortId: cohort.id, mentorId: session.id, cohort: { organizationId: params.orgId, status: "ACTIVE" } },
    });
    if (!assigned) return apiError("FORBIDDEN", "You are not assigned to this active cohort", 403);
  } else if (role === "MENTEE") {
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: { cohortId: cohort.id, menteeId: session.id, status: "ACTIVE", cohort: { status: "ACTIVE", organizationId: params.orgId } },
    });
    if (!enrollment) return apiError("FORBIDDEN", "You are not actively enrolled in this cohort", 403);
  }

  const privileged = role === "ORG_ADMIN" || role === "MENTOR";
  const details = await prisma.cohort.findUnique({
    where: { id: cohort.id },
    include: {
      mentors: privileged ? { include: { mentor: { select: { id: true, name: true, email: true } } } } : false,
      enrollments: role === "ORG_ADMIN" || role === "MENTOR"
        ? { where: { status: "ACTIVE" }, include: { mentee: { select: { id: true, name: true, email: true } } } }
        : role === "MENTEE"
          ? { where: { menteeId: session.id, status: "ACTIVE" }, include: { mentee: { select: { id: true, name: true } } } }
          : false,
      cohortRepositories: { include: { repository: true } },
      _count: { select: { dailyReports: true, tasks: true, enrollments: { where: { status: "ACTIVE" } } } },
    },
  });
  return NextResponse.json({ cohort: details });
}

export async function PATCH(req: NextRequest, { params }: { params: { orgId: string; cohortId: string } }) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);
  if (!(await canManageOrganization(session, params.orgId))) return apiError("FORBIDDEN", "Organization administrator access required", 403);

  try {
    const parsed = CohortUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.message, 400);
    const data = parsed.data;
    const existing = await prisma.cohort.findFirst({ where: { id: params.cohortId, organizationId: params.orgId } });
    if (!existing) return apiError("NOT_FOUND", "Cohort not found", 404);

    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return apiError("INVALID_COHORT_DATES", "Cohort end date must be later than its start date.", 400);

    const mentorIds = data.mentorIds === undefined ? undefined : [...new Set(data.mentorIds)];
    const menteeIds = data.menteeIds === undefined ? undefined : [...new Set(data.menteeIds)];
    const repositoryIds = data.repositoryIds === undefined ? undefined : [...new Set(data.repositoryIds)];
    const [mentors, mentees, repositories] = await Promise.all([
      mentorIds ? prisma.organizationMembership.findMany({ where: { organizationId: params.orgId, userId: { in: mentorIds }, status: "ACTIVE", role: { in: ["MENTOR", "ORG_ADMIN"] } }, select: { userId: true } }) : Promise.resolve([]),
      menteeIds ? prisma.organizationMembership.findMany({ where: { organizationId: params.orgId, userId: { in: menteeIds }, status: "ACTIVE", role: "MENTEE" }, select: { userId: true } }) : Promise.resolve([]),
      repositoryIds ? prisma.repository.findMany({ where: { organizationId: params.orgId, id: { in: repositoryIds } }, select: { id: true } }) : Promise.resolve([]),
    ]);
    if (mentorIds && mentors.length !== mentorIds.length) return apiError("INVALID_MENTORS", "Every assigned mentor must be an active mentor or administrator in this organization.", 400);
    if (menteeIds && mentees.length !== menteeIds.length) return apiError("INVALID_MENTEES", "Every enrolled mentee must be an active mentee in this organization.", 400);
    if (repositoryIds && repositories.length !== repositoryIds.length) return apiError("INVALID_REPOSITORIES", "Every selected repository must belong to this organization.", 400);

    const updatedCohort = await prisma.$transaction(async (tx) => {
      await tx.cohort.update({
        where: { id: params.cohortId },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
          ...(data.startDate !== undefined ? { startDate } : {}),
          ...(data.endDate !== undefined ? { endDate } : {}),
          ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
      });

      if (mentorIds) {
        if (mentorIds.length) {
          await tx.cohortMentor.deleteMany({ where: { cohortId: params.cohortId, mentorId: { notIn: mentorIds } } });
          await tx.cohortMentor.createMany({ data: mentorIds.map((mentorId) => ({ cohortId: params.cohortId, mentorId })), skipDuplicates: true });
        } else {
          await tx.cohortMentor.deleteMany({ where: { cohortId: params.cohortId } });
        }
      }

      if (menteeIds) {
        if (menteeIds.length) {
          await tx.cohortEnrollment.updateMany({
            where: { cohortId: params.cohortId, status: "ACTIVE", menteeId: { notIn: menteeIds } },
            data: { status: "WITHDRAWN", endedAt: new Date() },
          });
        } else {
          await tx.cohortEnrollment.updateMany({ where: { cohortId: params.cohortId, status: "ACTIVE" }, data: { status: "WITHDRAWN", endedAt: new Date() } });
        }
        for (const menteeId of menteeIds) {
          await tx.cohortEnrollment.upsert({
            where: { cohortId_menteeId: { cohortId: params.cohortId, menteeId } },
            create: { cohortId: params.cohortId, menteeId, status: "ACTIVE" },
            update: { status: "ACTIVE", endedAt: null },
          });
        }
      }

      if (repositoryIds) {
        if (repositoryIds.length) {
          await tx.cohortRepository.deleteMany({ where: { cohortId: params.cohortId, repositoryId: { notIn: repositoryIds } } });
          await tx.cohortRepository.createMany({ data: repositoryIds.map((repositoryId) => ({ cohortId: params.cohortId, repositoryId, addedById: session.id })), skipDuplicates: true });
        } else {
          await tx.cohortRepository.deleteMany({ where: { cohortId: params.cohortId } });
        }
      }

      return tx.cohort.findUnique({
        where: { id: params.cohortId },
        include: {
          mentors: { include: { mentor: { select: { id: true, name: true, email: true } } } },
          enrollments: { where: { status: "ACTIVE" }, include: { mentee: { select: { id: true, name: true, email: true } } } },
          cohortRepositories: { include: { repository: true } },
          _count: { select: { dailyReports: true, tasks: true, enrollments: { where: { status: "ACTIVE" } } } },
        },
      });
    });

    await logAudit({ organizationId: params.orgId, actorId: session.id, action: "COHORT_UPDATED", targetType: "Cohort", targetId: params.cohortId, metadata: { name: data.name, status: data.status, mentorCount: mentorIds?.length, menteeCount: menteeIds?.length, repositoryCount: repositoryIds?.length } });
    return NextResponse.json({ success: true, cohort: updatedCohort });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cohort update failed";
    return apiError("COHORT_UPDATE_FAILED", message, 400);
  }
}
