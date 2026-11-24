import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { AnnouncementCreateSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);
  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: params.orgId, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return apiError("FORBIDDEN", "Active organization membership required", 403);

  const cohortId = req.nextUrl.searchParams.get("cohortId");
  const where: Record<string, unknown> = { organizationId: params.orgId, archivedAt: null };
  if (membership?.role === "MENTEE") {
    const enrollments = await prisma.cohortEnrollment.findMany({ where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId: params.orgId, status: "ACTIVE" } }, select: { cohortId: true } });
    const cohortIds = enrollments.map((row) => row.cohortId);
    if (cohortId && !cohortIds.includes(cohortId)) return apiError("FORBIDDEN", "You are not enrolled in this cohort", 403);
    where.OR = [{ cohortId: null }, { cohortId: { in: cohortIds } }];
    if (cohortId) where.cohortId = cohortId;
  } else if (membership?.role === "MENTOR") {
    const assignments = await prisma.cohortMentor.findMany({ where: { mentorId: session.id, cohort: { organizationId: params.orgId, status: "ACTIVE" } }, select: { cohortId: true } });
    const cohortIds = assignments.map((row) => row.cohortId);
    if (cohortId && !cohortIds.includes(cohortId)) return apiError("FORBIDDEN", "You are not assigned to this cohort", 403);
    where.OR = [{ cohortId: null }, { cohortId: { in: cohortIds } }];
    if (cohortId) where.cohortId = cohortId;
  } else if (membership?.role === "OBSERVER") {
    if (cohortId) return apiError("FORBIDDEN", "Observers can view organization-wide announcements only", 403);
    where.cohortId = null;
  } else if (cohortId) {
    where.cohortId = cohortId;
  }

  const announcements = await prisma.announcement.findMany({
    where,
    include: { cohort: { select: { id: true, name: true } }, author: { select: { id: true, name: true } } },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
  });
  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);
  try {
    const body = await req.json();
    const parsed = AnnouncementCreateSchema.safeParse({ ...(body && typeof body === "object" ? body : {}), organizationId: params.orgId });
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.message, 400);

    const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: params.orgId, userId: session.id } } });
    if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return apiError("FORBIDDEN", "Active organization membership required", 403);
    if (!session.isPlatformSuperAdmin && membership?.role !== "ORG_ADMIN" && membership?.role !== "MENTOR") return apiError("FORBIDDEN", "Only administrators and assigned mentors can publish announcements", 403);

    if (parsed.data.cohortId) {
      const cohort = await prisma.cohort.findUnique({ where: { id: parsed.data.cohortId }, include: { mentors: true } });
      if (!cohort || cohort.organizationId !== params.orgId || cohort.status !== "ACTIVE") return apiError("INVALID_COHORT", "Selected cohort must be active and belong to this organization", 400);
      if (membership?.role === "MENTOR" && !cohort.mentors.some((mentor) => mentor.mentorId === session.id)) return apiError("FORBIDDEN", "You can publish cohort announcements only for cohorts assigned to you", 403);
    } else if (membership?.role === "MENTOR") {
      return apiError("COHORT_REQUIRED", "Mentor announcements must target one of your assigned cohorts", 400);
    }

    const organization = await prisma.organization.findUnique({ where: { id: params.orgId }, select: { slug: true } });
    if (!organization) return apiError("NOT_FOUND", "Organization not found", 404);
    const announcement = await prisma.announcement.create({
      data: {
        organizationId: params.orgId,
        cohortId: parsed.data.cohortId || null,
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
        isPinned: parsed.data.isPinned,
        authorId: session.id,
      },
      include: { cohort: { select: { id: true, name: true } }, author: { select: { id: true, name: true } } },
    });

    const recipients = await prisma.organizationMembership.findMany({
      where: {
        organizationId: params.orgId,
        status: "ACTIVE",
        ...(parsed.data.cohortId ? { role: "MENTEE", user: { cohortEnrollments: { some: { cohortId: parsed.data.cohortId, status: "ACTIVE" } } } } : {}),
      },
      select: { userId: true, role: true },
    });
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          organizationId: params.orgId,
          userId: recipient.userId,
          type: "ANNOUNCEMENT",
          title: `Announcement: ${announcement.title}`,
          body: announcement.body.substring(0, 140),
          targetUrl: `/org/${organization.slug}/${recipient.role === "ORG_ADMIN" ? "admin" : recipient.role === "MENTOR" ? "mentor" : recipient.role === "OBSERVER" ? "observer" : "student"}`,
        })),
      });
    }

    await logAudit({ organizationId: params.orgId, actorId: session.id, action: "ANNOUNCEMENT_CREATED", targetType: "Announcement", targetId: announcement.id, metadata: { title: announcement.title, isPinned: announcement.isPinned, cohortId: announcement.cohortId } });
    return NextResponse.json({ success: true, announcement }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Announcement creation failed";
    return apiError("ANNOUNCEMENT_CREATE_FAILED", message, 400);
  }
}
