import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";

/**
 * GET /api/github/my-activity?organizationId=...&date=YYYY-MM-DD
 * Returns verified GitHub activity for the authenticated user on the requested date
 * (or recent 48h window if no exact date events exist) to assist with Daily Log entry.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId");
  const dateParam = searchParams.get("date");

  if (!organizationId) {
    return NextResponse.json({ error: { message: "organizationId is required" } }, { status: 400 });
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.id } },
    select: { status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }

  const ghAccount = await prisma.gitHubAccount.findFirst({
    where: { userId: session.id, connectionStatus: "CONNECTED" },
    select: { id: true, username: true },
  });
  if (!ghAccount) {
    return NextResponse.json({ activities: [], scope: "none", connected: false });
  }

  const selectedRepos = await prisma.userRepository.findMany({
    where: { organizationId, userId: session.id },
    select: { repositoryId: true },
  });
  const selectedRepoIds = selectedRepos.map((r) => r.repositoryId);

  const baseWhere = {
    organizationId,
    githubAccountId: ghAccount.id,
    isFixture: false,
    ...(selectedRepoIds.length > 0 ? { repositoryId: { in: selectedRepoIds } } : {}),
  };

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const start = new Date(`${dateParam}T00:00:00.000Z`);
    const end = new Date(`${dateParam}T23:59:59.999Z`);
    // Widen by +-12h to accommodate organization timezones cleanly
    start.setUTCHours(start.getUTCHours() - 12);
    end.setUTCHours(end.getUTCHours() + 12);

    const dayActivities = await prisma.gitHubActivity.findMany({
      where: {
        ...baseWhere,
        occurredAt: { gte: start, lte: end },
      },
      include: { repository: { select: { fullName: true } } },
      orderBy: { occurredAt: "desc" },
      take: 25,
    });

    if (dayActivities.length > 0) {
      return NextResponse.json({
        connected: true,
        scope: "date",
        activities: dayActivities.map((a) => ({
          id: a.id,
          activityType: a.activityType,
          title: a.title,
          url: a.url,
          occurredAt: a.occurredAt.toISOString(),
          repoFullName: a.repository?.fullName || null,
        })),
      });
    }
  }

  // Fallback to last 10 recent verified activities so mentees still get useful items
  const recentActivities = await prisma.gitHubActivity.findMany({
    where: baseWhere,
    include: { repository: { select: { fullName: true } } },
    orderBy: { occurredAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    connected: true,
    scope: "recent",
    activities: recentActivities.map((a) => ({
      id: a.id,
      activityType: a.activityType,
      title: a.title,
      url: a.url,
      occurredAt: a.occurredAt.toISOString(),
      repoFullName: a.repository?.fullName || null,
    })),
  });
}

