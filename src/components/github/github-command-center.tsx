"use client";

import React, { useMemo, useState } from "react";
import { formatDate, formatDateTime } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import {
  Github,
  ExternalLink,
  GitCommitHorizontal,
  GitPullRequest,
  GitMerge,
  Eye,
  MessageSquare,
  FolderGit2,
  Activity,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Tag,
  Flame,
  X,
} from "lucide-react";

export interface GitHubStats {
  totalCommits: number;
  totalPRsOpened: number;
  totalPRsMerged: number;
  totalPRsClosed: number;
  totalIssuesOpened: number;
  totalIssuesClosed: number;
  totalReviewsGiven: number;
  totalComments: number;
  totalReleasesPublished: number;
  repoBreakdown: Array<{ repoName: string; repoFullName: string; count: number }>;
  activityByDay: Array<{ date: string; count: number }>;
  activityByType: Record<string, number>;
  firstActivityDate: string | null;
  lastActivityDate: string | null;
}

interface GitHubAccountInfo {
  id: string;
  username: string;
  profileUrl: string;
  avatarUrl?: string | null;
  connectedAt: string | Date;
  lastSyncedAt?: string | Date | null;
  connectionStatus?: string;
}

interface GitHubCommandCenterProps {
  ghAccount?: GitHubAccountInfo | null;
  githubStats: GitHubStats;
  githubActivities: any[];
}

