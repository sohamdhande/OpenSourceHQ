"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  GitCommit,
  GitPullRequest,
  Layers,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
  FileText,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AnalyticsMetrics {
  totalMentors: number;
  totalMentees: number;
  totalCohorts: number;
  mentorMenteeRatio: string;
  reportsCount: number;
  allReportsCount: number;
  reviewedReportsCount: number;
  pendingReviewReportsCount: number;
  changesRequestedCount: number;
  reportReviewRate: number;
  totalHoursLogged: number;
  tasksCount: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  taskCompletionRate: number;
  totalBlockers: number;
  openBlockers: number;
  resolvedBlockers: number;
  blockerResolutionRate: number;
  activityCount: number;
  nonFixtureActivityCount: number;
  statusBreakdown: {
    submitted: number;
    underReview: number;
    changesRequested: number;
    reviewed: number;
    draft: number;
  };
  githubBreakdown: {
    prsOpened: number;
    prsMerged: number;
    prsClosed: number;
    commits: number;
    reviews: number;
    issues: number;
    comments: number;
    others: number;
  };
  webhookHealth: {
    total: number;
    processed: number;
    failed: number;
    successRate: number;
  };
  githubContributors: Array<{
    userId: string;
    name: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    totalEvents: number;
  }>;
}

interface CohortRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  mentees: number;
  mentors: number;
  ratio: string;
  reports: number;
  allReports: number;
  reviewedReports: number;
  reviewRate: number;
  hours: number;
  tasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  openBlockers: number;
}

interface ActiveBlockerItem {
  id: string;
  title: string;
  status: string;
  urgency: string;
  source: string;
  createdAt: string;
  menteeName: string;
  menteeEmail: string;
  cohortName: string;
}

interface AdminAnalyticsClientProps {
  orgSlug: string;
  orgName: string;
  metrics: AnalyticsMetrics;
  cohortComparison: CohortRow[];
  activeBlockers: ActiveBlockerItem[];
}

