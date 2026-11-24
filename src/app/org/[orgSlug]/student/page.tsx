import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/date";
import { getDateKeyInTimeZone } from "@/lib/timezone";
import {
  FileText,
  CheckSquare,
  Award,
  ArrowRight,
  AlertTriangle,
  Flame,
  Clock,
  Calendar,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  FolderGit2,
  Github,
  Zap,
  Target,
  ExternalLink,
  MessageSquare,
} from "lucide-react";

export default async function StudentDashboardPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const activeEnrollments = await prisma.cohortEnrollment.findMany({
    where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId: org.id, status: "ACTIVE" } },
    include: { cohort: { select: { id: true, name: true } } },
  });
  const activeCohortIds = activeEnrollments.map((enrollment) => enrollment.cohortId);
  const activeCohortNames = [...new Set(activeEnrollments.map((enrollment) => enrollment.cohort.name))];
  const visibleLearningPathScope = {
    organizationId: org.id,
    OR: [{ cohortId: null }, { cohortId: { in: activeCohortIds } }],
  };
  const visibleTaskScope = {
    organizationId: org.id,
    OR: [{ cohortId: null }, { cohortId: { in: activeCohortIds } }],
  };

  // 1. Today's report check
  const todayKey = getDateKeyInTimeZone(new Date(), org.timezone || "UTC");
  const today = new Date(`${todayKey}T00:00:00.000Z`);

  const todaysReports = await prisma.dailyReport.findMany({
    where: {
      menteeId: session.id,
      organizationId: org.id,
      reportDate: today,
      cohortId: { in: activeCohortIds },
    },
    select: { id: true, cohortId: true, status: true },
  });
  const submittedTodayCohortIds = new Set(todaysReports.map((report) => report.cohortId));
  const cohortsMissingToday = activeCohortIds.filter((cohortId) => !submittedTodayCohortIds.has(cohortId));
  const todaysReport = todaysReports.find((report) => report.status === "CHANGES_REQUESTED")
    || todaysReports[0]
    || null;

  // 2. Compute reporting streak from database
  const pastReports = await prisma.dailyReport.findMany({
    where: {
      menteeId: session.id,
      organizationId: org.id,
      status: { in: ["SUBMITTED", "REVIEWED", "CHANGES_REQUESTED", "RESUBMITTED"] },
    },
    select: { reportDate: true },
    orderBy: { reportDate: "desc" },
  });

  const dates = new Set(pastReports.map((r) => r.reportDate.toISOString().split("T")[0]));
  let streak = 0;
  if (pastReports.length > 0) {
    let checkDate = new Date(today);
    const todayStr = checkDate.toISOString().split("T")[0];
    if (!dates.has(todayStr)) {
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }
    while (dates.has(checkDate.toISOString().split("T")[0])) {
      streak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }
  }

  // Visual 7-day check-in pills
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (6 - i));
    const dStr = d.toISOString().split("T")[0];
    const isToday = i === 6;
    const hasReport = dates.has(dStr);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[d.getUTCDay()];
    return { date: dStr, dayName, isToday, hasReport };
  });

  // 3. Counts from DB
  const [
    totalReports,
    awaitingReviewReports,
    changesRequestedReports,
    completedTasks,
    pendingTasks,
    overdueTasks,
    openBlockers,
    approvedMilestones,
    totalMilestones,
    upcomingEvents,
    recentFeedback,
  ] = await Promise.all([
    prisma.dailyReport.count({
      where: { menteeId: session.id, organizationId: org.id },
    }),
    prisma.dailyReport.count({
      where: {
        menteeId: session.id,
        organizationId: org.id,
        status: { in: ["SUBMITTED", "RESUBMITTED"] },
      },
    }),
    prisma.dailyReport.count({
      where: {
        menteeId: session.id,
        organizationId: org.id,
        status: "CHANGES_REQUESTED",
      },
    }),
    prisma.taskAssignment.count({
      where: {
        menteeId: session.id,
        task: { ...visibleTaskScope },
        status: "COMPLETED",
      },
    }),
    prisma.taskAssignment.count({
      where: {
        menteeId: session.id,
        task: { ...visibleTaskScope },
        status: { in: ["TODO", "IN_PROGRESS", "SUBMITTED", "RESUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "BLOCKED", "OVERDUE"] },
      },
    }),
    prisma.taskAssignment.count({
      where: {
        menteeId: session.id,
        task: { ...visibleTaskScope, dueAt: { lt: new Date() } },
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
    }),
    prisma.blocker.count({
      where: {
        menteeId: session.id,
        organizationId: org.id,
        status: { in: ["OPEN", "IN_PROGRESS", "REOPENED"] },
      },
    }),
    prisma.menteeMilestone.count({
      where: {
        menteeId: session.id,
        status: "APPROVED",
        milestone: { learningPath: visibleLearningPathScope },
      },
    }),
    prisma.learningMilestone.count({
      where: { learningPath: visibleLearningPathScope },
    }),
    prisma.event.findMany({
      where: {
        organizationId: org.id,
        startsAt: { gte: new Date() },
        OR: [{ cohortId: null }, { cohortId: { in: activeCohortIds } }],
      },
      include: {
        rsvps: { where: { userId: session.id } },
      },
      orderBy: { startsAt: "asc" },
      take: 3,
    }),
    prisma.feedback.findFirst({
      where: {
        menteeId: session.id,
        organizationId: org.id,
        status: "PUBLISHED",
        visibility: { in: ["PRIVATE_TO_MENTEE", "COHORT"] },
        deletedAt: null,
      },
      include: { author: { select: { id: true, name: true, imageUrl: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Tasks needing attention
  const attentionTasks = await prisma.taskAssignment.findMany({
    where: {
      menteeId: session.id,
      task: { ...visibleTaskScope },
      status: { in: ["CHANGES_REQUESTED", "TODO", "IN_PROGRESS", "BLOCKED", "OVERDUE"] },
    },
    include: { task: true },
    take: 4,
  });

  // Recent GitHub Activity
  const ghAccount = await prisma.gitHubAccount.findFirst({
    where: { userId: session.id, connectionStatus: "CONNECTED" },
    orderBy: { connectedAt: "desc" },
  });

  const selectedRepositories = await prisma.userRepository.findMany({
    where: { organizationId: org.id, userId: session.id },
    select: { repositoryId: true },
  });
  const selectedRepositoryIds = selectedRepositories.map((item) => item.repositoryId);
  const recentActivities = ghAccount && selectedRepositoryIds.length
    ? await prisma.gitHubActivity.findMany({
        where: {
          githubAccountId: ghAccount.id,
          organizationId: org.id,
          repositoryId: { in: selectedRepositoryIds },
          isFixture: false,
        },
        orderBy: { occurredAt: "desc" },
        take: 5,
      })
    : [];

  // Compute Task Velocity & Milestones Progress
  const totalTasks = completedTasks + pendingTasks;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const milestoneProgress = totalMilestones > 0 ? Math.round((approvedMilestones / totalMilestones) * 100) : 0;
  const streakProgress = Math.min(Math.round((streak / 14) * 100), 100);

  // Construct "Needs Your Attention" items
  const attentionItems: { title: string; desc: string; href: string; severity: "urgent" | "warning" | "info" }[] = [];

  if (activeCohortIds.length > 0 && cohortsMissingToday.length > 0) {
    attentionItems.push({
      title: cohortsMissingToday.length === activeCohortIds.length ? "Today's Daily Log Pending" : `Daily Log Pending in ${cohortsMissingToday.length} Cohort(s)`,
      desc: `Submit today's work log for ${cohortsMissingToday.length} active cohort${cohortsMissingToday.length === 1 ? "" : "s"} to keep your program record complete.`,
      href: `/org/${params.orgSlug}/student/daily-log`,
      severity: "warning",
    });
  }
  if (todaysReports.some((report) => report.status === "CHANGES_REQUESTED")) {
    attentionItems.push({
      title: "Mentor Requested Changes on Today's Report",
      desc: "At least one of today's cohort reports needs additional details or clarification from you.",
      href: `/org/${params.orgSlug}/student/daily-log`,
      severity: "urgent",
    });
  }

  if (changesRequestedReports > 0 && todaysReport?.status !== "CHANGES_REQUESTED") {
    attentionItems.push({
      title: `${changesRequestedReports} Report(s) Need Revisions`,
      desc: "Check mentor feedback comments and resubmit the requested deliverables.",
      href: `/org/${params.orgSlug}/student/reports`,
      severity: "urgent",
    });
  }

  if (openBlockers > 0) {
    attentionItems.push({
      title: `${openBlockers} Active Blocker(s) Open`,
      desc: "Track mentor triage guidance and resolution updates in the blocker triage queue.",
      href: `/org/${params.orgSlug}/student/blockers`,
      severity: "warning",
    });
  }

  if (overdueTasks > 0) {
    attentionItems.push({
      title: `${overdueTasks} Overdue Task(s)`,
      desc: "Sprint deliverables have passed their due date. Submit work or communicate with your mentor.",
      href: `/org/${params.orgSlug}/student/tasks`,
      severity: "urgent",
    });
  }

  const unRsvpedEvents = upcomingEvents.filter((ev) => ev.rsvps.length === 0);
  if (unRsvpedEvents.length > 0) {
    attentionItems.push({
      title: `${unRsvpedEvents.length} Upcoming Event(s) Need RSVP`,
      desc: `Confirm attendance for "${unRsvpedEvents[0].title}"${unRsvpedEvents.length > 1 ? ` and ${unRsvpedEvents.length - 1} more` : ""}.`,
      href: `/org/${params.orgSlug}/student/events`,
      severity: "info",
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. Hero Contributor Mission Control Banner */}
      <div className="page-hero">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan" dot className="font-mono text-[10px]">
                {activeCohortNames.length > 0
                  ? `Active cohort${activeCohortNames.length === 1 ? "" : "s"}: ${activeCohortNames.join(", ")}`
                  : "No active cohort enrollment"}
              </Badge>
              {ghAccount ? (
                <a
                  href={`https://github.com/${ghAccount.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border/60 bg-muted/40 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <Github className="w-3 h-3 text-foreground" />
                  <span>@{ghAccount.username}</span>
                </a>
              ) : (
                <Link href={`/org/${params.orgSlug}/student/github`}>
                  <Badge variant="warning" className="cursor-pointer">
                    Link GitHub
                  </Badge>
                </Link>
              )}
            </div>

            <h1 className="page-title">
              Welcome back, {session.name || "there"}
            </h1>

            <p className="page-description">
              Your daily progress, assigned work, repository activity, and mentor feedback in one place.
            </p>
          </div>

          {/* Quick Action Button Group */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link href={`/org/${params.orgSlug}/student/blockers`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>Raise Blocker</span>
              </Button>
            </Link>
            <Link href={`/org/${params.orgSlug}/student/daily-log`}>
              <Button size="sm" className="gap-1.5 text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" />
                <span>{todaysReports.length > 1 ? "Open Today's Logs" : todaysReport ? (["DRAFT", "CHANGES_REQUESTED"].includes(todaysReport.status) ? "Continue Today's Log" : "View Today's Log") : "Submit Daily Log"}</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Reporting cadence */}
        <div className="mt-6 flex flex-col gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="metric-icon h-10 w-10 rounded-xl">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground">
                {streak} day reporting streak
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {streak > 0 ? "Consecutive calendar days with at least one submitted report." : "Submit a daily report to start your streak."}
              </p>
            </div>
          </div>

          {/* 7-Day Mini Dots Tracker */}
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-2">
            {last7Days.map((day, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 px-1.5">
                <span className="text-[9px] font-mono text-muted-foreground uppercase">{day.dayName}</span>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    day.hasReport
                      ? "bg-emerald-500 text-white shadow-xs"
                      : day.isToday
                      ? "border-2 border-amber-500 text-amber-500 animate-pulse"
                      : "bg-muted text-muted-foreground/50 border border-border/60"
                  }`}
                  title={`${day.date}: ${day.hasReport ? "Logged" : day.isToday ? "Due Today" : "Missed"}`}
                >
                  {day.hasReport ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : day.isToday ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  ) : (
                    <span>&bull;</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Action Required Callout Banner */}
      {attentionItems.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Action Required ({attentionItems.length})
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Items needing your immediate input to keep mentorship velocity on track.
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            <div className="divide-y divide-border/40">
              {attentionItems.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-foreground block truncate">{item.title}</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1">{item.desc}</p>
                  </div>
                  <Link href={item.href} className="shrink-0">
                    <Button variant="outline" size="sm" className="text-xs font-semibold gap-1">
                      <span>Resolve</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. High-Impact Metric Grid (Clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href={`/org/${params.orgSlug}/student/reports`}>
          <MetricCard
            title="Daily Log Streak"
            value={`${streak} Days`}
            icon={<Flame className="w-4 h-4 text-amber-500" />}
            accent="flame"
            trend={streak > 0 ? "Active" : "Pending"}
            trendType={streak > 0 ? "positive" : "warning"}
            progress={streakProgress}
            description={`${totalReports} reports logged (${awaitingReviewReports} in mentor review)`}
          />
        </Link>

        <Link href={`/org/${params.orgSlug}/student/tasks`}>
          <MetricCard
            title="Task Completion Velocity"
            value={`${completedTasks}/${totalTasks}`}
            icon={<CheckSquare className="w-4 h-4 text-emerald-500" />}
            accent="emerald"
            trend={overdueTasks > 0 ? `${overdueTasks} Overdue` : `${taskProgress}% Complete`}
            trendType={overdueTasks > 0 ? "negative" : "positive"}
            progress={taskProgress}
            description={`${pendingTasks} sprint tasks currently active`}
          />
        </Link>

        <Link href={`/org/${params.orgSlug}/student/blockers`}>
          <MetricCard
            title="Blocker Triage"
            value={openBlockers}
            icon={<AlertCircle className="w-4 h-4 text-rose-500" />}
            accent="rose"
            trend={openBlockers > 0 ? "Needs Triage" : "All Clear"}
            trendType={openBlockers > 0 ? "warning" : "positive"}
            description={openBlockers > 0 ? "Mentors notified for assistance" : "No unresolved impediments"}
          />
        </Link>

        <Link href={`/org/${params.orgSlug}/student/learning`}>
          <MetricCard
            title="Learning Mastery"
            value={`${approvedMilestones}/${totalMilestones}`}
            icon={<Award className="w-4 h-4 text-purple-500" />}
            accent="purple"
            trend={`${milestoneProgress}%`}
            trendType="positive"
            progress={milestoneProgress}
            description="Verified skills & architecture milestones"
          />
        </Link>
      </div>

      {/* 4. Main Telemetry Grid (2/3 + 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sprint Tasks & Upcoming Syncs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Tasks & Deadlines */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold">Active Sprint Tasks & Goals</CardTitle>
              </div>
              <Link href={`/org/${params.orgSlug}/student/tasks`}>
                <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  View All Tasks <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {attentionTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/80 mx-auto" />
                  <p className="font-semibold text-foreground">All caught up!</p>
                  <p className="text-[11px] text-muted-foreground">No active tasks requiring immediate submission.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {attentionTasks.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="group p-3.5 rounded-xl border border-border/60 hover:border-primary/40 bg-card/60 hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                            {assignment.task.title}
                          </span>
                          <Badge
                            variant={
                              assignment.task.priority === "URGENT"
                                ? "destructive"
                                : assignment.task.priority === "HIGH"
                                ? "warning"
                                : "secondary"
                            }
                            className="text-[9px] py-0 px-1.5"
                          >
                            {assignment.task.priority}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="font-mono bg-muted/60 px-1.5 py-0.2 rounded text-[10px]">
                            {assignment.task.category}
                          </span>
                          {assignment.task.dueAt && (
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 text-muted-foreground/70" />
                              <span>Due: {formatDate(assignment.task.dueAt)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={
                            assignment.status === "CHANGES_REQUESTED"
                              ? "warning"
                              : assignment.status === "COMPLETED"
                              ? "success"
                              : "outline"
                          }
                        >
                          {assignment.status}
                        </Badge>
                        <Link href={`/org/${params.orgSlug}/student/tasks`}>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2.5">
                            Submit Work
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Meetings & Syncs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold">Upcoming Cohort Syncs & Standups</CardTitle>
              </div>
              <Link href={`/org/${params.orgSlug}/student/events`}>
                <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  Full Schedule <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No upcoming meetings or events scheduled this week.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingEvents.map((ev) => {
                    const myRsvp = ev.rsvps[0];
                    return (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl border border-border/60 bg-card/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-foreground text-xs">{ev.title}</span>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3 text-primary" />
                            <span>{formatDateTime(ev.startsAt)}</span>
                            {ev.location && (
                              <>
                                <span>&bull;</span>
                                <span className="text-foreground/80">{ev.location}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={myRsvp?.status === "YES" ? "success" : "secondary"}>
                            RSVP: {myRsvp?.status || "PENDING"}
                          </Badge>
                          <Link href={`/org/${params.orgSlug}/student/events`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                              Update
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
        </div>

        {/* Right Column: Mentor Feedback & Live GitHub Stream */}
        <div className="space-y-6">
          {/* Latest Mentor Review */}
          {recentFeedback && (
            <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-card to-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-bold">Latest Mentor Review</CardTitle>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatDate(recentFeedback.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">
                    {(recentFeedback.author.name || "M").charAt(0)}
                  </div>
                  <span className="font-semibold text-foreground">{recentFeedback.author.name || "Mentor"}</span>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-xs italic text-foreground/90 leading-relaxed">
                  &ldquo;{recentFeedback.content}&rdquo;
                </div>

                <Link href={`/org/${params.orgSlug}/student/feedback`}>
                  <Button variant="outline" size="sm" className="w-full text-xs font-semibold">
                    View & Acknowledge Feedback
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* GitHub Telemetry Stream */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-foreground" />
                <CardTitle className="text-sm font-bold">Verified GitHub Stream</CardTitle>
              </div>
              <Link href={`/org/${params.orgSlug}/student/github`}>
                <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  Full Stream <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {recentActivities.length ? (
                <ActivityTimeline items={recentActivities} />
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
                  <p className="text-sm font-medium">No verified activity for your selected repositories yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the repositories you work on and link your GitHub identity. Public activity is synced periodically.</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Link href={`/org/${params.orgSlug}/student/repositories`}><Button size="sm" variant="outline">Choose repositories</Button></Link>
                    <Link href={`/org/${params.orgSlug}/student/github`}><Button size="sm">Connect GitHub</Button></Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