export function GitHubCommandCenter({
  ghAccount,
  githubStats,
  githubActivities,
}: GitHubCommandCenterProps) {
  const [eventSearch, setEventSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("ALL");
  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number } | null>(null);

  const totalEvents =
    githubStats.totalCommits +
    githubStats.totalPRsOpened +
    githubStats.totalPRsMerged +
    githubStats.totalPRsClosed +
    githubStats.totalIssuesOpened +
    githubStats.totalIssuesClosed +
    githubStats.totalReviewsGiven +
    githubStats.totalComments +
    githubStats.totalReleasesPublished;

  const prTotal = githubStats.totalPRsOpened + githubStats.totalPRsMerged + githubStats.totalPRsClosed;
  const prMergeRate =
    githubStats.totalPRsOpened > 0
      ? Math.min(100, Math.round((githubStats.totalPRsMerged / githubStats.totalPRsOpened) * 100))
      : githubStats.totalPRsMerged > 0
      ? 100
      : 0;

  // 52-week contribution heatmap matrix
  const { weeks, monthLabels, activeDaysCount, yearTotal } = useMemo(() => {
    const today = new Date();
    const dayMap = new Map(githubStats.activityByDay.map((d) => [d.date, d.count]));
    const matrix: Array<Array<{ date: string; count: number; dayOfWeek: number; month: number }>> = [];

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 363);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let currentWeek: Array<{ date: string; count: number; dayOfWeek: number; month: number }> = [];
    const cursor = new Date(startDate);
    let activeDays = 0;
    let totalInWindow = 0;

    while (cursor <= today) {
      const dateStr = cursor.toISOString().split("T")[0];
      const count = dayMap.get(dateStr) || 0;
      if (count > 0) {
        activeDays++;
        totalInWindow += count;
      }

      currentWeek.push({
        date: dateStr,
        count,
        dayOfWeek: cursor.getDay(),
        month: cursor.getMonth(),
      });

      if (cursor.getDay() === 6 || cursor.toDateString() === today.toDateString()) {
        matrix.push(currentWeek);
        currentWeek = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) matrix.push(currentWeek);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels: Array<{ weekIndex: number; label: string }> = [];
    let lastMonth = -1;
    matrix.forEach((week, idx) => {
      const firstDay = week[0];
      if (firstDay && firstDay.month !== lastMonth) {
        labels.push({ weekIndex: idx, label: months[firstDay.month] });
        lastMonth = firstDay.month;
      }
    });

    return {
      weeks: matrix,
      monthLabels: labels,
      activeDaysCount: activeDays,
      yearTotal: totalInWindow,
    };
  }, [githubStats.activityByDay]);

  const getHeatColor = (count: number) => {
    if (count === 0) return "bg-secondary/70 border-border/60";
    if (count === 1) return "bg-emerald-500/25 border-emerald-500/40";
    if (count <= 3) return "bg-emerald-500/45 border-emerald-500/50";
    if (count <= 6) return "bg-emerald-500/70 border-emerald-500/70";
    return "bg-emerald-500 border-emerald-600";
  };

  // Filtered event stream
  const filteredActivities = useMemo(() => {
    return githubActivities.filter((item) => {
      if (eventTypeFilter !== "ALL") {
        if (eventTypeFilter === "PULL_REQUEST") {
          if (!String(item.activityType).startsWith("PULL_REQUEST")) return false;
        } else if (eventTypeFilter === "ISSUE") {
          if (!String(item.activityType).startsWith("ISSUE")) return false;
        } else if (item.activityType !== eventTypeFilter) {
          return false;
        }
      }
      if (eventSearch.trim()) {
        const q = eventSearch.toLowerCase();
        const title = String(item.title || "").toLowerCase();
        const summary = String(item.summary || "").toLowerCase();
        return title.includes(q) || summary.includes(q);
      }
      return true;
    });
  }, [githubActivities, eventTypeFilter, eventSearch]);

  const typeDistribution = [
    { label: "Commits", count: githubStats.totalCommits, color: "bg-blue-500" },
    { label: "PRs Opened", count: githubStats.totalPRsOpened, color: "bg-purple-500" },
    { label: "PRs Merged", count: githubStats.totalPRsMerged, color: "bg-emerald-500" },
    { label: "Code Reviews", count: githubStats.totalReviewsGiven, color: "bg-amber-500" },
    {
      label: "Issues (Open/Closed)",
      count: githubStats.totalIssuesOpened + githubStats.totalIssuesClosed,
      color: "bg-cyan-500",
    },
    { label: "Comments", count: githubStats.totalComments, color: "bg-pink-500" },
    { label: "Releases", count: githubStats.totalReleasesPublished, color: "bg-indigo-500" },
  ];

  const maxRepoCount = githubStats.repoBreakdown[0]?.count || 1;

  return (
    <div className="space-y-5">
      {/* ── SECTION A: GITHUB IDENTITY & VERIFICATION ─────────────────────── */}
      <div className="rounded-md border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-secondary overflow-hidden">
              {ghAccount?.avatarUrl ? (
                <img
                  src={ghAccount.avatarUrl}
                  alt={ghAccount.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Github className="w-6 h-6 text-foreground" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-base text-foreground">
                  {ghAccount ? `@${ghAccount.username}` : "GitHub Not Connected"}
                </h3>
                {ghAccount ? (
                  <Badge variant="success" className="font-mono text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {ghAccount.connectionStatus || "CONNECTED"}
                  </Badge>
                ) : (
                  <Badge variant="warning" className="font-mono text-[10px] gap-1">
                    <AlertCircle className="w-3 h-3" />
                    UNLINKED
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span>
                  Connected: {ghAccount ? formatDate(ghAccount.connectedAt) : "Not linked yet"}
                </span>
                {ghAccount?.lastSyncedAt && (
                  <>
                    <span>•</span>
                    <span>Last Sync: {formatDateTime(ghAccount.lastSyncedAt)}</span>
                  </>
                )}
                {githubStats.lastActivityDate && (
                  <>
                    <span>•</span>
                    <span>Latest Event: {formatDate(githubStats.lastActivityDate)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {ghAccount && (
            <a
              href={ghAccount.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 self-start sm:self-center rounded border border-border bg-secondary/80 px-3 py-1.5 font-mono text-xs text-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Open GitHub Profile</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          )}
        </div>
      </div>

      {/* ── SECTION B: CONTRIBUTION KPI STRIP ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-md border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Total Commits
            </span>
            <GitCommitHorizontal className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-foreground">
            {githubStats.totalCommits}
          </div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
            {activeDaysCount} active days in past year
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Pull Requests
            </span>
            <GitPullRequest className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
              {githubStats.totalPRsMerged}
            </span>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
              <GitMerge className="w-3 h-3" /> merged
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
            {githubStats.totalPRsOpened} opened · {prMergeRate}% merge rate
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Code Reviews Given
            </span>
            <Eye className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-foreground">
            {githubStats.totalReviewsGiven}
          </div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
            Peer PR reviews submitted
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Issues & Discussions
            </span>
            <MessageSquare className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-foreground">
            {githubStats.totalIssuesOpened + githubStats.totalIssuesClosed + githubStats.totalComments}
          </div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
            {githubStats.totalIssuesOpened} opened · {githubStats.totalComments} comments
          </div>
        </div>
      </div>

      {/* ── SECTION C: 52-WEEK CONTRIBUTION HEATMAP ───────────────────────── */}
      <div className="rounded-md border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-500" />
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              52-Week Contribution Activity
            </h4>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground flex items-center gap-3">
            {hoveredCell ? (
              <span className="text-foreground font-semibold">
                {hoveredCell.count} {hoveredCell.count === 1 ? "event" : "events"} on {hoveredCell.date}
              </span>
            ) : (
              <span>
                <strong className="text-foreground">{yearTotal}</strong> verified events in the last 52 weeks
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto pb-2">
          <div className="inline-block min-w-max">
            {/* Month labels row */}
            <div className="flex items-center text-[10px] font-mono text-muted-foreground mb-1.5 pl-7 relative h-4">
              {monthLabels.map((m) => (
                <span
                  key={`${m.label}-${m.weekIndex}`}
                  style={{ left: `${28 + m.weekIndex * 14}px` }}
                  className="absolute"
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div className="flex gap-1">
              {/* Day of week labels */}
              <div className="flex flex-col justify-between py-0.5 pr-1.5 text-[9px] font-mono text-muted-foreground w-6">
                <span className="h-2.5 leading-none" />
                <span className="h-2.5 leading-none">Mon</span>
                <span className="h-2.5 leading-none" />
                <span className="h-2.5 leading-none">Wed</span>
                <span className="h-2.5 leading-none" />
                <span className="h-2.5 leading-none">Fri</span>
                <span className="h-2.5 leading-none" />
              </div>

              {/* Week columns */}
              <div className="flex gap-[3px]">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const cell = week.find((d) => d.dayOfWeek === dayIdx);
                      if (!cell) {
                        return <div key={dayIdx} className="w-[11px] h-[11px]" />;
                      }
                      return (
                        <div
                          key={cell.date}
                          onMouseEnter={() => setHoveredCell({ date: cell.date, count: cell.count })}
                          onMouseLeave={() => setHoveredCell(null)}
                          title={`${cell.count} contribution${cell.count === 1 ? "" : "s"} on ${cell.date}`}
                          className={`w-[11px] h-[11px] rounded-[2px] border transition-transform hover:scale-125 cursor-default ${getHeatColor(
                            cell.count
                          )}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            <span>
              {githubStats.firstActivityDate
                ? `Tracked since ${formatDate(githubStats.firstActivityDate)}`
                : "Awaiting first tracked GitHub activity"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Less</span>
            <span className="w-2.5 h-2.5 rounded-[2px] border bg-secondary/70 border-border/60" />
            <span className="w-2.5 h-2.5 rounded-[2px] border bg-emerald-500/25 border-emerald-500/40" />
            <span className="w-2.5 h-2.5 rounded-[2px] border bg-emerald-500/45 border-emerald-500/50" />
            <span className="w-2.5 h-2.5 rounded-[2px] border bg-emerald-500/70 border-emerald-500/70" />
            <span className="w-2.5 h-2.5 rounded-[2px] border bg-emerald-500 border-emerald-600" />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* ── SECTION D & E: REPOSITORY DISTRIBUTION & ACTIVITY TYPE BREAKDOWN ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Repository Distribution */}
        <div className="rounded-md border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-primary" />
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Repository Distribution
              </h4>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {githubStats.repoBreakdown.length} repos
            </span>
          </div>

          {githubStats.repoBreakdown.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No repository contribution telemetry recorded yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3 font-mono text-xs">
              {githubStats.repoBreakdown.slice(0, 6).map((repo) => {
                const share = totalEvents > 0 ? Math.round((repo.count / totalEvents) * 100) : 0;
                const barWidth = Math.round((repo.count / maxRepoCount) * 100);
                return (
                  <div key={repo.repoFullName}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-semibold text-foreground truncate" title={repo.repoFullName}>
                        {repo.repoFullName || repo.repoName}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {repo.count} events ({share}%)
                      </span>
                    </div>
                    <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Type Breakdown */}
        <div className="rounded-md border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Activity Type Breakdown
              </h4>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {totalEvents} total
            </span>
          </div>

          <div className="mt-4 space-y-2.5 font-mono text-xs">
            {typeDistribution.map((item) => {
              const pct = totalEvents > 0 ? Math.round((item.count / totalEvents) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                    </span>
                    <span className="font-bold text-foreground">
                      {item.count} <span className="font-normal text-muted-foreground text-[10px]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${item.color} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── SECTION F: REAL-TIME VERIFIED EVENT STREAM ────────────────────── */}
      <div className="rounded-md border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              Real-Time Verified Event Stream ({filteredActivities.length} of {githubActivities.length})
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search input */}
            <div className="relative min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Filter commits, PRs..."
                className="w-full h-7 pl-8 pr-6 bg-background border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
              {eventSearch && (
                <button
                  type="button"
                  onClick={() => setEventSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Type filters */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { key: "ALL", label: "All" },
                { key: "COMMIT", label: "Commits" },
                { key: "PULL_REQUEST", label: "PRs" },
                { key: "REVIEW_SUBMITTED", label: "Reviews" },
                { key: "ISSUE", label: "Issues" },
                { key: "COMMENT_CREATED", label: "Comments" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setEventTypeFilter(opt.key)}
                  className={`px-2 py-1 rounded font-mono text-[10px] transition-colors ${
                    eventTypeFilter === opt.key
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ActivityTimeline items={filteredActivities} />
      </div>
    </div>
  );
}

