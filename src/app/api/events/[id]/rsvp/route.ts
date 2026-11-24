import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { EventRsvpSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Event not found" } }, { status: 404 });
  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: event.organizationId, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });
  if (membership?.role === "OBSERVER") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Observer access is read-only" } }, { status: 403 });
  if (event.cohortId && membership?.role === "MENTEE") {
    const [enrolled, cohort] = await Promise.all([
      prisma.cohortEnrollment.findUnique({ where: { cohortId_menteeId: { cohortId: event.cohortId, menteeId: session.id } } }),
      prisma.cohort.findUnique({ where: { id: event.cohortId }, select: { status: true } }),
    ]);
    if (enrolled?.status !== "ACTIVE" || cohort?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not actively enrolled in the event cohort" } }, { status: 403 });
  }
  if (event.cohortId && membership?.role === "MENTOR") {
    const [assigned, cohort] = await Promise.all([
      prisma.cohortMentor.findUnique({ where: { cohortId_mentorId: { cohortId: event.cohortId, mentorId: session.id } } }),
      prisma.cohort.findUnique({ where: { id: event.cohortId }, select: { status: true } }),
    ]);
    if (!assigned || cohort?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not assigned to an active event cohort" } }, { status: 403 });
  }
  if (event.endsAt <= new Date()) return NextResponse.json({ error: { code: "EVENT_CLOSED", message: "RSVPs are closed because this event has ended." } }, { status: 409 });
  const parsed = EventRsvpSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
  if (parsed.data.isExcuseRequested && (parsed.data.status !== "NO" || (parsed.data.excuseReason?.trim().length ?? 0) < 5)) {
    return NextResponse.json({ error: { code: "INVALID_ABSENCE_REQUEST", message: "An absence request must use the Not attending response and include a reason of at least 5 characters." } }, { status: 400 });
  }
  const rsvp = await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId: params.id, userId: session.id } },
    create: { eventId: params.id, userId: session.id, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ success: true, rsvp });
}
