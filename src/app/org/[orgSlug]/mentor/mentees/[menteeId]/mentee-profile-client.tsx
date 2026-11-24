"use client";

import React, { useState, useMemo } from "react";
import { formatDate, formatDateTime } from "@/lib/date";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { MemberRepositoriesClient } from "@/components/repositories/member-repositories-client";
import { GitHubCommandCenter } from "@/components/github/github-command-center";
import {
  User,
  FileText,
  CheckSquare,
  GitBranch,
  FolderGit2,
  Award,
  ShieldAlert,
  MessageSquare,
  CalendarCheck,
  MessageCircle,
  ExternalLink,
  Plus,
  Send,
  Star,
  UserCheck,
  Sparkles,
  Loader2,
  CheckCircle2,
  X,
  AlertCircle,
  Clock,
  Copy,
  Check,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Calendar,
  Github,
  Filter,
  ArrowUpRight,
  Layers,
  Flame,
  Search,
  GitPullRequest,
  GitMerge,
  GitCommitHorizontal,
  Eye,
  Tag,
} from "lucide-react";

interface GitHubStats {
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

interface MenteeProfileClientProps {
  mentee: any;
  orgId: string;
  orgSlug: string;
  initialTab?: string;
  githubActivities: any[];
  menteeRepositories: any[];
  blockers: any[];
  discussionPosts: any[];
  discussionComments: any[];
  currentUserId: string;
  githubStats: GitHubStats;
}

export function MenteeProfileClient({
  mentee,
  orgId,
  orgSlug,
  initialTab = "overview",
  githubActivities,
  menteeRepositories,
  blockers,
  discussionPosts,
  discussionComments,
  currentUserId,
  githubStats,
}: MenteeProfileClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Structured Feedback Form State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("GENERAL");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [technicalStrengths, setTechnicalStrengths] = useState("");
  const [areasForImprovement, setAreasForImprovement] = useState("");
  const [codeQuality, setCodeQuality] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [feedbackVisibility, setFeedbackVisibility] = useState<"PRIVATE_TO_MENTEE" | "COHORT" | "PRIVATE_TO_MENTORS">("PRIVATE_TO_MENTEE");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Milestone Review State
  const [reviewingMilestoneId, setReviewingMilestoneId] = useState<string | null>(null);
  const [milestoneDecision, setMilestoneDecision] = useState<"APPROVED" | "CHANGES_REQUESTED">("APPROVED");
  const [milestoneFeedback, setMilestoneFeedback] = useState("");
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  // Inline Daily Report Review State
  const [reviewingReportId, setReviewingReportId] = useState<string | null>(null);
  const [reportReviewComment, setReportReviewComment] = useState("");
  const [submittingReportReview, setSubmittingReportReview] = useState(false);

  // Inline Blocker Triage State
  const [triagingBlockerId, setTriagingBlockerId] = useState<string | null>(null);
  const [blockerResponse, setBlockerResponse] = useState("");
  const [blockerStatusDecision, setBlockerStatusDecision] = useState<"IN_PROGRESS" | "RESOLVED">("RESOLVED");
  const [submittingBlocker, setSubmittingBlocker] = useState(false);

  // Filter States inside tabs
  const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
  const [taskStatusFilter, setTaskStatusFilter] = useState("ALL");
  const [blockerUrgencyFilter, setBlockerUrgencyFilter] = useState("ALL");

  const ghAccount = mentee.githubAccounts?.[0];

  // Calculated Metrics
  const metrics = useMemo(() => {
    const totalReports = mentee.dailyReports?.length || 0;
    const reviewedReports = mentee.dailyReports?.filter((r: any) => r.status === "REVIEWED").length || 0;
    const totalHours = mentee.dailyReports?.reduce((acc: number, r: any) => acc + (r.hoursSpent || 0), 0) || 0;

    const totalTasks = mentee.assignedTasks?.length || 0;
    const completedTasks = mentee.assignedTasks?.filter((t: any) => t.status === "ACCEPTED" || t.status === "COMPLETED").length || 0;
    const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalMilestones = mentee.menteeMilestones?.length || 0;
    const approvedMilestones = mentee.menteeMilestones?.filter((m: any) => m.status === "APPROVED").length || 0;
    const milestoneRate = totalMilestones > 0 ? Math.round((approvedMilestones / totalMilestones) * 100) : 0;

    const openBlockers = blockers?.filter((b: any) => b.status === "OPEN" || b.status === "INVESTIGATING" || b.status === "REOPENED").length || 0;

    const totalEvents = mentee.attendances?.length || 0;
    const presentEvents = mentee.attendances?.filter((a: any) => a.status === "PRESENT").length || 0;
    const attendanceRate = totalEvents > 0 ? Math.round((presentEvents / totalEvents) * 100) : 100;

    return {
      totalReports,
      reviewedReports,
      totalHours,
      totalTasks,
      completedTasks,
      taskRate,
      totalMilestones,
      approvedMilestones,
      milestoneRate,
      openBlockers,
      totalEvents,
      presentEvents,
      attendanceRate,
    };
  }, [mentee, blockers]);

  const copyEmail = () => {
    if (mentee.email) {
      navigator.clipboard.writeText(mentee.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleCreateFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackContent.trim()) return;

    setSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          menteeId: mentee.id,
          category: feedbackCategory,
          content: feedbackContent,
          technicalStrengths: technicalStrengths || undefined,
          areasForImprovement: areasForImprovement || undefined,
          codeQuality: codeQuality || undefined,
          recommendations: recommendations || undefined,
          privateNotes: privateNotes || undefined,
          visibility: feedbackVisibility,
          status: "PUBLISHED",
        }),
      });

      if (res.ok) {
        setShowFeedbackModal(false);
        setFeedbackContent("");
        setTechnicalStrengths("");
        setAreasForImprovement("");
        setCodeQuality("");
        setRecommendations("");
        setPrivateNotes("");
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        setFeedbackError(data?.error?.message || "Failed to publish evaluation. Please try again.");
      }
    } catch (err: unknown) {
      setFeedbackError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleReviewMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingMilestoneId) return;

    setSubmittingMilestone(true);
    try {
      const res = await fetch(`/api/learning/milestones/${reviewingMilestoneId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menteeId: mentee.id,
          status: milestoneDecision,
          notes: milestoneFeedback,
        }),
      });

      if (res.ok) {
        setReviewingMilestoneId(null);
        setMilestoneFeedback("");
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingMilestone(false);
    }
  };

  const handleReviewReport = async (reportId: string, decision: "REVIEWED" | "CHANGES_REQUESTED") => {
    if (!reportReviewComment.trim()) return;
    setSubmittingReportReview(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: reportReviewComment.trim() }),
      });
      if (res.ok) {
        setReviewingReportId(null);
        setReportReviewComment("");
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReportReview(false);
    }
  };

  const handleResolveBlocker = async (blockerId: string) => {
    if (!blockerResponse.trim()) return;
    setSubmittingBlocker(true);
    try {
      const res = await fetch(`/api/blockers/${blockerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: blockerResponse.trim(),
          status: blockerStatusDecision,
        }),
      });
      if (res.ok) {
        setTriagingBlockerId(null);
        setBlockerResponse("");
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingBlocker(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: User, count: undefined },
    { id: "reports", label: "Daily Reports", icon: FileText, count: mentee.dailyReports?.length },
    { id: "tasks", label: "Tasks", icon: CheckSquare, count: mentee.assignedTasks?.length },
    { id: "github", label: "GitHub Telemetry", icon: GitBranch, count: githubActivities?.length },
    { id: "repositories", label: "Repositories", icon: FolderGit2, count: menteeRepositories?.length },
    { id: "learning", label: "Learning Path", icon: Award, count: mentee.menteeMilestones?.length },
    { id: "blockers", label: "Blocker Triage", icon: ShieldAlert, count: blockers?.length, alert: metrics.openBlockers > 0 },
    { id: "feedback", label: "Evaluations", icon: MessageSquare, count: mentee.feedbackReceived?.length },
    { id: "attendance", label: "Attendance", icon: CalendarCheck, count: mentee.attendances?.length },
    { id: "communication", label: "Community", icon: MessageCircle, count: discussionPosts?.length + discussionComments?.length },
  ];

  const quickFeedbackSnippets = [
    "Excellent engineering progress this week.",
    "Strong grasp of architectural principles and clean code.",
    "Recommend adding unit test coverage to edge cases.",
    "Please break down pull requests into smaller atomic commits.",
    "Great autonomy in troubleshooting complex roadblocks.",
  ];

  return (
    <div className="space-y-6">
      {/* ── 1. DOSSIER HERO HEADER ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Mentee Identity */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-secondary font-mono text-xl font-bold text-foreground shadow-xs">
                {mentee.imageUrl ? (
                  <img
                    src={mentee.imageUrl}
                    alt={mentee.name}
                    className="h-full w-full rounded-md object-cover"
                  />
                ) : (
                  (mentee.name || "M").charAt(0).toUpperCase()
                )}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card ${
                  mentee.status === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                }`}
                title={`Status: ${mentee.status}`}
              />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {mentee.name}
                </h1>
                <Badge variant="outline" className="font-mono text-[10.5px]">
                  FELLOW / MENTEE
                </Badge>
                <Badge
                  variant={mentee.status === "ACTIVE" ? "success" : "secondary"}
                  className="font-mono text-[10.5px]"
                >
                  {mentee.status}
                </Badge>
              </div>

              {/* Subtitle / Meta */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={copyEmail}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  title="Click to copy email"
                >
                  {copiedEmail ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{mentee.email}</span>
                </button>
                <span>•</span>
                <span>Timezone: {mentee.timezone || "UTC"}</span>
                <span>•</span>
                <span>Enrolled: {formatDate(mentee.createdAt)}</span>
              </div>

              {/* Cohorts & GitHub Pill */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {mentee.cohortEnrollments?.map((enr: any) => (
                  <span
                    key={enr.id}
                    className="inline-flex items-center gap-1 rounded border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[11px] text-foreground"
                  >
                    <Layers className="w-3 h-3 text-primary" />
                    {enr.cohort?.name}
                  </span>
                ))}

                {ghAccount && (
                  <a
                    href={ghAccount.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/80 px-2.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>@{ghAccount.username}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <Button
              size="sm"
              onClick={() => {
                setActiveTab("feedback");
                setShowFeedbackModal(true);
              }}
              className="gap-1.5 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Evaluate Mentee</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab("reports")}
              className="gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span>View Logs ({metrics.totalReports})</span>
            </Button>
          </div>
        </div>

        {/* ── 2. EXECUTIVE KPI TELEMETRY STRIP ──────────────────────────── */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5 border-t border-border/80 pt-4">
          {/* Total Reports */}
          <div className="rounded border border-border/70 bg-secondary/30 p-2.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Reports Logged</span>
              <FileText className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.totalReports}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">{metrics.totalHours} hrs logged</div>
          </div>

          {/* Tasks Completed */}
          <div className="rounded border border-border/70 bg-secondary/30 p-2.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Tasks</span>
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.completedTasks} <span className="text-xs text-muted-foreground font-normal">/ {metrics.totalTasks}</span>
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono">{metrics.taskRate}% completion</div>
          </div>

          {/* GitHub Telemetry */}
          <div className="rounded border border-border/70 bg-secondary/30 p-2.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">GitHub Events</span>
              <GitBranch className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-foreground">
              {githubStats.totalCommits + githubStats.totalPRsOpened + githubStats.totalReviewsGiven}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">{githubStats.totalCommits} commits · {githubStats.totalPRsMerged} PRs merged</div>
          </div>

          {/* Learning Milestones */}
          <div className="rounded border border-border/70 bg-secondary/30 p-2.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Milestones</span>
              <Award className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-foreground">
              {metrics.approvedMilestones} <span className="text-xs text-muted-foreground font-normal">/ {metrics.totalMilestones}</span>
            </div>
            <div className="text-[10px] text-purple-700 dark:text-purple-300 font-mono">{metrics.milestoneRate}% mastered</div>
          </div>

          {/* Open Blockers */}
          <div className="col-span-2 sm:col-span-1 rounded border border-border/70 bg-secondary/30 p-2.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Blockers</span>
              <ShieldAlert className={`w-3.5 h-3.5 ${metrics.openBlockers > 0 ? "text-red-500 animate-pulse" : "text-emerald-500"}`} />
            </div>
            <div className={`mt-1 text-xl font-bold font-mono tabular-nums ${metrics.openBlockers > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {metrics.openBlockers}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {metrics.openBlockers > 0 ? "Needs triage" : "No active blockers"}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. WORKSTATION SEGMENTED TABS ─────────────────────────────────── */}
      <div className="flex border-b border-border gap-1 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono transition-all border-b-2 whitespace-nowrap rounded-t-sm ${
                isActive
                  ? "border-primary text-foreground font-bold bg-secondary/40 shadow-xs"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`ml-1 rounded px-1.5 py-0.2 text-[10px] font-mono ${
                    tab.alert
                      ? "bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/30"
                      : isActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Competencies & Reports */}
            <div className="lg:col-span-2 space-y-6">
              {/* Learning Milestone Progress Card */}
              <div className="rounded-md border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                      Curriculum Competencies & Milestones
                    </h2>
                  </div>
                  <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                    {metrics.approvedMilestones} of {metrics.totalMilestones} Completed ({metrics.milestoneRate}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-3.5 h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${metrics.milestoneRate}%` }}
                  />
                </div>

                {/* Milestone Pills */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {mentee.menteeMilestones?.slice(0, 4).map((m: any) => (
                    <div
                      key={m.id}
                      className="rounded border border-border bg-secondary/30 p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate">{m.milestone.title}</span>
                        <Badge
                          variant={m.status === "APPROVED" ? "success" : "outline"}
                          className="text-[9.5px] font-mono"
                        >
                          {m.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px] line-clamp-1">{m.milestone.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Latest Daily Progress Report Snapshot */}
              <div className="rounded-md border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                      Latest Engineering Submission
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("reports")}
                    className="h-7 text-xs text-primary"
                  >
                    View All &rarr;
                  </Button>
                </div>

                {mentee.dailyReports?.length > 0 ? (
                  <div className="mt-3 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        Reported for: <strong className="text-foreground">{formatDate(mentee.dailyReports[0].reportDate)}</strong>
                      </div>
                      <Badge
                        variant={
                          mentee.dailyReports[0].status === "REVIEWED"
                            ? "success"
                            : mentee.dailyReports[0].status === "CHANGES_REQUESTED"
                            ? "warning"
                            : "default"
                        }
                        className="font-mono text-[10px]"
                      >
                        {mentee.dailyReports[0].status}
                      </Badge>
                    </div>

                    <div className="rounded border border-border bg-secondary/30 p-3">
                      <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                        Work Accomplished
                      </span>
                      <p className="text-foreground leading-relaxed whitespace-pre-line">
                        {mentee.dailyReports[0].workDone}
                      </p>
                    </div>

                    {mentee.dailyReports[0].blockers && (
                      <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-red-950 dark:text-red-200">
                        <span className="font-mono text-[10px] font-bold uppercase text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-0.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Blocker Logged
                        </span>
                        <p className="text-xs text-red-900 dark:text-red-200">{mentee.dailyReports[0].blockers}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No engineering submissions logged yet.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Bio & Selected Repositories */}
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="rounded-md border border-border bg-card p-4 shadow-xs text-xs space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground pb-2 border-b border-border">
                  Mentee Background
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {mentee.bio || "Fellow engaged in active open-source contribution and systems programming."}
                </p>
                <div className="divide-y divide-border/60 font-mono text-[11px] pt-1">
                  <div className="py-1.5 flex justify-between">
                    <span className="text-muted-foreground">Timezone:</span>
                    <span className="text-foreground font-semibold">{mentee.timezone || "UTC"}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-muted-foreground">Account Status:</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{mentee.status}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-muted-foreground">Events Attended:</span>
                    <span className="text-foreground font-semibold">{metrics.presentEvents} / {metrics.totalEvents}</span>
                  </div>
                </div>
              </div>

              {/* Selected Repositories */}
              <div className="rounded-md border border-border bg-card p-4 shadow-xs text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                    Tracked Repositories
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("repositories")}
                    className="h-6 text-[11px] text-primary"
                  >
                    Manage &rarr;
                  </Button>
                </div>

                {menteeRepositories?.length > 0 ? (
                  <div className="space-y-2">
                    {menteeRepositories.map((mr: any) => (
                      <div
                        key={mr.id}
                        className="rounded border border-border bg-secondary/30 p-2.5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderGit2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-mono text-xs font-semibold text-foreground truncate">
                            {mr.repository.name}
                          </span>
                        </div>
                        {mr.isPrimary && (
                          <Badge variant="outline" className="text-[9px] font-mono">
                            PRIMARY
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-[11px]">No repositories configured yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: DAILY REPORTS ─────────────────────────────────────────── */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-border bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              <span>All Daily Logs ({mentee.dailyReports?.length || 0})</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {["ALL", "SUBMITTED", "CHANGES_REQUESTED", "REVIEWED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setReportStatusFilter(st)}
                  className={`rounded px-2.5 py-1 text-[11px] font-mono transition-colors ${
                    reportStatusFilter === st
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st === "ALL" ? "All" : st === "SUBMITTED" ? "Needs Review" : st === "CHANGES_REQUESTED" ? "Changes Requested" : "Reviewed"}
                </button>
              ))}
            </div>
          </div>

          {mentee.dailyReports?.length === 0 ? (
            <div className="rounded-md border border-border bg-card py-16 text-center text-xs text-muted-foreground shadow-xs">
              No reports submitted yet by this mentee.
            </div>
          ) : (
            mentee.dailyReports
              .filter((r: any) => reportStatusFilter === "ALL" || r.status === reportStatusFilter)
              .map((r: any) => {
                const isReviewing = reviewingReportId === r.id;
                return (
                  <div
                    key={r.id}
                    className="overflow-hidden rounded-md border border-border bg-card shadow-xs transition-colors"
                  >
                    <div className="flex flex-col gap-2 border-b border-border/80 bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-sm text-foreground">
                          {formatDate(r.reportDate)}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          • {r.hoursSpent ?? "N/A"} hours spent
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {r.visibility}
                        </Badge>
                        <Badge
                          variant={r.status === "REVIEWED" ? "success" : r.status === "CHANGES_REQUESTED" ? "warning" : "default"}
                          className="font-mono text-[10px]"
                        >
                          {r.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 text-xs leading-relaxed">
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                          Work Accomplished
                        </span>
                        <p className="text-foreground leading-relaxed whitespace-pre-line font-sans">
                          {r.workDone}
                        </p>
                      </div>

                      {r.learning && (
                        <div>
                          <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                            Key Technical Learnings
                          </span>
                          <p className="text-foreground leading-relaxed whitespace-pre-line font-sans">
                            {r.learning}
                          </p>
                        </div>
                      )}

                      {r.blockers && (
                        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-950 dark:text-red-200">
                          <strong className="font-mono text-xs uppercase text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-0.5">
                            <AlertCircle className="w-3.5 h-3.5" /> Blockers / Technical Hurdles:
                          </strong>
                          <p className="text-red-900 dark:text-red-200 text-xs mt-0.5">{r.blockers}</p>
                        </div>
                      )}

                      {r.links?.length > 0 && (
                        <div className="pt-1">
                          <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block mb-1.5">
                            GitHub PRs & Commits
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {r.links.map((link: any) => {
                              const isVerified = githubActivities.some(
                                (a: any) => a.url && link.url && (
                                  a.url === link.url ||
                                  a.url.includes(link.url.replace('https://github.com/', '')) ||
                                  link.url.includes(a.providerEventId?.replace('commit_', '').slice(0, 8) || '___none___')
                                )
                              );
                              return (
                                <a
                                  key={link.id}
                                  href={link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                                    isVerified
                                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500/60'
                                      : 'border-border bg-secondary/50 text-foreground hover:border-primary/40 hover:text-primary'
                                  }`}
                                >
                                  {isVerified && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                  <Github className="w-3 h-3" />
                                  <span>{link.label}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  {isVerified && (
                                    <span className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                                      VERIFIED
                                    </span>
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {r.reviews?.length > 0 && (
                        <div className="pt-2 border-t border-border space-y-2">
                          <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block">
                            Mentor Review Feedback ({r.reviews.length})
                          </span>
                          {r.reviews.map((rev: any) => (
                            <div key={rev.id} className="rounded border border-border bg-secondary/30 p-2.5 text-xs">
                              <div className="flex items-center justify-between font-medium">
                                <span className="text-foreground">{rev.reviewer?.name || "Mentor"}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {formatDate(rev.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 text-muted-foreground leading-relaxed">{rev.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline Review Drawer */}
                      <div className="pt-2 border-t border-border">
                        {isReviewing ? (
                          <div className="space-y-3 rounded border border-primary/30 bg-secondary/20 p-3 mt-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold uppercase tracking-wide text-foreground">
                                Review Daily Submission
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingReportId(null);
                                  setReportReviewComment("");
                                }}
                                className="p-1 rounded text-muted-foreground hover:bg-muted"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <textarea
                              placeholder="Write actionable review feedback or reasons for changes requested..."
                              value={reportReviewComment}
                              onChange={(e) => setReportReviewComment(e.target.value)}
                              className="w-full h-20 rounded border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                            />

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setReviewingReportId(null);
                                  setReportReviewComment("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                loading={submittingReportReview}
                                disabled={!reportReviewComment.trim()}
                                onClick={() => handleReviewReport(r.id, "CHANGES_REQUESTED")}
                                className="border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
                              >
                                Request Changes
                              </Button>
                              <Button
                                size="sm"
                                loading={submittingReportReview}
                                disabled={!reportReviewComment.trim()}
                                onClick={() => handleReviewReport(r.id, "REVIEWED")}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                              >
                                Approve & Mark Reviewed
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReviewingReportId(r.id);
                              setReportReviewComment("");
                            }}
                            className="h-7 text-xs gap-1.5"
                          >
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span>Evaluate Submission</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* ── TAB 3: TASKS ─────────────────────────────────────────────────── */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-foreground">
              <CheckSquare className="w-4 h-4 text-primary" />
              <span>Assigned Engineering Tasks ({mentee.assignedTasks?.length || 0})</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {metrics.completedTasks} completed
            </div>
          </div>

          {mentee.assignedTasks?.length === 0 ? (
            <div className="rounded-md border border-border bg-card py-16 text-center text-xs text-muted-foreground shadow-xs">
              No tasks assigned to this mentee yet.
            </div>
          ) : (
            mentee.assignedTasks.map((a: any) => (
              <div
                key={a.id}
                className="overflow-hidden rounded-md border border-border bg-card shadow-xs text-xs"
              >
                <div className="p-4 border-b border-border/80 bg-secondary/30 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{a.task.title}</h3>
                    <p className="text-muted-foreground text-xs mt-0.5">{a.task.description}</p>
                  </div>
                  <Badge
                    variant={a.status === "ACCEPTED" || a.status === "COMPLETED" ? "success" : "outline"}
                    className="font-mono text-[10px]"
                  >
                    {a.status}
                  </Badge>
                </div>

                <div className="p-4 space-y-3">
                  {a.submissions?.map((sub: any) => (
                    <div key={sub.id} className="rounded border border-border bg-secondary/30 p-3">
                      <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                        Mentee Deliverable Note:
                      </span>
                      <p className="text-foreground leading-relaxed">{sub.notes}</p>
                      {sub.evidenceUrl && (
                        <a
                          href={sub.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-primary hover:underline text-[11px] mt-1.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{sub.evidenceUrl}</span>
                        </a>
                      )}
                    </div>
                  ))}

                  {a.reviews?.map((rev: any) => (
                    <div key={rev.id} className="rounded border border-primary/20 bg-primary/5 p-3">
                      <span className="font-mono text-[10px] font-bold uppercase text-primary block mb-0.5">
                        Mentor Evaluation ({rev.decision}):
                      </span>
                      <p className="text-foreground leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 4: GITHUB TELEMETRY ───────────────────────────────────────── */}
      {activeTab === "github" && (
        <GitHubCommandCenter
          ghAccount={ghAccount}
          githubStats={githubStats}
          githubActivities={githubActivities}
        />
      )}

      {/* ── TAB 5: REPOSITORIES ──────────────────────────────────────────── */}
      {activeTab === "repositories" && (
        <MemberRepositoriesClient
          organizationId={orgId}
          orgSlug={orgSlug}
          role="MENTEE"
          targetUserId={mentee.id}
          targetName={mentee.name}
          initialSelected={menteeRepositories}
        />
      )}

      {/* ── TAB 6: LEARNING PATH ─────────────────────────────────────────── */}
      {activeTab === "learning" && (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Curriculum Competency Tracking</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Milestones assigned across technical and collaborative skills.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {metrics.approvedMilestones} / {metrics.totalMilestones} Mastered
              </Badge>
            </div>

            <div className="mt-4 space-y-4">
              {mentee.menteeMilestones?.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No learning milestones assigned yet.
                </div>
              ) : (
                mentee.menteeMilestones.map((m: any) => {
                  const isPending = m.status === "SUBMITTED" || m.status === "RESUBMITTED";
                  const isReviewing = reviewingMilestoneId === m.milestoneId;
                  return (
                    <div
                      key={m.id}
                      className="rounded-md border border-border bg-secondary/20 p-4 space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{m.milestone.title}</span>
                          {m.milestone.skill && (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {m.milestone.skill.name}
                            </Badge>
                          )}
                        </div>
                        <Badge
                          variant={m.status === "APPROVED" ? "success" : isPending ? "warning" : "outline"}
                          className="font-mono text-[10px]"
                        >
                          {m.status}
                        </Badge>
                      </div>

                      <p className="text-muted-foreground leading-relaxed">{m.milestone.description}</p>

                      {m.notes && (
                        <div className="rounded border border-border bg-card p-3">
                          <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                            Submitted Evidence:
                          </span>
                          <p className="text-foreground leading-relaxed">{m.notes}</p>
                          {m.evidenceUrl && (
                            <a
                              href={m.evidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-primary hover:underline text-[11px] mt-1.5"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{m.evidenceUrl}</span>
                            </a>
                          )}
                        </div>
                      )}

                      {m.reviewComment && (
                        <div className="rounded border border-primary/20 bg-primary/5 p-3">
                          <span className="font-mono text-[10px] font-bold uppercase text-primary block mb-0.5">
                            Reviewer Feedback ({m.reviewedBy?.name || "Mentor"}):
                          </span>
                          <p className="text-foreground leading-relaxed">{m.reviewComment}</p>
                        </div>
                      )}

                      {/* Milestone Review Form */}
                      <div>
                        {isReviewing ? (
                          <form onSubmit={handleReviewMilestone} className="space-y-3 rounded border border-primary/30 bg-card p-3.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold uppercase text-foreground">
                                Grade Milestone Deliverable
                              </span>
                              <button
                                type="button"
                                onClick={() => setReviewingMilestoneId(null)}
                                className="p-1 rounded text-muted-foreground hover:bg-muted"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <label className="font-mono text-xs text-foreground font-semibold">Decision:</label>
                              <select
                                className="h-8 rounded border border-input bg-background px-3 font-mono text-xs"
                                value={milestoneDecision}
                                onChange={(e) => setMilestoneDecision(e.target.value as any)}
                              >
                                <option value="APPROVED">Approve Milestone</option>
                                <option value="CHANGES_REQUESTED">Request Changes</option>
                              </select>
                            </div>

                            <Textarea
                              placeholder="Review notes, feedback, or guidance..."
                              value={milestoneFeedback}
                              onChange={(e) => setMilestoneFeedback(e.target.value)}
                              required
                              rows={2}
                            />

                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setReviewingMilestoneId(null)}
                              >
                                Cancel
                              </Button>
                              <Button type="submit" size="sm" loading={submittingMilestone}>
                                Save Evaluation
                              </Button>
                            </div>
                          </form>
                        ) : isPending ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReviewingMilestoneId(m.milestoneId);
                              setMilestoneFeedback("");
                            }}
                            className="gap-1.5"
                          >
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span>Grade Evidence</span>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 7: BLOCKERS ──────────────────────────────────────────────── */}
      {activeTab === "blockers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-foreground">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>Technical Blockers & Assistance Log ({blockers?.length || 0})</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-red-700 dark:text-red-300 font-bold">{metrics.openBlockers} active</span>
            </div>
          </div>

          {blockers?.length === 0 ? (
            <div className="rounded-md border border-border bg-card py-16 text-center text-xs text-muted-foreground shadow-xs">
              No technical blockers logged for this mentee.
            </div>
          ) : (
            blockers.map((b: any) => {
              const isOpen = b.status === "OPEN" || b.status === "INVESTIGATING" || b.status === "REOPENED";
              const isTriaging = triagingBlockerId === b.id;
              return (
                <div
                  key={b.id}
                  className="rounded-md border border-border bg-card p-4 shadow-xs text-xs space-y-3"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{b.title}</span>
                      <Badge
                        variant={b.urgency === "CRITICAL" ? "destructive" : b.urgency === "HIGH" ? "warning" : "secondary"}
                        className="font-mono text-[10px]"
                      >
                        {b.urgency}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {b.status}
                      </Badge>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{formatDate(b.createdAt)}</span>
                  </div>

                  <p className="text-foreground leading-relaxed whitespace-pre-line bg-secondary/30 p-3 rounded border border-border">
                    {b.description}
                  </p>

                  {b.response && (
                    <div className="rounded border border-primary/20 bg-primary/5 p-3">
                      <span className="font-mono text-[10px] font-bold uppercase text-primary block mb-0.5">
                        Mentor Resolution Response ({b.mentor?.name || "Mentor"}):
                      </span>
                      <p className="text-foreground leading-relaxed">{b.response}</p>
                    </div>
                  )}

                  {/* Inline Triage Action */}
                  <div className="pt-2 border-t border-border">
                    {isTriaging ? (
                      <div className="space-y-3 rounded border border-primary/30 bg-secondary/20 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold uppercase text-foreground">
                            Resolve Blocker & Provide Guidance
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setTriagingBlockerId(null);
                              setBlockerResponse("");
                            }}
                            className="p-1 rounded text-muted-foreground hover:bg-muted"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="font-mono text-xs text-foreground font-semibold">Status:</label>
                          <select
                            className="h-8 rounded border border-input bg-background px-3 font-mono text-xs"
                            value={blockerStatusDecision}
                            onChange={(e) => setBlockerStatusDecision(e.target.value as any)}
                          >
                            <option value="RESOLVED">Mark Resolved</option>
                            <option value="IN_PROGRESS">Set In Progress</option>
                          </select>
                        </div>

                        <textarea
                          placeholder="Provide immediate technical steps to unblock the student..."
                          value={blockerResponse}
                          onChange={(e) => setBlockerResponse(e.target.value)}
                          className="w-full h-20 rounded border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTriagingBlockerId(null);
                              setBlockerResponse("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            loading={submittingBlocker}
                            disabled={!blockerResponse.trim()}
                            onClick={() => handleResolveBlocker(b.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          >
                            Submit Triage Guidance
                          </Button>
                        </div>
                      </div>
                    ) : isOpen ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTriagingBlockerId(b.id);
                          setBlockerResponse("");
                        }}
                        className="h-7 text-xs gap-1.5"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                        <span>Provide Unblocking Guidance</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB 8: FORMAL EVALUATIONS ────────────────────────────────────── */}
      {activeTab === "feedback" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-card p-3 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-foreground">Structured Mentorship Dossiers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Traceable formal assessments of code quality, architecture, and velocity.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowFeedbackModal(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Write Evaluation</span>
            </Button>
          </div>

          {mentee.feedbackReceived?.length === 0 ? (
            <div className="rounded-md border border-border bg-card py-16 text-center text-xs text-muted-foreground shadow-xs">
              No formal evaluations logged for this mentee yet.
            </div>
          ) : (
            mentee.feedbackReceived.map((f: any) => (
              <div
                key={f.id}
                className="rounded-md border border-border bg-card p-5 shadow-xs text-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{f.author?.name || "Mentor"}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {f.category}
                    </Badge>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDate(f.createdAt)}</span>
                </div>

                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Executive Assessment
                  </span>
                  <p className="text-foreground leading-relaxed whitespace-pre-line font-sans">{f.content}</p>
                </div>

                {(f.technicalStrengths || f.areasForImprovement || f.codeQuality) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-border">
                    {f.technicalStrengths && (
                      <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-200">
                        <strong className="font-mono uppercase text-emerald-700 dark:text-emerald-300 block mb-1">
                          Key Strengths:
                        </strong>
                        <p className="leading-relaxed">{f.technicalStrengths}</p>
                      </div>
                    )}
                    {f.areasForImprovement && (
                      <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-200">
                        <strong className="font-mono uppercase text-amber-700 dark:text-amber-300 block mb-1">
                          Areas for Growth:
                        </strong>
                        <p className="leading-relaxed">{f.areasForImprovement}</p>
                      </div>
                    )}
                    {f.codeQuality && (
                      <div className="rounded border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-950 dark:text-blue-200">
                        <strong className="font-mono uppercase text-blue-700 dark:text-blue-300 block mb-1">
                          Code Quality:
                        </strong>
                        <p className="leading-relaxed">{f.codeQuality}</p>
                      </div>
                    )}
                  </div>
                )}

                {f.privateNotes && (
                  <div className="rounded border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-purple-950 dark:text-purple-200">
                    <strong className="font-mono uppercase text-purple-700 dark:text-purple-300 block mb-1">
                      Private Mentor Notes (Confidential):
                    </strong>
                    <p className="leading-relaxed">{f.privateNotes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 9: ATTENDANCE ────────────────────────────────────────────── */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-card p-4 shadow-xs">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Cohort Sync & Event Attendance</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Attendance rate for scheduled mentorship syncs and cohort workshops.
              </p>
            </div>
            <Badge variant="success" className="font-mono text-xs">
              {metrics.attendanceRate}% Attendance
            </Badge>
          </div>

          {mentee.attendances?.length === 0 ? (
            <div className="rounded-md border border-border bg-card py-16 text-center text-xs text-muted-foreground shadow-xs">
              No attendance records recorded for this mentee.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border bg-card shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 font-mono text-[10px] uppercase text-muted-foreground tracking-wider">
                    <th className="py-2.5 px-4">Event Title</th>
                    <th className="py-2.5 px-4">Scheduled Date</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {mentee.attendances.map((att: any) => (
                    <tr key={att.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{att.event?.title}</td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{formatDate(att.event?.startsAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant={att.status === "PRESENT" ? "success" : "outline"} className="font-mono text-[10px]">
                          {att.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 10: COMMUNITY ────────────────────────────────────────────── */}
      {activeTab === "communication" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Discussion Posts */}
          <div className="rounded-md border border-border bg-card p-4 shadow-xs space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground pb-2 border-b border-border">
              Discussion Topics Authored ({discussionPosts.length})
            </h3>
            {discussionPosts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No community topics started.</p>
            ) : (
              <div className="divide-y divide-border/50 text-xs">
                {discussionPosts.map((post) => (
                  <div key={post.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground truncate">{post.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{formatDate(post.createdAt)}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">{post.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discussion Comments */}
          <div className="rounded-md border border-border bg-card p-4 shadow-xs space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground pb-2 border-b border-border">
              Discussion Replies Authored ({discussionComments.length})
            </h3>
            {discussionComments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No discussion replies posted.</p>
            ) : (
              <div className="divide-y divide-border/50 text-xs">
                {discussionComments.map((comment) => (
                  <div key={comment.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                      <span className="truncate">On &quot;{comment.post?.title}&quot;</span>
                      <span>{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-foreground leading-relaxed">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EVALUATION MODAL ─────────────────────────────────────────────── */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-xl max-h-[92vh] overflow-hidden rounded-md border border-border bg-card shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Structured Mentorship Evaluation — {mentee.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <form onSubmit={handleCreateFeedback} className="space-y-4">
                {feedbackError && (
                  <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{feedbackError}</span>
                  </div>
                )}

                {/* Quick Helper Snippets */}
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground block mb-1.5">
                    Quick Review Templates
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickFeedbackSnippets.map((snip) => (
                      <button
                        key={snip}
                        type="button"
                        onClick={() =>
                          setFeedbackContent((prev) => (prev ? `${prev} ${snip}` : snip))
                        }
                        className="rounded border border-border bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                      >
                        + {snip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[11px] font-bold uppercase text-foreground block">
                    Evaluation Category
                  </label>
                  <select
                    className="w-full h-9 rounded border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:border-primary font-sans"
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                  >
                    <option value="GENERAL">General Progress / Weekly Review</option>
                    <option value="TECHNICAL">Technical Architecture & Engineering Quality</option>
                    <option value="COLLABORATION">Team Collaboration & Autonomy</option>
                    <option value="COMMUNICATION">Documentation & Communication</option>
                    <option value="LEARNING">Learning Velocity & Milestone Progress</option>
                  </select>
                </div>

                <Textarea
                  label="Executive Summary & Guidance *"
                  placeholder="Comprehensive assessment of engineering progress, velocity, and key next milestones..."
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  required
                  rows={3}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Textarea
                    label="Technical Strengths"
                    placeholder="Specific proficiencies (e.g. concurrency, kernel tracing, clean PRs)..."
                    value={technicalStrengths}
                    onChange={(e) => setTechnicalStrengths(e.target.value)}
                    rows={2}
                  />
                  <Textarea
                    label="Areas for Growth"
                    placeholder="Constructive areas (e.g. edge-case tests, benchmarks)..."
                    value={areasForImprovement}
                    onChange={(e) => setAreasForImprovement(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Code Quality Rating / Notes"
                    placeholder="e.g. High test coverage, clean modularity"
                    value={codeQuality}
                    onChange={(e) => setCodeQuality(e.target.value)}
                  />
                  <div>
                    <label className="font-mono text-[11px] font-bold uppercase text-foreground block mb-1">
                      Visibility
                    </label>
                    <select
                      className="w-full h-9 bg-background border border-input rounded px-3 text-xs text-foreground focus:outline-none focus:border-primary font-sans"
                      value={feedbackVisibility}
                      onChange={(e) => setFeedbackVisibility(e.target.value as any)}
                    >
                      <option value="PRIVATE_TO_MENTEE">Private to Student & Mentors</option>
                      <option value="COHORT">Shared to Cohort</option>
                      <option value="PRIVATE_TO_MENTORS">Confidential (Mentors Only)</option>
                    </select>
                  </div>
                </div>

                <Textarea
                  label="Private Mentor / Admin Notes (Hidden from Mentee)"
                  placeholder="Confidential observations, retention notes, or mentor discussions..."
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  rows={2}
                />

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFeedbackModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submittingFeedback}>
                    Publish Evaluation
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
