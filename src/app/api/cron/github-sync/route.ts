import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { syncSelectedGitHubRepository } from "@/features/github/public-repository-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron endpoint for polling member-selected public repositories.
 * GitHub App webhooks do not cover public repositories from organizations
 * that have not installed this app, so these repositories need API polling.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Keep unauthenticated GitHub API use below its per-IP hourly limit.
  // Six repositories × three API calls × two runs/hour = 36 requests/hour.
  const now = Date.now();
  const staleBefore = new Date(now - 30 * 60 * 1000);
  const retryFailedBefore = new Date(now - 60 * 60 * 1000);
  const repositories = await prisma.repository.findMany({
    where: {
      visibility: "public",
      syncStatus: { in: ["ACTIVE", "ERROR"] },
      AND: [
        { OR: [
          { syncStatus: "ACTIVE", OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: staleBefore } }] },
          { syncStatus: "ERROR", updatedAt: { lt: retryFailedBefore } },
        ] },
        { OR: [{ memberRepositories: { some: {} } }, { cohortRepositories: { some: { trackingEnabled: true } } }] },
      ],
    },
    orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }, { updatedAt: "asc" }],
    take: 6,
    select: { id: true, organizationId: true, fullName: true },
  });

  const results: Array<{ repository: string; ok: boolean; activitiesProcessed?: number; error?: string }> = [];
  for (const repository of repositories) {
    try {
      const result = await syncSelectedGitHubRepository(repository.id, repository.organizationId);
      results.push({ repository: repository.fullName, ok: true, activitiesProcessed: result.activitiesProcessed });
    } catch (error) {
      results.push({
        repository: repository.fullName,
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 200) : "Repository sync failed.",
      });
    }
  }

  return NextResponse.json({
    success: results.every((result) => result.ok),
    checked: results.length,
    results,
    nextRunAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}
