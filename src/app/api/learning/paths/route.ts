import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return error("UNAUTHORIZED", "Sign in required.", 401);
  const organizationId = request.nextUrl.searchParams.get("organizationId") || session.activeOrgId;
  if (!organizationId) return error("BAD_REQUEST", "Organization is required.", 400);

  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.id } },
  });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return error("FORBIDDEN", "Active organization membership required.", 403);
  if (membership?.role === "OBSERVER") return error("FORBIDDEN", "Observers can view learning programme summaries, not individual learning paths or evidence.", 403);

  let cohortIds: string[] = [];
  if (membership?.role === "MENTEE") {
    const rows = await prisma.cohortEnrollment.findMany({
      where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } },
      select: { cohortId: true },
    });
    cohortIds = rows.map((row) => row.cohortId);
  } else if (membership?.role === "MENTOR") {
    const rows = await prisma.cohortMentor.findMany({
      where: { mentorId: session.id, cohort: { organizationId, status: "ACTIVE" } },
      select: { cohortId: true },
    });
    cohortIds = rows.map((row) => row.cohortId);
  }

  const scope = session.isPlatformSuperAdmin || membership?.role === "ORG_ADMIN"
    ? { organizationId }
    : {
        organizationId,
        OR: [{ cohortId: null }, { cohortId: { in: cohortIds } }],
        // Mentees must not receive mentor-only learning plans, even when the
        // plan is organization-wide. Mentors/admins retain the review scope.
        ...(membership?.role === "MENTEE" ? { visibility: { in: ["ORGANIZATION", "COHORT"] } } : {}),
      };

  const paths = await prisma.learningPath.findMany({
    where: scope,
    include: {
      cohort: { select: { id: true, name: true, slug: true } },
      milestones: {
        include: {
          skill: { select: { id: true, name: true, category: true } },
          menteeMilestones: membership?.role === "MENTEE"
            ? { where: { menteeId: session.id }, select: { id: true, status: true, notes: true, evidenceUrl: true, reviewComment: true, reviewedAt: true, updatedAt: true } }
            : membership?.role === "MENTOR"
              ? false
              : { select: { id: true, menteeId: true, status: true, notes: true, evidenceUrl: true, reviewComment: true, reviewedAt: true, updatedAt: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { milestones: true } },
    },
    orderBy: [{ cohortId: "asc" }, { createdAt: "asc" }],
  });

  // A mentor can see submissions only from mentees in their assigned active
  // cohorts. Cohort-scoped paths require enrollment in that exact cohort;
  // organization-wide paths accept mentees from any cohort the mentor supervises.
  if (membership?.role === "MENTOR") {
    const milestoneIds = paths.flatMap((path) => path.milestones.map((milestone) => milestone.id));
    const [submissions, enrollments] = milestoneIds.length > 0 && cohortIds.length > 0
      ? await Promise.all([
          prisma.menteeMilestone.findMany({
            where: {
              milestoneId: { in: milestoneIds },
              mentee: {
                memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } },
                cohortEnrollments: { some: { cohortId: { in: cohortIds }, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } } },
              },
            },
            select: { id: true, milestoneId: true, menteeId: true, status: true, notes: true, evidenceUrl: true, reviewComment: true, reviewedAt: true, updatedAt: true },
          }),
          prisma.cohortEnrollment.findMany({
            where: { cohortId: { in: cohortIds }, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" }, mentee: { memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } } } },
            select: { menteeId: true, cohortId: true },
          }),
        ])
      : [[], []];
    const cohortsByMentee = new Map<string, Set<string>>();
    for (const enrollment of enrollments) {
      const cohorts = cohortsByMentee.get(enrollment.menteeId) || new Set<string>();
      cohorts.add(enrollment.cohortId);
      cohortsByMentee.set(enrollment.menteeId, cohorts);
    }
    const submissionsByMilestone = new Map<string, typeof submissions>();
    for (const submission of submissions) {
      const rows = submissionsByMilestone.get(submission.milestoneId) || [];
      rows.push(submission);
      submissionsByMilestone.set(submission.milestoneId, rows);
    }
    const mentorScopedPaths = paths.map((path) => ({
      ...path,
      milestones: path.milestones.map((milestone) => ({
        ...milestone,
        menteeMilestones: (submissionsByMilestone.get(milestone.id) || []).filter((submission) => {
          const enrolledCohorts = cohortsByMentee.get(submission.menteeId);
          return path.cohortId ? Boolean(enrolledCohorts?.has(path.cohortId)) : Boolean(enrolledCohorts?.size);
        }),
      })),
    }));
    return NextResponse.json({ paths: mentorScopedPaths });
  }

  return NextResponse.json({ paths });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return error("UNAUTHORIZED", "Sign in required.", 401);
  try {
    const body = await request.json();
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : session.activeOrgId;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const cohortId = typeof body.cohortId === "string" && body.cohortId.trim() ? body.cohortId : null;
    const milestones = Array.isArray(body.milestones) ? body.milestones : [];
    if (!organizationId || title.length < 3 || title.length > 120 || milestones.length < 1 || milestones.length > 40) {
      return error("VALIDATION_ERROR", "Provide a title (3–120 characters) and between 1 and 40 milestones.", 400);
    }
    const cleanedMilestones: Array<{ title: string; description: string | null }> = milestones.map((item: unknown) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        title: typeof record.title === "string" ? record.title.trim() : "",
        description: typeof record.description === "string" ? record.description.trim() : null,
      };
    });
    if (cleanedMilestones.some((item: { title: string; description: string | null }) => item.title.length < 3 || item.title.length > 160 || (item.description?.length || 0) > 1000)) {
      return error("INVALID_MILESTONES", "Each milestone needs a 3–160 character title and a description no longer than 1,000 characters.", 400);
    }

    const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId: session.id } },
    });
    if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return error("FORBIDDEN", "Active organization membership required.", 403);
    if (!session.isPlatformSuperAdmin && membership?.role !== "ORG_ADMIN" && membership?.role !== "MENTOR") return error("FORBIDDEN", "Only administrators and mentors can create learning paths.", 403);

    if (cohortId) {
      const cohort = await prisma.cohort.findFirst({ where: { id: cohortId, organizationId, status: "ACTIVE" }, include: { mentors: true } });
      if (!cohort) return error("INVALID_COHORT", "Choose an active cohort in this organization.", 400);
      if (membership?.role === "MENTOR" && !cohort.mentors.some((mentor) => mentor.mentorId === session.id)) {
        return error("FORBIDDEN", "You can create learning paths only for cohorts assigned to you.", 403);
      }
    } else if (membership?.role === "MENTOR") {
      return error("COHORT_REQUIRED", "Mentor-created learning paths must belong to one of your assigned cohorts.", 400);
    }

    const path = await prisma.learningPath.create({
      data: {
        organizationId,
        cohortId,
        title,
        description: description || null,
        createdById: session.id,
        visibility: cohortId ? "COHORT" : "ORGANIZATION",
        milestones: { create: cleanedMilestones.map((item: { title: string; description: string | null }, index: number) => ({ ...item, sortOrder: index })) },
      },
      include: { cohort: { select: { id: true, name: true } }, milestones: { orderBy: { sortOrder: "asc" } } },
    });
    await logAudit({ organizationId, actorId: session.id, action: "LEARNING_PATH_CREATED", targetType: "LearningPath", targetId: path.id, metadata: { title, cohortId, milestoneCount: milestones.length } });
    return NextResponse.json({ success: true, path }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Could not create learning path.";
    return error("LEARNING_PATH_CREATE_FAILED", message, 400);
  }
}
