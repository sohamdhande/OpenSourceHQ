import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { canManageOrganization } from "@/server/authorization/policies";
import { syncSelectedGitHubRepository } from "@/features/github/public-repository-sync";
import { logAudit } from "@/lib/audit";

const SYNC_COOLDOWN_MS = 30 * 60 * 1000;
const ERROR_RETRY_WINDOW_MS = 60 * 60 * 1000;

export async function POST(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const allowed = await canManageOrganization(session, params.orgId);
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Organization administrator access required" } },
      { status: 403 }
    );
  }

  const repositories = await prisma.repository.findMany({
    where: { organizationId: params.orgId, syncStatus: { not: "PAUSED" } },
    orderBy: { fullName: "asc" },
  });

  if (repositories.length === 0) {
    return NextResponse.json({
      success: true,
      summary: { total: 0, synced: 0, skippedCooldown: 0, failed: 0, totalActivities: 0 },
      results: [],
    });
  }

  const now = Date.now();
  const results: Array<{
    repositoryId: string;
    fullName: string;
    status: "synced" | "cooldown" | "failed";
    activitiesProcessed?: number;
    activityCount?: number;
    message?: string;
  }> = [];

  let synced = 0;
  let skippedCooldown = 0;
  let failed = 0;
  let totalActivities = 0;

  const eligibleRepos: typeof repositories = [];
  for (const repo of repositories) {
    const recentlySynced = repo.lastSyncedAt && now - repo.lastSyncedAt.getTime() < SYNC_COOLDOWN_MS;
    const recentlyFailed = repo.syncStatus === "ERROR" && now - repo.updatedAt.getTime() < ERROR_RETRY_WINDOW_MS;

    if (recentlySynced || recentlyFailed) {
      skippedCooldown += 1;
      results.push({
        repositoryId: repo.id,
        fullName: repo.fullName,
        status: "cooldown",
        message: recentlyFailed
          ? "Recently failed; waiting for retry window."
          : "Recently synced within the 30-minute cooldown window.",
      });
    } else {
      eligibleRepos.push(repo);
    }
  }

  const SYNC_CONCURRENCY = 3;
  for (let i = 0; i < eligibleRepos.length; i += SYNC_CONCURRENCY) {
    const batch = eligibleRepos.slice(i, i + SYNC_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (repo) => {
        try {
          const result = await syncSelectedGitHubRepository(repo.id, params.orgId);
          const activityCount = await prisma.gitHubActivity.count({ where: { repositoryId: repo.id } });
          return {
            repositoryId: repo.id,
            fullName: repo.fullName,
            status: "synced" as const,
            activitiesProcessed: result.activitiesProcessed,
            activityCount,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Repository sync failed";
          return {
            repositoryId: repo.id,
            fullName: repo.fullName,
            status: "failed" as const,
            message,
          };
        }
      })
    );

    for (const item of batchResults) {
      if (item.status === "synced") {
        synced += 1;
        totalActivities += item.activitiesProcessed;
      } else {
        failed += 1;
      }
      results.push(item);
    }
  }

  await logAudit({
    organizationId: params.orgId,
    actorId: session.id,
    action: "GITHUB_ORG_REPOSITORIES_SYNCED",
    targetType: "Organization",
    targetId: params.orgId,
    metadata: { total: repositories.length, synced, skippedCooldown, failed, totalActivities },
  });

  return NextResponse.json({
    success: true,
    summary: {
      total: repositories.length,
      synced,
      skippedCooldown,
      failed,
      totalActivities,
    },
    results,
  });
}

