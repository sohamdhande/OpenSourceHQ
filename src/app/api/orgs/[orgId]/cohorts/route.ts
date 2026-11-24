import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import prisma from "@/lib/db";
import { CohortCreateSchema } from "@/lib/schemas";
import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";

function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);

  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: params.orgId, userId: session.id } },
  });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return apiError("FORBIDDEN", "Active organization membership required", 403);

  const role = session.isPlatformSuperAdmin ? "ORG_ADMIN" : membership?.role;
  let cohortFilter: Prisma.CohortWhereInput = { organizationId: params.orgId };
  if (role === "MENTOR") {
    const rows = await prisma.cohortMentor.findMany({
      where: { mentorId: session.id, cohort: { organizationId: params.orgId, status: "ACTIVE" } },
      select: { cohortId: true },
    });
    cohortFilter = { ...cohortFilter, status: "ACTIVE", id: { in: rows.map((row) => row.cohortId) } };
  } else if (role === "MENTEE") {
    const rows = await prisma.cohortEnrollment.findMany({
      where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId: params.orgId, status: "ACTIVE" } },
      select: { cohortId: true },
    });
    cohortFilter = { ...cohortFilter, status: "ACTIVE", id: { in: rows.map((row) => row.cohortId) } };
  }

  const privileged = role === "ORG_ADMIN" || role === "MENTOR";
  const cohorts = await prisma.cohort.findMany({
    where: cohortFilter,
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
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json({ cohorts });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);
  if (!(await canManageOrganization(session, params.orgId))) return apiError("FORBIDDEN", "Organization administrator access required", 403);

  try {
    const body = await req.json();
    const parsed = CohortCreateSchema.safeParse({ ...(body && typeof body === "object" ? body : {}), organizationId: params.orgId });
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.message, 400);
    const data = parsed.data;
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return apiError("INVALID_COHORT_DATES", "Cohort end date must be later than its start date.", 400);
    }
    const slug = data.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return apiError("INVALID_COHORT_SLUG", "Use lowercase letters, numbers and hyphens for the cohort URL slug.", 400);

    const mentorIds = [...new Set(data.mentorIds || [])];
    const menteeIds = [...new Set(data.menteeIds || [])];
    const repositoryIds = [...new Set(data.repositoryIds || [])];
    const [mentors, mentees, repositories] = await Promise.all([
      prisma.organizationMembership.findMany({ where: { organizationId: params.orgId, userId: { in: mentorIds }, status: "ACTIVE", role: "MENTOR" }, select: { userId: true } }),
      prisma.organizationMembership.findMany({ where: { organizationId: params.orgId, userId: { in: menteeIds }, status: "ACTIVE", role: "MENTEE" }, select: { userId: true } }),
      prisma.repository.findMany({ where: { organizationId: params.orgId, id: { in: repositoryIds } }, select: { id: true } }),
    ]);
    if (mentors.length !== mentorIds.length) return apiError("INVALID_MENTORS", "Every assigned mentor must be an active mentor in this organization.", 400);
    if (mentees.length !== menteeIds.length) return apiError("INVALID_MENTEES", "Every enrolled mentee must be an active mentee in this organization.", 400);
    if (repositories.length !== repositoryIds.length) return apiError("INVALID_REPOSITORIES", "Every selected repository must belong to this organization.", 400);

    const cohort = await prisma.cohort.create({
      data: {
        organizationId: params.orgId,
        name: data.name.trim(),
        slug,
        description: data.description?.trim() || null,
        startDate,
        endDate,
        timezone: data.timezone || "UTC",
        createdById: session.id,
        mentors: mentorIds.length ? { create: mentorIds.map((mentorId) => ({ mentorId })) } : undefined,
        enrollments: menteeIds.length ? { create: menteeIds.map((menteeId) => ({ menteeId, status: "ACTIVE" })) } : undefined,
        cohortRepositories: repositoryIds.length ? { create: repositoryIds.map((repositoryId) => ({ repositoryId, addedById: session.id })) } : undefined,
      },
      include: {
        mentors: { include: { mentor: { select: { id: true, name: true, email: true } } } },
        enrollments: { include: { mentee: { select: { id: true, name: true, email: true } } } },
        cohortRepositories: { include: { repository: true } },
      },
    });
    await logAudit({ organizationId: params.orgId, actorId: session.id, action: "COHORT_CREATED", targetType: "Cohort", targetId: cohort.id, metadata: { name: cohort.name, slug: cohort.slug } });
    return NextResponse.json({ success: true, cohort }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create cohort";
    if (message.includes("Unique constraint")) return apiError("COHORT_SLUG_EXISTS", "A cohort with this URL slug already exists in the organization.", 409);
    return apiError("COHORT_CREATE_FAILED", message, 400);
  }
}
