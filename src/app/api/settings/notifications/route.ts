import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  let pref = await prisma.notificationPreference.findUnique({
    where: { userId: session.id },
  });

  if (!pref) {
    pref = await prisma.notificationPreference.create({
      data: { userId: session.id },
    });
  }

  return NextResponse.json({ preferences: pref });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const body = await req.json();

  const pref = await prisma.notificationPreference.upsert({
    where: { userId: session.id },
    create: {
      userId: session.id,
      emailOnTaskAssignment: body.emailOnTaskAssignment ?? true,
      emailOnReportReview: body.emailOnReportReview ?? true,
      emailOnFeedback: body.emailOnFeedback ?? true,
      emailOnAnnouncement: body.emailOnAnnouncement ?? true,
      inAppNotifications: body.inAppNotifications ?? true,
    },
    update: {
      emailOnTaskAssignment: body.emailOnTaskAssignment,
      emailOnReportReview: body.emailOnReportReview,
      emailOnFeedback: body.emailOnFeedback,
      emailOnAnnouncement: body.emailOnAnnouncement,
      inAppNotifications: body.inAppNotifications,
    },
  });

  return NextResponse.json({ success: true, preferences: pref });
}

