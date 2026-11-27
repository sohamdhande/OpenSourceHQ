import React from "react";
import prisma from "@/lib/db";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Layers, CheckSquare, FileText, GitPullRequest, ArrowRight, ShieldCheck } from "lucide-react";
import { getOrganizationAnalytics } from "@/features/analytics/analytics-service";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const { metrics, cohortComparison } = await getOrganizationAnalytics(org.id);

  // Recent GitHub Activity (scoped to active mentees in this organization)
  const recentActivitiesRaw = await prisma.gitHubActivity.findMany({
    where: {
      organizationId: org.id,
      isFixture: false,
      githubAccount: {
        user: {
          memberships: {
            some: { organizationId: org.id, role: "MENTEE", status: "ACTIVE" },
          },
        },
      },
    },
    include: {
      repository: { select: { fullName: true } },
      githubAccount: {
        select: {
          username: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { occurredAt: "desc" },
    take: 6,
  });

  const recentActivities = recentActivitiesRaw.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    url: a.url,
    activityType: a.activityType,
    isFixture: a.isFixture,
    occurredAt: a.occurredAt,
    actorName: a.githubAccount?.user?.name || null,
    actorUsername: a.githubAccount?.username || null,
    actorHref: a.githubAccount?.user ? `/org/${params.orgSlug}/mentor/mentees/${a.githubAccount.user.id}` : null,
    repositoryName: a.repository?.fullName || null,
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-purple-500/5 p-6 sm:p-8 shadow-card">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="purple" dot className="font-mono text-[10px]">
                Platform Health: Operational
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">&bull; {org.name}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Organization Command Center
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Program health, cohort execution, mentor velocity, and verified open-source contributions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/org/${params.orgSlug}/admin/cohorts`}>
              <Button size="sm" variant="glow" className="gap-1.5 text-xs font-semibold shadow-glow/30">
                <Layers className="w-3.5 h-3.5" />
                <span>Manage Cohorts</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href={`/org/${params.orgSlug}/admin/cohorts`}>
          <MetricCard
            title="Active Cohorts"
            value={metrics.totalCohorts}
            icon={<Layers className="w-4 h-4 text-primary" />}
            accent="default"
            trend="Active Programs"
            trendType="positive"
            description="Ongoing mentorship programs"
          />
        </Link>
        <Link href={`/org/${params.orgSlug}/admin/mentors`}>
          <MetricCard
            title="Mentors"
            value={metrics.totalMentors}
            icon={<Users className="w-4 h-4 text-emerald-500" />}
            accent="emerald"
            trend="Active Supervisors"
            trendType="positive"
            description="Assigned mentors"
          />
        </Link>
        <Link href={`/org/${params.orgSlug}/admin/mentees`}>
          <MetricCard
            title="Mentees Enrolled"
            value={metrics.totalMentees}
            icon={<GraduationCap className="w-4 h-4 text-cyan-500" />}
            accent="cyan"
            trend="Active Fellows"
            trendType="positive"
            description="Enrolled student engineers"
          />
        </Link>
        <Link href={`/org/${params.orgSlug}/admin/reports`}>
          <MetricCard
            title="Review Velocity"
            value={`${metrics.reportReviewRate}%`}
            icon={<FileText className="w-4 h-4 text-amber-500" />}
            accent="flame"
            trend="Review Rate"
            trendType={metrics.reportReviewRate >= 70 ? "positive" : "warning"}
            progress={metrics.reportReviewRate}
            description={`${metrics.reportsCount} total daily reports logged`}
          />
        </Link>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          title="Task Completion Rate"
          value={`${metrics.taskCompletionRate}%`}
          icon={<CheckSquare className="w-4 h-4 text-purple-500" />}
          accent="purple"
          progress={metrics.taskCompletionRate}
          description={`${metrics.tasksCount} mentorship tasks created across all cohorts`}
        />
        <MetricCard
          title="GitHub Events Ingested"
          value={metrics.activityCount}
          icon={<GitPullRequest className="w-4 h-4 text-cyan-500" />}
          accent="cyan"
          description="Synced commits, PRs, issues and reviews from connected repositories"
        />
      </div>

      {/* Cohort Comparison & Recent Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold">Cohort Telemetry Comparison</CardTitle>
            <Link href={`/org/${params.orgSlug}/admin/cohorts`}>
              <span className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                View cohorts <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-border/60 text-muted-foreground uppercase text-[10px] font-mono">
                  <tr>
                    <th className="py-2.5 font-semibold">Cohort</th>
                    <th className="py-2.5 font-semibold">Mentees</th>
                    <th className="py-2.5 font-semibold">Mentors</th>
                    <th className="py-2.5 font-semibold">Reports</th>
                    <th className="py-2.5 font-semibold">Tasks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-xs">
                  {cohortComparison.map((c) => (
                    <tr key={c.name} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 font-semibold font-sans text-foreground">{c.name}</td>
                      <td className="py-3">{c.mentees}</td>
                      <td className="py-3">{c.mentors}</td>
                      <td className="py-3">{c.reports}</td>
                      <td className="py-3">{c.tasks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold">Verified Activity Stream</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ActivityTimeline items={recentActivities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
