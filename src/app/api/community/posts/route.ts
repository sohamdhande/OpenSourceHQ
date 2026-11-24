import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { listDiscussions, createDiscussionPost } from "@/features/community/community-service";
import { DiscussionPostCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  const organizationId = req.nextUrl.searchParams.get("organizationId") || session.activeOrgId;
  const cohortId = req.nextUrl.searchParams.get("cohortId");
  if (!organizationId) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "organizationId required" } }, { status: 400 });
  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });
  let allowedCohortIds: string[] | null = null;
  if (membership?.role === "MENTEE") {
    const rows = await prisma.cohortEnrollment.findMany({ where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } }, select: { cohortId: true } });
    allowedCohortIds = rows.map((row) => row.cohortId);
  } else if (membership?.role === "MENTOR") {
    const rows = await prisma.cohortMentor.findMany({ where: { mentorId: session.id, cohort: { organizationId, status: "ACTIVE" } }, select: { cohortId: true } });
    allowedCohortIds = rows.map((row) => row.cohortId);
  } else if (membership?.role === "OBSERVER") {
    allowedCohortIds = [];
  }
  if (cohortId && allowedCohortIds && !allowedCohortIds.includes(cohortId)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You do not have access to this cohort" } }, { status: 403 });
  const posts = await listDiscussions(organizationId, cohortId || undefined, allowedCohortIds);
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  try {
    const parsed = DiscussionPostCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    const { organizationId, cohortId, title, content } = parsed.data;
    const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: session.id } } });
    if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });
    if (membership?.role === "OBSERVER") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Observers have read-only community access" } }, { status: 403 });
    if (cohortId) {
      const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, include: { mentors: true } });
      if (!cohort || cohort.organizationId !== organizationId || cohort.status !== "ACTIVE") return NextResponse.json({ error: { code: "INVALID_COHORT", message: "Selected cohort does not belong to this organization" } }, { status: 400 });
      if (membership?.role === "MENTEE") {
        const enrollment = await prisma.cohortEnrollment.findUnique({ where: { cohortId_menteeId: { cohortId, menteeId: session.id } } });
        if (enrollment?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not enrolled in this cohort" } }, { status: 403 });
      }
      if (membership?.role === "MENTOR" && !cohort.mentors.some((mentor) => mentor.mentorId === session.id)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not assigned to this cohort" } }, { status: 403 });
    }
    const post = await createDiscussionPost(session, organizationId, title, content, cohortId);
    return NextResponse.json({ success: true, post });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Post creation failed";
    return NextResponse.json({ error: { code: "POST_FAILED", message: msg } }, { status: 400 });
  }
}
