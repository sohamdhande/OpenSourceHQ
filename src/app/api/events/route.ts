import { formatDate } from "@/lib/date";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { EventCreateSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId") || session.activeOrgId;
  const cohortId = searchParams.get("cohortId");
  if (!organizationId) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "organizationId required" } }, { status: 400 });

  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });

  const where: any = { organizationId };
  if (membership?.role === "MENTEE") {
    const enrollments = await prisma.cohortEnrollment.findMany({ where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } }, select: { cohortId: true } });
    const cohortIds = enrollments.map((item) => item.cohortId);
    if (cohortId && !cohortIds.includes(cohortId)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not enrolled in this cohort" } }, { status: 403 });
    where.OR = [{ cohortId: null }, { cohortId: { in: cohortIds } }];
    if (cohortId) where.cohortId = cohortId;
  } else if (membership?.role === "MENTOR") {
    const assignments = await prisma.cohortMentor.findMany({ where: { mentorId: session.id, cohort: { organizationId, status: "ACTIVE" } }, select: { cohortId: true } });
    const cohortIds = assignments.map((item) => item.cohortId);
    if (cohortId && !cohortIds.includes(cohortId)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not assigned to this cohort" } }, { status: 403 });
    where.OR = [{ cohortId: null }, { cohortId: { in: cohortIds } }];
    if (cohortId) where.cohortId = cohortId;
  } else if (membership?.role === "OBSERVER") {
    if (cohortId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Observers can only view organization-wide events." } }, { status: 403 });
    where.cohortId = null;
  } else if (cohortId) where.cohortId = cohortId;

  const canManageAttendance = session.isPlatformSuperAdmin || membership?.role === "ORG_ADMIN" || membership?.role === "MENTOR";
  const events = await prisma.event.findMany({
    where,
    include: {
      cohort: true,
      createdBy: { select: { id: true, name: true } },
      rsvps: canManageAttendance ? true : { where: { userId: session.id } },
      attendances: canManageAttendance ? { include: { user: { select: { id: true, name: true, email: true } } } } : false,
    },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  try {
    const parsed = EventCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    const { organizationId, cohortId, title, description, startsAt, endsAt, meetingUrl, location } = parsed.data;
    const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: session.id } } });
    if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });
    if (!session.isPlatformSuperAdmin && membership?.role !== "ORG_ADMIN" && membership?.role !== "MENTOR") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only administrators and assigned mentors can schedule events" } }, { status: 403 });

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return NextResponse.json({ error: { code: "INVALID_EVENT_TIME", message: "Event end time must be later than its start time" } }, { status: 400 });

    if (cohortId) {
      const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, include: { mentors: true } });
      if (!cohort || cohort.organizationId !== organizationId || cohort.status !== "ACTIVE") return NextResponse.json({ error: { code: "INVALID_COHORT", message: "Select an active cohort in this organization" } }, { status: 400 });
      if (membership?.role === "MENTOR" && !cohort.mentors.some((mentor) => mentor.mentorId === session.id)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You can schedule events only for cohorts assigned to you" } }, { status: 403 });
    } else if (membership?.role === "MENTOR") {
      return NextResponse.json({ error: { code: "COHORT_REQUIRED", message: "Mentor-created events must target one of your assigned cohorts" } }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true, timezone: true } });
    if (!organization) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Organization not found" } }, { status: 404 });
    const timezone = parsed.data.timezone || organization.timezone || "UTC";
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); }
    catch { return NextResponse.json({ error: { code: "INVALID_TIMEZONE", message: "The event timezone is not a valid IANA timezone." } }, { status: 400 }); }
    const event = await prisma.event.create({
      data: { organizationId, cohortId: cohortId || null, title, description, startsAt: start, endsAt: end, timezone, meetingUrl: meetingUrl || null, location: location || null, createdById: session.id },
      include: { cohort: true },
    });
    const recipients = await prisma.organizationMembership.findMany({
      where: { organizationId, role: "MENTEE", status: "ACTIVE", ...(cohortId ? { user: { cohortEnrollments: { some: { cohortId, status: "ACTIVE" } } } } : {}) },
      select: { userId: true },
    });
    if (recipients.length) await prisma.notification.createMany({ data: recipients.map(({ userId }) => ({
      organizationId, userId, type: "EVENT_SCHEDULED", title: `New Event: ${title}`,
      body: `Scheduled for ${formatDate(start)}. Check details and RSVP.`, targetUrl: `/org/${organization.slug}/student/events`,
    })) });
    await logAudit({ organizationId, actorId: session.id, action: "EVENT_CREATED", targetType: "Event", targetId: event.id, metadata: { title, startsAt: start.toISOString() } });
    return NextResponse.json({ success: true, event });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Event creation failed";
    return NextResponse.json({ error: { code: "EVENT_CREATE_FAILED", message: msg } }, { status: 400 });
  }
}
