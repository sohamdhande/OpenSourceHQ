import React from "react";
import Link from "next/link";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { formatDate, formatDateTime } from "@/lib/date";
import { computeReportingStreak, getDateKeyInTimeZone } from "@/lib/timezone";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  CheckSquare,
  ArrowRight,
  Flame,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  FolderGit2,
  Github,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

export default async function SelfTrackingDashboardPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const todayKey = getDateKeyInTimeZone(new Date(), org.timezone || "UTC");
  const today = new Date(`${todayKey}T00:00:00.000Z`);

  const [todaysReport, pastReports, githubAccount, selectedRepositories, personalTasks, openBlockers] =
    await Promise.all([
      prisma.dailyReport.findFirst({
        where: {
          organizationId: org.id,
          menteeId: session.id,
          cohortId: null,
          isSelfTracked: true,
          reportDate: today,
        },
        select: { id: true, status: true, submittedAt: true },
      }),
      prisma.dailyReport.findMany({
        where: {
          organizationId: org.id,
          menteeId: session.id,
          cohortId: null,
          isSelfTracked: true,
          status: { not: "DRAFT" },
        },
        select: { reportDate: true },
        orderBy: { reportDate: "desc" },
      }),
      prisma.gitHubAccount.findFirst({
        where: { userId: session.id },
        orderBy: { connectedAt: "desc" },
      }),
      prisma.userRepository.findMany({
        where: { organizationId: org.id, userId: session.id },
        include: {
          repository: {
            select: { id: true, fullName: true, url: true, syncStatus: true, lastSyncedAt: true },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }],
        take: 4,
      }),
      prisma.task.findMany({
        where: {
          organizationId: org.id,
          createdById: session.id,
          isSelfTracked: true,
          archivedAt: null,
        },
        include: {
          assignments: { where: { menteeId: session.id } },
          repository: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.blocker.findMany({
        where: {
          organizationId: org.id,
          menteeId: session.id,
          isSelfTracked: true,
          status: { in: ["OPEN", "IN_PROGRESS", "REOPENED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  // Compute personal streak
  const dateSet = new Set(pastReports.map((r) => r.reportDate.toISOString().split("T")[0]));
  const streak = computeReportingStreak(
    pastReports.map((r) => r.reportDate),
    today
  );

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    return {
      key,
      label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      logged: dateSet.has(key),
    };
  });

  const isGitHubConnected = githubAccount?.connectionStatus === "CONNECTED";
  const selectedRepoIds = selectedRepositories.map((r) => r.repositoryId);
  const recentActivities =
    isGitHubConnected && githubAccount && selectedRepoIds.length > 0
      ? await prisma.gitHubActivity.findMany({
          where: {
            organizationId: org.id,
            githubAccountId: githubAccount.id,
            repositoryId: { in: selectedRepoIds },
            isFixture: false,
          },
          include: { repository: { select: { fullName: true, url: true } } },
          orderBy: { occurredAt: "desc" },
          take: 8,
        })
      : [];

  const activeTasksCount = personalTasks.filter(
    (t) => (t.assignments[0]?.status || "TODO") !== "COMPLETED"
  ).length;
  const completedTasksCount = personalTasks.filter(
    (t) => t.assignments[0]?.status === "COMPLETED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Frosted Hero Header */}
      <div className="self-glass-surface rounded-3xl p-6 md:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-emerald-300">
            <Sparkles className="h-3 w-3" />
            <span>Private Personal Workspace</span>
          </div>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white">
            {session.name}&apos;s Open Source
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Independent contribution telemetry in {org.name} — completely separate from cohorts and reviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href={`/org/${params.orgSlug}/self/repositories`}>
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-white/[0.05] text-zinc-100 hover:bg-white/10 hover:border-white/25 gap-1.5 backdrop-blur-md"
            >
              <FolderGit2 className="h-3.5 w-3.5" />
              My Repositories
            </Button>
          </Link>
          <Link href={`/org/${params.orgSlug}/self/daily-log`}>
            <Button
              size="sm"
              className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.35)] gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              {todaysReport?.status === "SUBMITTED" ? "Update Today's Log" : "Submit Daily Log"}
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="self-glass-surface self-glass-surface-interactive rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span>Contribution Streak</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-500/15">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
            </span>
          </div>
          <p className="mt-2.5 text-2xl font-bold text-white tabular-nums">{streak} days</p>
          <p className="mt-1 text-[11px] text-zinc-400">{pastReports.length} total personal logs</p>
        </div>

        <div className="self-glass-surface self-glass-surface-interactive rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span>Today&apos;s Log</span>
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${todaysReport?.status === "SUBMITTED" ? "border-emerald-400/25 bg-emerald-500/15" : "border-white/10 bg-white/5"}`}>
              <CheckCircle2 className={`h-3.5 w-3.5 ${todaysReport?.status === "SUBMITTED" ? "text-emerald-400" : "text-zinc-400"}`} />
            </span>
          </div>
          <p className="mt-2.5 text-lg font-bold text-white">
            {todaysReport?.status === "SUBMITTED"
              ? "Logged"
              : todaysReport?.status === "DRAFT"
                ? "Draft Saved"
                : "Pending"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            {todaysReport?.submittedAt ? formatDateTime(todaysReport.submittedAt) : "No log submitted today yet"}
          </p>
        </div>

        <div className="self-glass-surface self-glass-surface-interactive rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span>Personal Tasks</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-400/25 bg-sky-500/15">
              <CheckSquare className="h-3.5 w-3.5 text-sky-400" />
            </span>
          </div>
          <p className="mt-2.5 text-2xl font-bold text-white tabular-nums">{activeTasksCount} open</p>
          <p className="mt-1 text-[11px] text-zinc-400">{completedTasksCount} completed</p>
        </div>

        <div className="self-glass-surface self-glass-surface-interactive rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span>Open Blockers</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/15">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            </span>
          </div>
          <p className="mt-2.5 text-2xl font-bold text-white tabular-nums">{openBlockers.length}</p>
          <p className="mt-1 text-[11px] text-zinc-400">Self-managed technical notes</p>
        </div>
      </div>

      {/* 7-Day Consistency Strip */}
      <div className="self-glass-surface rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <span className="text-xs font-semibold text-white block">Last 7 Days Check-in</span>
            <span className="text-[11px] text-zinc-400">Click any day to open or update your journal</span>
          </div>
          <Link href={`/org/${params.orgSlug}/self/reports`} className="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-1">
            View history <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {last7Days.map((day) => (
            <Link
              key={day.key}
              href={`/org/${params.orgSlug}/self/daily-log`}
              className={`rounded-xl border px-2 py-2.5 text-center text-[11px] transition-all ${
                day.logged
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 font-semibold shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-500/25"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200"
              }`}
            >
              <span className="block">{day.label}</span>
              <span className="mt-1 block text-[10px] font-mono">{day.key.slice(5)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* GitHub & Repositories */}
        <div className="self-glass-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github className="h-4 w-4 text-zinc-200" />
              <h2 className="text-sm font-semibold text-white">GitHub &amp; Selected Repositories</h2>
            </div>
            <Link href={`/org/${params.orgSlug}/self/github`} className="text-[11px] text-emerald-400 hover:underline">
              Full telemetry →
            </Link>
          </div>

          {!isGitHubConnected ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-xs text-zinc-400">
              <p>Connect your GitHub account to automatically track commits, pull requests, and issues.</p>
              <Link href={`/org/${params.orgSlug}/self/profile`} className="mt-2 inline-block text-emerald-400 hover:underline font-medium">
                Connect GitHub in Profile →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs">
                <span className="text-zinc-400">Connected as</span>
                <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  @{githubAccount.username}
                </span>
              </div>
              {selectedRepositories.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  No personal repositories selected yet.{" "}
                  <Link href={`/org/${params.orgSlug}/self/repositories`} className="text-emerald-400 hover:underline">
                    Select repositories →
                  </Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedRepositories.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors px-3.5 py-2.5 text-xs">
                      <a
                        href={item.repository.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-zinc-100 hover:text-emerald-300 inline-flex items-center gap-1.5"
                      >
                        {item.repository.fullName}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {item.repository.lastSyncedAt ? `Synced ${formatDate(item.repository.lastSyncedAt)}` : "Not synced"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Personal Tasks & Blockers */}
        <div className="self-glass-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">Active Personal Tasks</h2>
            </div>
            <Link href={`/org/${params.orgSlug}/self/tasks`} className="text-[11px] text-emerald-400 hover:underline">
              Manage tasks →
            </Link>
          </div>

          {personalTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-xs text-zinc-400">
              No personal tasks yet. Create your own open-source milestones and track them independently.
            </div>
          ) : (
            <div className="space-y-2">
              {personalTasks.map((task) => {
                const status = task.assignments[0]?.status || "TODO";
                return (
                  <div key={task.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors px-3.5 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-100 truncate">{task.title}</p>
                      {task.repository && (
                        <p className="text-[10px] font-mono text-zinc-400">{task.repository.fullName}</p>
                      )}
                    </div>
                    <Badge variant={status === "COMPLETED" ? "success" : "secondary"} className="text-[10px] shrink-0">
                      {status.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {openBlockers.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Open Personal Blockers
                </span>
                <Link href={`/org/${params.orgSlug}/self/blockers`} className="text-[11px] text-emerald-400 hover:underline">
                  Manage →
                </Link>
              </div>
              <div className="space-y-1.5">
                {openBlockers.slice(0, 3).map((b) => (
                  <div key={b.id} className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-zinc-100 truncate">
                    {b.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent GitHub Activity */}
      <div className="self-glass-surface rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Recent GitHub Activity</h2>
          <Link href={`/org/${params.orgSlug}/self/github`} className="text-[11px] text-emerald-400 hover:underline">
            View all →
          </Link>
        </div>
        {recentActivities.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No synced activity on your selected repositories yet. Select repositories and run a sync from My Repositories.
          </p>
        ) : (
          <ActivityTimeline
            items={recentActivities.map((a) => ({
              id: a.id,
              activityType: a.activityType,
              title: a.title,
              summary: a.repository?.fullName || null,
              occurredAt: a.occurredAt,
              url: a.url,
            }))}
          />
        )}
      </div>
    </div>
  );
}
