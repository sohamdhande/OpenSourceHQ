import prisma from "@/lib/db";
import { AttendanceStatus } from "@prisma/client";
import { SessionUser } from "@/server/auth/session";
import { logAudit } from "@/lib/audit";

export async function listAnnouncements(organizationId: string, cohortId?: string | null) {
  return prisma.announcement.findMany({
    where: {
      organizationId,
      ...(cohortId ? { OR: [{ cohortId }, { cohortId: null }] } : {}),
      archivedAt: null,
    },
    include: {
      author: { select: { id: true, name: true } },
    },
    orderBy: { publishedAt: "desc" },
  });
}

export async function createAnnouncement(
  user: SessionUser,
  organizationId: string,
  title: string,
  body: string,
  cohortId?: string | null
) {
  const announcement = await prisma.announcement.create({
    data: {
      organizationId,
      cohortId,
      authorId: user.id,
      title,
      body,
    },
  });

  await logAudit({
    organizationId,
    actorId: user.id,
    action: "ANNOUNCEMENT_CREATED",
    targetType: "Announcement",
    targetId: announcement.id,
    metadata: { title, cohortId },
  });

  return announcement;
}

export async function listEvents(organizationId: string, cohortId?: string | null) {
  return prisma.event.findMany({
    where: {
      organizationId,
      ...(cohortId ? { OR: [{ cohortId }, { cohortId: null }] } : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { attendances: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function recordAttendance(
  user: SessionUser,
  eventId: string,
  targetUserId: string,
  status: AttendanceStatus,
  note?: string | null
) {
  const attendance = await prisma.attendance.upsert({
    where: {
      eventId_userId: {
        eventId,
        userId: targetUserId,
      },
    },
    create: {
      eventId,
      userId: targetUserId,
      status,
      note,
      recordedById: user.id,
    },
    update: {
      status,
      note,
      recordedById: user.id,
      recordedAt: new Date(),
    },
  });

  return attendance;
}

