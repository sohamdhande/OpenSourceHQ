import type { GitHubStats } from "@/components/github/github-command-center";

export interface RawGitHubActivityForStats {
  activityType: string;
  occurredAt: Date;
  repository: { name: string; fullName: string } | null;
}

/**
 * Computes aggregated GitHub contribution metrics, repository breakdown,
 * and daily heatmap counts from a list of GitHubActivity rows.
 */
export function computeGitHubStats(activities: RawGitHubActivityForStats[]): GitHubStats {
  const activityByType: Record<string, number> = {};
  const dayCounts = new Map<string, number>();
  const repoCounts = new Map<string, { repoName: string; repoFullName: string; count: number }>();

  let totalCommits = 0;
  let totalPRsOpened = 0;
  let totalPRsMerged = 0;
  let totalPRsClosed = 0;
  let totalIssuesOpened = 0;
  let totalIssuesClosed = 0;
  let totalReviewsGiven = 0;
  let totalComments = 0;
  let totalReleasesPublished = 0;

  for (const act of activities) {
    activityByType[act.activityType] = (activityByType[act.activityType] || 0) + 1;

    switch (act.activityType) {
      case "COMMIT":
        totalCommits++;
        break;
      case "PULL_REQUEST_OPENED":
        totalPRsOpened++;
        break;
      case "PULL_REQUEST_MERGED":
        totalPRsMerged++;
        break;
      case "PULL_REQUEST_CLOSED":
        totalPRsClosed++;
        break;
      case "ISSUE_OPENED":
        totalIssuesOpened++;
        break;
      case "ISSUE_CLOSED":
        totalIssuesClosed++;
        break;
      case "REVIEW_SUBMITTED":
        totalReviewsGiven++;
        break;
      case "COMMENT_CREATED":
        totalComments++;
        break;
      case "RELEASE_PUBLISHED":
        totalReleasesPublished++;
        break;
    }

    const dayKey = act.occurredAt.toISOString().split("T")[0];
    dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);

    if (act.repository) {
      const key = act.repository.fullName;
      const existing = repoCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        repoCounts.set(key, {
          repoName: act.repository.name,
          repoFullName: act.repository.fullName,
          count: 1,
        });
      }
    }
  }

  const repoBreakdown = Array.from(repoCounts.values()).sort((a, b) => b.count - a.count);
  const activityByDay = Array.from(dayCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const firstActivityDate =
    activities.length > 0 ? activities[activities.length - 1].occurredAt.toISOString() : null;
  const lastActivityDate = activities.length > 0 ? activities[0].occurredAt.toISOString() : null;

  return {
    totalCommits,
    totalPRsOpened,
    totalPRsMerged,
    totalPRsClosed,
    totalIssuesOpened,
    totalIssuesClosed,
    totalReviewsGiven,
    totalComments,
    totalReleasesPublished,
    repoBreakdown,
    activityByDay,
    activityByType,
    firstActivityDate,
    lastActivityDate,
  };
}

