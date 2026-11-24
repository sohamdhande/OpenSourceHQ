import React from "react";
import Link from "next/link";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Github, AlertTriangle } from "lucide-react";
import { isGitHubConfigured } from "@/features/github/github-service";
import { computeGitHubStats } from "@/features/github/github-stats";
import { GitHubCommandCenter } from "@/components/github/github-command-center";

export default async function StudentGitHubPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const ghAccount = await prisma.gitHubAccount.findFirst({
    where: { userId: session.id },
    orderBy: { connectedAt: "desc" },
  });
  const isConnected = ghAccount?.connectionStatus === "CONNECTED";
  const selectedRepositories = await prisma.userRepository.findMany({
    where: { organizationId: org.id, userId: session.id },
    include: { repository: { select: { id: true, fullName: true, url: true, visibility: true, lastSyncedAt: true } } },
    orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }],
  });
  const selectedRepositoryIds = selectedRepositories.map((item) => item.repositoryId);

  const activityWhere =
    isConnected && ghAccount && selectedRepositoryIds.length
      ? {
          githubAccountId: ghAccount.id,
          organizationId: org.id,
          repositoryId: { in: selectedRepositoryIds },
          isFixture: false,
        }
      : null;

  const [activities, allActivitiesForStats] = activityWhere
    ? await Promise.all([
        prisma.gitHubActivity.findMany({
          where: activityWhere,
          include: { repository: { select: { fullName: true, url: true } } },
          orderBy: { occurredAt: "desc" },
          take: 50,
        }),
        prisma.gitHubActivity.findMany({
          where: activityWhere,
          select: {
            activityType: true,
            occurredAt: true,
            repository: { select: { name: true, fullName: true } },
          },
          orderBy: { occurredAt: "desc" },
        }),
      ])
    : [[], []];

  const githubStats = computeGitHubStats(allActivitiesForStats);
  const configured = isGitHubConfigured();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">GitHub Identity & Contributions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track your verified commits, pull requests, code reviews, and 52-week contribution cadence.
          </p>
        </div>

        {!isConnected && (
          <Link href={`/api/auth/github?action=link&redirectUrl=${encodeURIComponent(`/org/${org.slug}/student/github`)}`}>
            <Button size="sm" className="gap-2">
              <Github className="w-4 h-4" />
              {ghAccount ? "Reconnect GitHub" : "Connect GitHub"}
            </Button>
          </Link>
        )}
      </div>

      {!configured && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Live GitHub synchronization is not configured. Any fixture activity is labelled separately from verified GitHub activity.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Repositories in your workspace ({selectedRepositories.length})</CardTitle>
          <Link href={`/org/${org.slug}/student/repositories`}>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              Manage Repositories
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {selectedRepositories.length ? (
            <div className="flex flex-wrap gap-2">
              {selectedRepositories.map((item) => (
                <a
                  key={item.id}
                  href={item.repository.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/40"
                >
                  <Github className="h-3.5 w-3.5" />
                  {item.repository.fullName}
                  {item.isPrimary ? <Badge variant="default">Primary</Badge> : null}
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              No repositories selected yet.{" "}
              <Link className="font-medium text-primary hover:underline" href={`/org/${org.slug}/student/repositories`}>
                Choose repositories
              </Link>{" "}
              to start tracking your open-source work.
            </div>
          )}
        </CardContent>
      </Card>

      <GitHubCommandCenter
        ghAccount={
          isConnected && ghAccount
            ? {
                id: ghAccount.id,
                username: ghAccount.username,
                profileUrl: ghAccount.profileUrl,
                avatarUrl: ghAccount.avatarUrl,
                connectedAt: ghAccount.connectedAt.toISOString(),
                lastSyncedAt: ghAccount.lastSyncedAt?.toISOString() || null,
                connectionStatus: ghAccount.connectionStatus,
              }
            : null
        }
        githubStats={githubStats}
        githubActivities={activities}
      />
    </div>
  );
}