export function AdminAnalyticsClient({
  orgSlug,
  orgName,
  metrics,
  cohortComparison,
  activeBlockers,
}: AdminAnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<"matrix" | "velocity" | "blockers" | "github">("matrix");
  const [selectedCohort, setSelectedCohort] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<"ALL" | "30D" | "7D">("ALL");

  // Safe defaults for new GitHub telemetry fields
  const webhookHealth = metrics.webhookHealth || { total: 0, processed: 0, failed: 0, successRate: 100 };
  const githubContributors = metrics.githubContributors || [];

  // Filter cohorts by search query and selection
  const filteredCohorts = useMemo(() => {
    return cohortComparison.filter((c) => {
      if (selectedCohort !== "ALL" && c.id !== selectedCohort) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
      }
      return true;
    });
  }, [cohortComparison, selectedCohort, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Cohort Name",
      "Status",
      "Enrolled Mentees",
      "Assigned Mentors",
      "Mentor-Mentee Ratio",
      "Reports Submitted",
      "Reports Reviewed",
      "Review Rate (%)",
      "Logged Hours",
      "Task Assignments",
      "Completed Tasks",
      "Task Completion Rate (%)",
      "Active Blockers",
    ];

    const rows = cohortComparison.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      c.status,
      c.mentees,
      c.mentors,
      `"${c.ratio}"`,
      c.reports,
      c.reviewedReports,
      `${c.reviewRate}%`,
      c.hours,
      c.tasks,
      c.completedTasks,
      `${c.taskCompletionRate}%`,
      c.openBlockers,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        `# OpenSourceHQ - Organization Analytics Export - ${orgName}`,
        `# Generated: ${new Date().toISOString()} (UTC)`,
        `# Total Mentors: ${metrics.totalMentors} | Total Mentees: ${metrics.totalMentees} | Total Hours: ${metrics.totalHoursLogged}h | Review Rate: ${metrics.reportReviewRate}%`,
        "",
        headers.join(","),
        ...rows.map((r) => r.join(",")),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${orgSlug}-analytics-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return {
          label: "Critical",
          variant: "destructive" as const,
          className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        };
      case "HIGH":
        return {
          label: "High",
          variant: "warning" as const,
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "MEDIUM":
        return {
          label: "Medium",
          variant: "outline" as const,
          className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
        };
      default:
        return {
          label: "Low",
          variant: "secondary" as const,
          className: "bg-secondary text-secondary-foreground border-border",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="page-eyebrow">
            <Activity className="h-3.5 w-3.5" />
            COHORT PERFORMANCE INTELLIGENCE · GOVERNANCE & TELEMETRY
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Organization Analytics
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Traceable database-backed metrics, cross-cohort progress comparisons, and real-time engineering velocity.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Indicator */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-secondary/80 border border-border text-[11px] font-mono text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live DB Telemetry</span>
          </div>

          {/* Time range selector */}
          <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs font-mono">
            {(["ALL", "30D", "7D"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range === "ALL" ? "All Time" : range === "30D" ? "Past 30D" : "Past 7D"}
              </button>
            ))}
          </div>

          {/* CSV Export Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="h-8 gap-1.5 text-xs font-mono"
            title="Download CSV export of cross-cohort metrics"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </section>

      {/* Top Workstation Telemetry Strip (6 KPI Cards) */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Mentorship Coverage */}
        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">
              Mentorship
            </span>
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.totalMentors}{" "}
              <span className="text-xs font-normal text-muted-foreground">Mentors</span>
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {metrics.totalMentees} Mentees ({metrics.mentorMenteeRatio})
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Coverage</span>
            <Badge variant="success" className="text-[9px] px-1.5 py-0">
              100% Active
            </Badge>
          </div>
        </Card>

        {/* 2. Engineering Output */}
        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">
              Engineering Hours
            </span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.totalHoursLogged}h
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              Across {metrics.allReportsCount} total reports
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Avg / Mentee</span>
            <span className="text-foreground font-semibold">
              {metrics.totalMentees > 0
                ? (metrics.totalHoursLogged / metrics.totalMentees).toFixed(1)
                : "0.0"}
              h
            </span>
          </div>
        </Card>

        {/* 3. Report Review Velocity */}
        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">
              Review Rate
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.reportReviewRate}%
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {metrics.reviewedReportsCount} of {metrics.reportsCount} reviewed
            </div>
          </div>
          <div className="mt-3 w-full bg-secondary border border-border rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${metrics.reportReviewRate}%` }}
            />
          </div>
        </Card>

        {/* 4. Task Completion */}
        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">
              Task Velocity
            </span>
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.taskCompletionRate}%
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {metrics.completedTasksCount} of {metrics.tasksCount} completed
            </div>
          </div>
          <div className="mt-3 w-full bg-secondary border border-border rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${metrics.taskCompletionRate}%` }}
            />
          </div>
        </Card>

        {/* 5. Blocker Health */}
        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">
              Blockers
            </span>
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                metrics.openBlockers > 0 ? "text-amber-500" : "text-emerald-500"
              }`}
            />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.openBlockers}{" "}
              <span className="text-xs font-normal text-muted-foreground">Open</span>
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {metrics.resolvedBlockers} resolved ({metrics.blockerResolutionRate}%)
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground font-mono">Status</span>
            <Badge
              variant={metrics.openBlockers > 0 ? "warning" : "success"}
              className="text-[9px] px-1.5 py-0"
            >
              {metrics.openBlockers > 0 ? "Needs Review" : "Clear"}
            </Badge>
          </div>
        </Card>

        {/* 6. GitHub Telemetry */}
        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">
              GitHub Sync
            </span>
            <GitPullRequest className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.activityCount}
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {metrics.githubBreakdown.prsOpened} PRs · {metrics.githubBreakdown.commits} Commits
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Repositories</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
          </div>
        </Card>
      </section>

      {/* Control & Sub-Navigation Toolbar */}
      <section className="p-3 bg-card border border-border rounded-md space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* View Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-3 py-1.5 rounded text-xs font-medium font-mono transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "matrix"
                  ? "bg-secondary text-foreground font-semibold border border-border shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Layers className="w-3 h-3 text-primary" />
              <span>Cohort Matrix</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background border border-border">
                {cohortComparison.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("velocity")}
              className={`px-3 py-1.5 rounded text-xs font-medium font-mono transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "velocity"
                  ? "bg-secondary text-foreground font-semibold border border-border shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span>Engineering Velocity</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background border border-border">
                {metrics.activityCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("blockers")}
              className={`px-3 py-1.5 rounded text-xs font-medium font-mono transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "blockers"
                  ? "bg-secondary text-foreground font-semibold border border-border shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <AlertTriangle
                className={`w-3 h-3 ${
                  metrics.openBlockers > 0 ? "text-amber-500" : "text-muted-foreground"
                }`}
              />
              <span>Blocker Intelligence</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] border ${
                  metrics.openBlockers > 0
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold"
                    : "bg-background border-border text-muted-foreground"
                }`}
              >
                {metrics.openBlockers}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("github")}
              className={`px-3 py-1.5 rounded text-xs font-medium font-mono transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "github"
                  ? "bg-secondary text-foreground font-semibold border border-border shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <GitCommit className="w-3 h-3 text-cyan-500" />
              <span>GitHub Intelligence</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background border border-border">
                {metrics.activityCount}
              </span>
            </button>
          </div>

          {/* Right Toolbar Filters */}
          <div className="flex items-center gap-2">
            {/* Cohort Selector Filter */}
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="h-8 px-2.5 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary/50 font-mono"
            >
              <option value="ALL">All Cohorts ({cohortComparison.length})</option>
              {cohortComparison.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Search Cohorts input with proper padding-left so icon never overlaps */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cohorts..."
                className="w-full h-8 pl-9 pr-7 bg-background border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* TAB 1: COHORT COMPARISON MATRIX (TradeWise Institutional Workstation Grid) */}
      {activeTab === "matrix" && (
        <Card className="overflow-hidden border-border/80">
          <CardHeader className="p-4 border-b border-border/60 bg-muted/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Cross-Cohort Comparative Performance Matrix
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deep audit breakdown of fellow enrollment, mentor assignments, report throughput, and engineering velocity.
              </p>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Showing <span className="text-foreground font-semibold">{filteredCohorts.length}</span> of {cohortComparison.length} cohorts
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Cohort & Focus Scope</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Fellows</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Mentors</th>
                    <th className="py-2.5 px-3 font-semibold">Ratio</th>
                    <th className="py-2.5 px-4 font-semibold">Reports & Velocity</th>
                    <th className="py-2.5 px-3 font-semibold">Hours Logged</th>
                    <th className="py-2.5 px-4 font-semibold">Tasks Completed</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Open Blockers</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filteredCohorts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Layers className="w-6 h-6 text-muted-foreground/50" />
                          <p className="text-xs">No cohorts found matching query &ldquo;{searchQuery}&rdquo;</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSearchQuery("");
                              setSelectedCohort("ALL");
                            }}
                            className="text-xs h-7 mt-1"
                          >
                            Reset filters
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCohorts.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-muted/20 transition-colors group"
                      >
                        {/* Cohort Name & Status */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground text-xs font-sans group-hover:text-primary transition-colors">
                            {row.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>/{row.slug}</span>
                            <span>·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {row.status}
                            </span>
                          </div>
                        </td>

                        {/* Mentees Count */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          <span className="font-bold text-foreground text-sm">{row.mentees}</span>
                        </td>

                        {/* Mentors Count */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          <span className="font-bold text-foreground text-sm">{row.mentors}</span>
                        </td>

                        {/* Ratio with mini-bar */}
                        <td className="py-3 px-3">
                          <div className="text-xs font-bold text-foreground">{row.ratio}</div>
                          <div className="text-[10px] text-muted-foreground">Mentor:Mentee</div>
                        </td>

                        {/* Reports Submitted & Review Rate */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground">{row.reports}</span>
                            <Badge
                              variant={row.reviewRate >= 60 ? "success" : "warning"}
                              className="text-[9.5px] px-1.5 py-0"
                            >
                              {row.reviewRate}% reviewed
                            </Badge>
                          </div>
                          <div className="text-[10.5px] text-muted-foreground mt-0.5">
                            {row.reviewedReports} reviewed
                          </div>
                        </td>

                        {/* Logged Hours */}
                        <td className="py-3 px-3 tabular-nums">
                          <div className="font-bold text-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span>{row.hours}h</span>
                          </div>
                          <div className="text-[10.5px] text-muted-foreground">
                            {row.mentees > 0 ? (row.hours / row.mentees).toFixed(1) : "0.0"}h / fellow
                          </div>
                        </td>

                        {/* Tasks Completed & Progress bar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-foreground">
                              {row.completedTasks} / {row.tasks}
                            </span>
                            <span className="text-[10.5px] text-muted-foreground">
                              {row.taskCompletionRate}%
                            </span>
                          </div>
                          <div className="w-24 bg-secondary border border-border rounded-full h-1 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${row.taskCompletionRate}%` }}
                            />
                          </div>
                        </td>

                        {/* Open Blockers */}
                        <td className="py-3 px-3 text-center">
                          {row.openBlockers === 0 ? (
                            <Badge variant="success" className="text-[10px] px-2 py-0.5">
                              0 Clear
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px] px-2 py-0.5 font-bold">
                              {row.openBlockers} Active
                            </Badge>
                          )}
                        </td>

                        {/* Action Shortcuts */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/org/${orgSlug}/admin/reports?cohort=${row.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] gap-1 font-sans"
                              >
                                <span>Reports</span>
                                <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </Link>
                            <Link href={`/org/${orgSlug}/admin/cohorts`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground font-sans"
                              >
                                Edit
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: ENGINEERING VELOCITY & DISTRIBUTIONS */}
      {activeTab === "velocity" && (
        <div className="space-y-6">
          {/* Progress Report Review Funnel */}
          <Card className="p-4 sm:p-5 border-border/80">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Daily Progress Reports Review Funnel
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lifecycle state distribution across {metrics.allReportsCount} total progress report submissions.
                </p>
              </div>
              <Badge variant="default" className="font-mono text-xs">
                {metrics.reportReviewRate}% Overall Reviewed
              </Badge>
            </div>

            {/* Proportional Segmented Funnel Bar */}
            <div className="mt-4">
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden flex border border-border">
                {metrics.statusBreakdown.reviewed > 0 && (
                  <div
                    style={{
                      width: `${(metrics.statusBreakdown.reviewed / metrics.allReportsCount) * 100}%`,
                    }}
                    className="bg-emerald-500 h-full transition-all duration-300"
                    title={`Reviewed: ${metrics.statusBreakdown.reviewed}`}
                  />
                )}
                {metrics.statusBreakdown.changesRequested > 0 && (
                  <div
                    style={{
                      width: `${(metrics.statusBreakdown.changesRequested / metrics.allReportsCount) * 100}%`,
                    }}
                    className="bg-amber-500 h-full transition-all duration-300"
                    title={`Changes Requested: ${metrics.statusBreakdown.changesRequested}`}
                  />
                )}
                {metrics.statusBreakdown.submitted > 0 && (
                  <div
                    style={{
                      width: `${(metrics.statusBreakdown.submitted / metrics.allReportsCount) * 100}%`,
                    }}
                    className="bg-blue-500 h-full transition-all duration-300"
                    title={`Submitted / Under Review: ${metrics.statusBreakdown.submitted}`}
                  />
                )}
                {metrics.statusBreakdown.draft > 0 && (
                  <div
                    style={{
                      width: `${(metrics.statusBreakdown.draft / metrics.allReportsCount) * 100}%`,
                    }}
                    className="bg-muted-foreground/30 h-full transition-all duration-300"
                    title={`Draft: ${metrics.statusBreakdown.draft}`}
                  />
                )}
              </div>
            </div>

            {/* Funnel Details Grid */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 bg-secondary/50 border border-border rounded-md">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Reviewed</span>
                </div>
                <div className="mt-1 text-lg font-bold text-foreground">
                  {metrics.statusBreakdown.reviewed}
                </div>
                <div className="text-[10.5px] text-muted-foreground">
                  {metrics.allReportsCount > 0
                    ? Math.round((metrics.statusBreakdown.reviewed / metrics.allReportsCount) * 100)
                    : 0}
                  % of total
                </div>
              </div>

              <div className="p-3 bg-secondary/50 border border-border rounded-md">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Changes Req.</span>
                </div>
                <div className="mt-1 text-lg font-bold text-foreground">
                  {metrics.statusBreakdown.changesRequested}
                </div>
                <div className="text-[10.5px] text-muted-foreground">
                  Action required by fellow
                </div>
              </div>

              <div className="p-3 bg-secondary/50 border border-border rounded-md">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Under Review</span>
                </div>
                <div className="mt-1 text-lg font-bold text-foreground">
                  {metrics.statusBreakdown.submitted}
                </div>
                <div className="text-[10.5px] text-muted-foreground">
                  Awaiting mentor feedback
                </div>
              </div>

              <div className="p-3 bg-secondary/50 border border-border rounded-md">
                <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span>Draft</span>
                </div>
                <div className="mt-1 text-lg font-bold text-foreground">
                  {metrics.statusBreakdown.draft}
                </div>
                <div className="text-[10.5px] text-muted-foreground">
                  Unsubmitted fellow logs
                </div>
              </div>
            </div>
          </Card>

          {/* GitHub Activity Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 sm:p-5 border-border/80">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-purple-500" />
                GitHub Contribution Streams
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ingested activity by telemetry type across linked repositories.
              </p>

              <div className="mt-4 space-y-3 font-mono text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <GitPullRequest className="w-3 h-3 text-purple-400" /> Pull Requests Opened
                    </span>
                    <span className="font-bold text-foreground">
                      {metrics.githubBreakdown.prsOpened}
                    </span>
                  </div>
                  <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{
                        width: `${metrics.activityCount > 0 ? (metrics.githubBreakdown.prsOpened / metrics.activityCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <GitCommit className="w-3 h-3 text-blue-400" /> Commits Authored
                    </span>
                    <span className="font-bold text-foreground">
                      {metrics.githubBreakdown.commits}
                    </span>
                  </div>
                  <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${metrics.activityCount > 0 ? (metrics.githubBreakdown.commits / metrics.activityCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> PRs Merged / Closed
                    </span>
                    <span className="font-bold text-foreground">
                      {metrics.githubBreakdown.prsMerged + metrics.githubBreakdown.prsClosed}
                    </span>
                  </div>
                  <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${
                          metrics.activityCount > 0
                            ? ((metrics.githubBreakdown.prsMerged + metrics.githubBreakdown.prsClosed) /
                                metrics.activityCount) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-amber-400" /> Reviews, Issues & Discussions
                    </span>
                    <span className="font-bold text-foreground">
                      {metrics.githubBreakdown.reviews +
                        metrics.githubBreakdown.issues +
                        metrics.githubBreakdown.comments}
                    </span>
                  </div>
                  <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{
                        width: `${
                          metrics.activityCount > 0
                            ? ((metrics.githubBreakdown.reviews +
                                metrics.githubBreakdown.issues +
                                metrics.githubBreakdown.comments) /
                                metrics.activityCount) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 border-border/80">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Hours Logged by Cohort
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Proportionate distribution of engineering hours spent.
              </p>

              <div className="mt-4 space-y-4 font-mono text-xs">
                {cohortComparison.map((c) => {
                  const pct =
                    metrics.totalHoursLogged > 0
                      ? Math.round((c.hours / metrics.totalHoursLogged) * 100)
                      : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <span className="text-muted-foreground">
                          {c.hours}h ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary border border-border rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE BLOCKERS & INTERVENTIONS */}
      {activeTab === "blockers" && (
        <Card className="overflow-hidden border-border/80">
          <CardHeader className="p-4 border-b border-border/60 bg-muted/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Active Blockers Needing Intervention
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time escalated impediments reported by fellows across all active cohorts.
              </p>
            </div>
            <Badge
              variant={activeBlockers.length > 0 ? "warning" : "success"}
              className="text-xs font-mono"
            >
              {activeBlockers.length} Unresolved
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {activeBlockers.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Zero Active Blockers</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  All reported impediments have been resolved. Mentees are moving forward on their milestones.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {activeBlockers.map((blocker) => {
                  const badge = getUrgencyBadge(blocker.urgency);
                  return (
                    <div
                      key={blocker.id}
                      className="p-4 hover:bg-muted/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5 max-w-2xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.className}`}
                          >
                            {badge.label} Urgency
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {blocker.cohortName}
                          </span>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            Raised by {blocker.menteeName} ({blocker.menteeEmail})
                          </span>
                        </div>
                        <p className="text-xs text-foreground font-medium leading-relaxed">
                          {blocker.title}
                        </p>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          Source: {blocker.source.replace(/_/g, " ")} · Logged{" "}
                          {new Date(blocker.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/org/${orgSlug}/admin/reports`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                            <span>Inspect Report</span>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: GITHUB INTELLIGENCE */}
      {activeTab === "github" && (
        <div className="space-y-6">
          {/* GitHub Ecosystem Health Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Webhook Pipeline Health */}
            <Card className="p-4 sm:p-5 border-border/80">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Webhook Pipeline Health
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                GitHub App webhook delivery and processing status.
              </p>
              
              <div className="mt-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Deliveries</span>
                  <span className="font-bold text-foreground">{webhookHealth.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Processed</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{webhookHealth.processed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Failed</span>
                  <span className={`font-bold ${webhookHealth.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                    {webhookHealth.failed}
                  </span>
                </div>
                
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-muted-foreground">Success Rate</span>
                    <span className="font-bold text-foreground">{webhookHealth.successRate}%</span>
                  </div>
                  <div className="w-full bg-secondary border border-border rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        webhookHealth.successRate >= 95 ? 'bg-emerald-500' :
                        webhookHealth.successRate >= 80 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${webhookHealth.successRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* GitHub Activity Type Distribution */}
            <Card className="p-4 sm:p-5 border-border/80">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-purple-500" />
                Activity Stream Distribution
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Breakdown of ingested GitHub events by type across all repositories.
              </p>
              
              <div className="mt-4 space-y-2.5 font-mono text-xs">
                {[
                  { label: 'Commits', count: metrics.githubBreakdown.commits, color: 'bg-blue-500', textColor: 'text-blue-500' },
                  { label: 'PRs Opened', count: metrics.githubBreakdown.prsOpened, color: 'bg-purple-500', textColor: 'text-purple-500' },
                  { label: 'PRs Merged', count: metrics.githubBreakdown.prsMerged, color: 'bg-emerald-500', textColor: 'text-emerald-500' },
                  { label: 'Code Reviews', count: metrics.githubBreakdown.reviews, color: 'bg-amber-500', textColor: 'text-amber-500' },
                  { label: 'Issues', count: metrics.githubBreakdown.issues, color: 'bg-cyan-500', textColor: 'text-cyan-500' },
                  { label: 'Comments', count: metrics.githubBreakdown.comments, color: 'bg-pink-500', textColor: 'text-pink-500' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${item.color}`} />
                        {item.label}
                      </span>
                      <span className="font-bold text-foreground">{item.count}</span>
                    </div>
                    <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${item.color} transition-all duration-300`}
                        style={{ width: `${metrics.activityCount > 0 ? (item.count / metrics.activityCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* GitHub Sync Summary Stats */}
            <Card className="p-4 sm:p-5 border-border/80">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Sync Summary
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aggregate engineering telemetry from GitHub App integration.
              </p>
              
              <div className="mt-4 space-y-3 font-mono text-xs">
                <div className="p-3 bg-secondary/50 border border-border rounded-md">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total GitHub Events</div>
                  <div className="text-2xl font-bold text-foreground mt-1">{metrics.activityCount}</div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">
                    {metrics.nonFixtureActivityCount} from verified webhooks
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-secondary/50 border border-border rounded-md text-center">
                    <div className="text-lg font-bold text-foreground">{metrics.githubBreakdown.commits}</div>
                    <div className="text-[10px] text-muted-foreground">Commits</div>
                  </div>
                  <div className="p-2.5 bg-secondary/50 border border-border rounded-md text-center">
                    <div className="text-lg font-bold text-foreground">{metrics.githubBreakdown.prsMerged}</div>
                    <div className="text-[10px] text-muted-foreground">PRs Merged</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>GitHub App Connected · Webhooks Active</span>
                </div>
              </div>
            </Card>
          </div>

          {/* GitHub Contributor Leaderboard */}
          <Card className="overflow-hidden border-border/80">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  GitHub Contributor Leaderboard
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Top contributors ranked by verified GitHub event volume across all tracked repositories.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {githubContributors.length} Contributors
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {githubContributors.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <GitCommit className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
                  <p>No GitHub activity recorded yet. Connect the GitHub App and track repositories to see contributor data.</p>
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold w-10">#</th>
                      <th className="py-2.5 px-4 font-semibold">Contributor</th>
                      <th className="py-2.5 px-3 font-semibold">GitHub Handle</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Events</th>
                      <th className="py-2.5 px-4 font-semibold">Activity Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {githubContributors.map((contributor, index) => {
                      const maxEvents = githubContributors[0]?.totalEvents || 1;
                      const sharePercent = metrics.activityCount > 0
                        ? Math.round((contributor.totalEvents / metrics.activityCount) * 100)
                        : 0;
                      return (
                        <tr key={contributor.userId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 tabular-nums text-muted-foreground font-semibold">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-foreground overflow-hidden shrink-0">
                                {contributor.avatarUrl ? (
                                  <img src={contributor.avatarUrl} alt={contributor.name} className="w-full h-full object-cover" />
                                ) : (
                                  contributor.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-foreground font-sans text-xs">{contributor.name}</span>
                                <div className="text-[10px] text-muted-foreground">{contributor.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-foreground">@{contributor.username}</span>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-foreground">
                            {contributor.totalEvents}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${(contributor.totalEvents / maxEvents) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground w-8 text-right">{sharePercent}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
