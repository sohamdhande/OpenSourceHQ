import React from "react";
import Link from "next/link";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { isGitHubConfigured } from "@/features/github/github-service";
import { computeGitHubStats } from "@/features/github/github-stats";
import { GitHubCommandCenter } from "@/components/github/github-command-center";

export default async function SelfGitHubPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug } });
  if (!org) return null;

  const ghAccount = await prisma.gitHubAccount.findFirst({
    where: { userId: session.id },
    orderBy: { connectedAt: "desc" },
  });
  const isConnected = ghAccount?.connectionStatus === "CONNECTED";

  const selectedRepositories = await prisma.userRepository.findMany({
    where: { organizationId: org.id, userId: session.id },
    include: {
      repository: { select: { id: true, fullName: true, url: true, visibility: true, lastSyncedAt: true } },
    },
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

  const stats = computeGitHubStats(allActivitiesForStats);
  const githubConfigured = isGitHubConfigured();

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="border-b border-white/10 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Github className="w-5 h-5" />
            Personal GitHub Telemetry
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Track commits, pull requests, and issues from your connected GitHub account.
          </p>
        </div>

        <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mx-auto text-white">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">GitHub Account Not Connected</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                Connect your GitHub account in your personal self-tracking profile to sync commits and pull requests.
              </p>
            </div>
            {githubConfigured ? (
              <Link href="/api/auth/github?mode=link">
                <Button size="sm" className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 gap-1.5">
                  <Github className="w-4 h-4" />
                  Connect GitHub Account
                </Button>
              </Link>
            ) : (
              <p className="text-xs text-amber-300">GitHub OAuth is not configured on this server.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <GitHubCommandCenter
      ghAccount={{
        id: ghAccount.id,
        username: ghAccount.username,
        avatarUrl: ghAccount.avatarUrl,
        profileUrl: ghAccount.profileUrl,
        connectedAt: ghAccount.connectedAt,
      }}
      githubStats={stats}
      githubActivities={activities}
    />
  );
}
