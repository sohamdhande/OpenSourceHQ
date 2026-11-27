import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { getMentorAnalytics } from "@/features/analytics/analytics-service";
import { getDateKeyInTimeZone } from "@/lib/timezone";
import {
  Users,
  FileText,
  CheckSquare,
  ShieldAlert,
  Award,
  Clock,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Layers,
  GraduationCap,
  FolderGit2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function MentorDashboardPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const analytics = await getMentorAnalytics(session, org.id);

  // Scope every mentor dashboard query to active cohorts and active mentee enrollments.
  const cohortMentors = await prisma.cohortMentor.findMany({
    where: {
      mentorId: session.id,
      cohort: { organizationId: org.id, status: "ACTIVE" },
      mentor: { memberships: { some: { organizationId: org.id, role: { in: ["MENTOR", "ORG_ADMIN"] }, status: "ACTIVE" } } },
    },
    select: { cohortId: true },
  });
  const mentorCohortIds = cohortMentors.map((row) => row.cohortId);
  const todayKey = getDateKeyInTimeZone(new Date(), org.timezone || "UTC");
  const today = new Date(`${todayKey}T00:00:00.000Z`);

  const activeEnrollments = await prisma.cohortEnrollment.findMany({
    where: {
      cohortId: { in: mentorCohortIds },
      status: "ACTIVE",
      cohort: { organizationId: org.id, status: "ACTIVE" },
      mentee: { memberships: { some: { organizationId: org.id, role: "MENTEE", status: "ACTIVE" } } },
    },
    include: {
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          dailyReports: {
            where: { organizationId: org.id, reportDate: today, status: { not: "DRAFT" } },
            select: { id: true },
          },
        },
      },
      cohort: { select: { id: true, name: true } },
    },
  });
  const scopedMenteeIds = [...new Set(activeEnrollments.map((row) => row.menteeId))];
  const enrollmentPairs = activeEnrollments.map((row) => ({ cohortId: row.cohortId, menteeId: row.menteeId }));

  // 1. Pending reports: exact active mentor/mentee cohort pairs only.
  const pendingReports = enrollmentPairs.length
    ? await prisma.dailyReport.findMany({
        where: {
          organizationId: org.id,
          status: { in: ["SUBMITTED", "RESUBMITTED"] },
          OR: enrollmentPairs,
        },
        include: {
          mentee: { select: { id: true, name: true, email: true } },
          cohort: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 6,
      })
    : [];

  // 2. Pending task reviews: scoped cohort tasks plus organization-wide assignments
  // for mentees the mentor actively supervises.
  const taskScopes = [
    ...enrollmentPairs.map((pair) => ({ menteeId: pair.menteeId, task: { organizationId: org.id, archivedAt: null, cohortId: pair.cohortId } })),
    ...(scopedMenteeIds.length ? [{ menteeId: { in: scopedMenteeIds }, task: { organizationId: org.id, archivedAt: null, cohortId: null } }] : []),
  ];
  const pendingTasks = taskScopes.length
    ? await prisma.taskAssignment.findMany({
        where: { status: { in: ["SUBMITTED", "RESUBMITTED"] }, OR: taskScopes },
        include: {
          mentee: { select: { id: true, name: true, email: true } },
          task: { select: { id: true, title: true, priority: true } },
          submissions: { orderBy: { submittedAt: "desc" }, take: 1 },
        },
        orderBy: { assignedAt: "desc" },
        take: 6,
      })
    : [];

  // 3. Active blockers: exact active enrollment pairs, never the whole tenant.
  const activeBlockers = enrollmentPairs.length
    ? await prisma.blocker.findMany({
        where: {
          organizationId: org.id,
          status: { in: ["OPEN", "IN_PROGRESS", "REOPENED"] },
          OR: enrollmentPairs,
        },
        include: {
          mentee: { select: { id: true, name: true, email: true } },
          cohort: { select: { id: true, name: true } },
        },
        orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
        take: 6,
      })
    : [];

  // 4. Learning reviews: organization-wide paths for supervised mentees and
  // cohort paths only for mentees enrolled in that exact cohort.
  const menteesByCohort = new Map<string, string[]>();
  for (const pair of enrollmentPairs) {
    const ids = menteesByCohort.get(pair.cohortId) || [];
    if (!ids.includes(pair.menteeId)) ids.push(pair.menteeId);
    menteesByCohort.set(pair.cohortId, ids);
  }
  const milestoneScopes = [
    ...(scopedMenteeIds.length ? [{ menteeId: { in: scopedMenteeIds }, milestone: { learningPath: { organizationId: org.id, cohortId: null } } }] : []),
    ...[...menteesByCohort.entries()].map(([cohortId, menteeIds]) => ({
      menteeId: { in: menteeIds },
      milestone: { learningPath: { organizationId: org.id, cohortId } },
    })),
  ];
  const pendingMilestones = milestoneScopes.length
    ? await prisma.menteeMilestone.findMany({
        where: { status: { in: ["SUBMITTED", "RESUBMITTED"] }, OR: milestoneScopes },
        include: {
          mentee: { select: { id: true, name: true } },
          milestone: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      })
    : [];

  // 5. Missing reports are computed in the organization's configured timezone.
  const missingReportMentees = activeEnrollments.filter((row) => row.mentee.dailyReports.length === 0);

  // 5b. Silent / At-Risk Mentee Radar (no report in 3+ days OR no GitHub event in 5+ days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const [recentMenteeReports, recentMenteeGithub] = scopedMenteeIds.length
    ? await Promise.all([
        prisma.dailyReport.findMany({
          where: {
            organizationId: org.id,
            menteeId: { in: scopedMenteeIds },
            status: { not: "DRAFT" },
            reportDate: { gte: threeDaysAgo },
          },
          select: { menteeId: true },
        }),
        prisma.gitHubActivity.findMany({
          where: {
            organizationId: org.id,
            isFixture: false,
            occurredAt: { gte: fiveDaysAgo },
            githubAccount: { userId: { in: scopedMenteeIds } },
          },
          select: { githubAccount: { select: { userId: true } } },
        }),
      ])
    : [[], []];

  const activeReportingMenteeIds = new Set(recentMenteeReports.map((r) => r.menteeId));
  const activeGithubMenteeIds = new Set(
    recentMenteeGithub.map((a) => a.githubAccount?.userId).filter((id): id is string => Boolean(id))
  );

  const uniqueMenteeMap = new Map<string, { id: string; name: string; cohortName: string; reasons: string[] }>();
  for (const enr of activeEnrollments) {
    if (uniqueMenteeMap.has(enr.mentee.id)) continue;
    const reasons: string[] = [];
    if (!activeReportingMenteeIds.has(enr.mentee.id)) reasons.push("No report in 3+ days");
    if (!activeGithubMenteeIds.has(enr.mentee.id)) reasons.push("No GitHub activity in 5+ days");
    if (reasons.length > 0) {
      uniqueMenteeMap.set(enr.mentee.id, {
        id: enr.mentee.id,
        name: enr.mentee.name,
        cohortName: enr.cohort.name,
        reasons,
      });
    }
  }
  const atRiskMentees = Array.from(uniqueMenteeMap.values());

  // 6. GitHub telemetry is limited to repositories selected by supervised
  // mentees/this mentor or explicitly tracked by one of the mentor's cohorts.
  const [memberRepositoryRows, cohortRepositoryRows] = await Promise.all([
    scopedMenteeIds.length || session.id
      ? prisma.userRepository.findMany({
          where: { organizationId: org.id, userId: { in: [...new Set([...scopedMenteeIds, session.id])] } },
          select: { repositoryId: true },
        })
      : Promise.resolve([]),
    mentorCohortIds.length
      ? prisma.cohortRepository.findMany({ where: { cohortId: { in: mentorCohortIds }, trackingEnabled: true }, select: { repositoryId: true } })
      : Promise.resolve([]),
  ]);
  const trackedRepositoryIds = [...new Set([...memberRepositoryRows, ...cohortRepositoryRows].map((row) => row.repositoryId))];
  const recentActivities = trackedRepositoryIds.length
    ? await prisma.gitHubActivity.findMany({
        where: { organizationId: org.id, repositoryId: { in: trackedRepositoryIds }, isFixture: false },
        include: { repository: { select: { fullName: true, url: true } } },
        orderBy: { occurredAt: "desc" },
        take: 6,
      })
    : [];

  const totalActionsNeeded =
    pendingReports.length +
    pendingTasks.length +
    activeBlockers.length +
    pendingMilestones.length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="page-hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {mentorCohortIds.length} active assigned cohort{mentorCohortIds.length === 1 ? "" : "s"}
              </Badge>
              <span className="text-xs text-muted-foreground">{org.name}</span>
            </div>
            <h1 className="page-title">Mentor overview</h1>
            <p className="page-description">
              Review the people and work in your assigned cohorts, and follow up where your guidance is needed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link href={`/org/${params.orgSlug}/mentor/blockers`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Triage Blockers ({activeBlockers.length})</span>
              </Button>
            </Link>
            <Link href={`/org/${params.orgSlug}/mentor/reports`}>
              <Button size="sm" className="gap-1.5 text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" />
                <span>Review Reports ({pendingReports.length})</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href={`/org/${params.orgSlug}/mentor/mentees`}>
          <MetricCard
            title="Assigned Mentees"
            value={analytics.assignedMenteesCount}
            icon={<GraduationCap className="w-4 h-4 text-primary" />}
            accent="default"
            trend="Active Fellows"
            trendType="positive"
            description="Mentees across assigned cohorts"
          />
        </Link>

        <Link href={`/org/${params.orgSlug}/mentor/reports`}>
          <MetricCard
            title="Reports Awaiting Review"
            value={pendingReports.length}
            icon={<FileText className="w-4 h-4 text-amber-500" />}
            accent="flame"
            trend={pendingReports.length > 0 ? "Action Required" : "All Reviewed"}
            trendType={pendingReports.length > 0 ? "warning" : "positive"}
            description="Daily logs submitted for verification"
          />
        </Link>

        <Link href={`/org/${params.orgSlug}/mentor/blockers`}>
          <MetricCard
            title="Active Blockers"
            value={activeBlockers.length}
            icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}
            accent="rose"
            trend={activeBlockers.length > 0 ? "Needs Triage" : "No Blockers"}
            trendType={activeBlockers.length > 0 ? "warning" : "positive"}
            description="Technical impediments needing guidance"
          />
        </Link>

        <Link href={`/org/${params.orgSlug}/mentor/tasks`}>
          <MetricCard
            title="Task Submissions"
            value={pendingTasks.length}
            icon={<CheckSquare className="w-4 h-4 text-emerald-500" />}
            accent="emerald"
            trend={pendingTasks.length > 0 ? "Pending Eval" : "Up to Date"}
            trendType={pendingTasks.length > 0 ? "warning" : "positive"}
            description="Code deliverables awaiting feedback"
          />
        </Link>
      </div>

      {/* Action Center Banner if items require attention */}
      {totalActionsNeeded > 0 && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Action Center — Immediate Mentor Review Needed ({totalActionsNeeded})</span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <Link
                href={`/org/${params.orgSlug}/mentor/reports`}
                className="p-3 bg-card border border-border/80 rounded-xl hover:border-primary transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Daily Reports ({pendingReports.length})
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Submissions awaiting verification and feedback.
                  </p>
                </div>
                <span className="text-primary text-[11px] font-semibold flex items-center gap-1 mt-2.5">
                  Review queue <ArrowRight className="w-3 h-3" />
                </span>
              </Link>

              <Link
                href={`/org/${params.orgSlug}/mentor/blockers`}
                className="p-3 bg-card border border-border/80 rounded-xl hover:border-amber-500 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Unresolved Blockers ({activeBlockers.length})
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Mentees facing technical impediments.
                  </p>
                </div>
                <span className="text-amber-500 text-[11px] font-semibold flex items-center gap-1 mt-2.5">
                  Triage blockers <ArrowRight className="w-3 h-3" />
                </span>
              </Link>

              <Link
                href={`/org/${params.orgSlug}/mentor/tasks`}
                className="p-3 bg-card border border-border/80 rounded-xl hover:border-emerald-500 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Task Submissions ({pendingTasks.length})
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Code deliverables awaiting evaluation.
                  </p>
                </div>
                <span className="text-emerald-500 text-[11px] font-semibold flex items-center gap-1 mt-2.5">
                  Evaluate code <ArrowRight className="w-3 h-3" />
                </span>
              </Link>

              <Link
                href={`/org/${params.orgSlug}/mentor/reviews`}
                className="p-3 bg-card border border-border/80 rounded-xl hover:border-purple-500 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Milestones ({pendingMilestones.length})
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Evidence submitted for skill mastery.
                  </p>
                </div>
                <span className="text-purple-500 text-[11px] font-semibold flex items-center gap-1 mt-2.5">
                  Inspect evidence <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Pending Reports, Blockers, Missing Reports, and GitHub Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Reports Awaiting Review */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold">Reports Awaiting Review ({pendingReports.length})</CardTitle>
              <Link href={`/org/${params.orgSlug}/mentor/reports`}>
                <span className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {pendingReports.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  All daily reports have been reviewed!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingReports.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/30 transition-all flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{r.mentee.name}</span>
                          <span className="text-[11px] text-muted-foreground">({r.cohort?.name || "Cohort"})</span>
                          <Badge variant={r.status === "RESUBMITTED" ? "warning" : "secondary"} className="text-[9px]">
                            {r.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">{r.workDone}</p>
                      </div>
                      <Link href={`/org/${params.orgSlug}/mentor/reports`} className="shrink-0">
                        <Button variant="outline" size="sm" className="h-7 text-xs font-semibold">
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Blockers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold">Active Blocker Triage ({activeBlockers.length})</CardTitle>
              <Link href={`/org/${params.orgSlug}/mentor/blockers`}>
                <span className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                  Open triage <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {activeBlockers.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No unresolved blockers reported across your cohorts.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeBlockers.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/30 transition-all flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{b.title}</span>
                          <Badge
                            variant={b.urgency === "CRITICAL" ? "destructive" : b.urgency === "HIGH" ? "warning" : "secondary"}
                            className="text-[9px]"
                          >
                            {b.urgency}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">{b.status}</Badge>
                        </div>
                        <p className="text-muted-foreground line-clamp-1 mt-0.5">
                          {b.mentee.name} &bull; {b.description}
                        </p>
                      </div>
                      <Link href={`/org/${params.orgSlug}/mentor/blockers`} className="shrink-0">
                        <Button variant="outline" size="sm" className="h-7 text-xs font-semibold">
                          Resolve
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Missing Reports Today & Cohort GitHub Activity */}
        <div className="space-y-6">
          {/* Missing Reports Today */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Missing Reports Today ({missingReportMentees.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {missingReportMentees.length === 0 ? (
                <div className="text-center py-6 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  All active mentees have submitted reports today!
                </div>
              ) : (
                <div className="divide-y divide-border/40 text-xs">
                  {missingReportMentees.slice(0, 8).map((enr) => (
                    <div key={enr.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <Link
                          href={`/org/${params.orgSlug}/mentor/mentees/${enr.mentee.id}`}
                          className="font-bold text-foreground hover:underline"
                        >
                          {enr.mentee.name}
                        </Link>
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          {enr.cohort.name}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        Pending
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Silent / At-Risk Mentee Radar */}
          <Card className={atRiskMentees.length > 0 ? "border-amber-500/30" : ""}>
            <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                <AlertTriangle className={`w-4 h-4 ${atRiskMentees.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
                At-Risk / Silent Radar ({atRiskMentees.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {atRiskMentees.length === 0 ? (
                <div className="text-center py-5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  All supervised mentees are active!
                </div>
              ) : (
                <div className="divide-y divide-border/40 text-xs">
                  {atRiskMentees.slice(0, 6).map((m) => (
                    <div key={m.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/org/${params.orgSlug}/mentor/mentees/${m.id}`}
                          className="font-bold text-foreground hover:text-primary hover:underline block truncate"
                        >
                          {m.name}
                        </Link>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          {m.cohortName}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.reasons.map((reason) => (
                            <Badge key={reason} variant="warning" className="text-[9px] px-1.5 py-0">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Link href={`/org/${params.orgSlug}/mentor/mentees/${m.id}`} className="shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                          Inspect
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cohort GitHub Activity */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold">Cohort GitHub Telemetry</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ActivityTimeline items={recentActivities} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
