import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { AttendanceRecordSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  try {
    const parsed = AttendanceRecordSchema.safeParse({ ...(await req.json()), eventId: params.id });
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    const { userId, status, note } = parsed.data;
    const event = await prisma.event.findUnique({ where: { id: params.id } });
    if (!event) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Event not found" } }, { status: 404 });
    const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: event.organizationId, userId: session.id } } });
    if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });
    let canRecord = session.isPlatformSuperAdmin || membership?.role === "ORG_ADMIN";
    if (membership?.role === "MENTOR" && event.cohortId) {
      const assignment = await prisma.cohortMentor.findFirst({ where: { cohortId: event.cohortId, mentorId: session.id, cohort: { organizationId: event.organizationId, status: "ACTIVE" } } });
      canRecord = Boolean(assignment);
    }
    if (!canRecord) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only an administrator or assigned cohort mentor can record attendance" } }, { status: 403 });
    const targetMembership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: event.organizationId, userId } } });
    if (targetMembership?.status !== "ACTIVE" || targetMembership.role !== "MENTEE") return NextResponse.json({ error: { code: "INVALID_ATTENDEE", message: "Attendance can only be recorded for an active mentee in this organization." } }, { status: 400 });
    if (event.cohortId) {
      const enrolled = await prisma.cohortEnrollment.findFirst({ where: { cohortId: event.cohortId, menteeId: userId, status: "ACTIVE", cohort: { organizationId: event.organizationId, status: "ACTIVE" } } });
      if (!enrolled) return NextResponse.json({ error: { code: "INVALID_ATTENDEE", message: "Mentee is not enrolled in this active event cohort" } }, { status: 400 });
    }
    const attendance = await prisma.attendance.upsert({
      where: { eventId_userId: { eventId: params.id, userId } },
      create: { eventId: params.id, userId, status, note, recordedById: session.id },
      update: { status, note, recordedById: session.id, recordedAt: new Date() },
    });
    await logAudit({ organizationId: event.organizationId, actorId: session.id, action: "ATTENDANCE_RECORDED", targetType: "Attendance", targetId: attendance.id, metadata: { eventId: params.id, userId, status } });
    return NextResponse.json({ success: true, attendance });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Attendance recording failed";
    return NextResponse.json({ error: { code: "ATTENDANCE_FAILED", message: msg } }, { status: 400 });
  }
}
