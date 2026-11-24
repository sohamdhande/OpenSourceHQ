import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
  });

  const activeMembership = notification?.organizationId
    ? await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: notification.organizationId, userId: session.id } }, select: { status: true } })
    : null;
  if (!notification || notification.userId !== session.id || (notification.organizationId && activeMembership?.status !== "ACTIVE")) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Notification not found" } }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id: params.id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true, notification: updated });
}

