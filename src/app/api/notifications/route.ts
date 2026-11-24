import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const activeMemberships = await prisma.organizationMembership.findMany({ where: { userId: session.id, status: "ACTIVE" }, select: { organizationId: true } });
  const visibleNotifications = { userId: session.id, OR: [{ organizationId: null }, { organizationId: { in: activeMemberships.map((item) => item.organizationId) } }] };
  const [notificationRows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: visibleNotifications,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({
      where: { ...visibleNotifications, readAt: null },
    }),
  ]);

  const notifications = notificationRows.map(({ readAt, ...notification }) => ({
    ...notification,
    read: readAt !== null,
  }));
  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const activeMemberships = await prisma.organizationMembership.findMany({ where: { userId: session.id, status: "ACTIVE" }, select: { organizationId: true } });
  await prisma.notification.updateMany({
    where: { userId: session.id, readAt: null, OR: [{ organizationId: null }, { organizationId: { in: activeMemberships.map((item) => item.organizationId) } }] },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

