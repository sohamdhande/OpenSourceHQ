import React from "react";
import Link from "next/link";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMentorAnalytics } from "@/features/analytics/analytics-service";
import {
  Users,
  Clock,
  CheckCircle2,
  BarChart3,
  AlertTriangle,
  GitPullRequest,
  GitCommit,
  Layers,
  ArrowUpRight,
  Activity,
} from "lucide-react";

export default async function MentorAnalyticsPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const analytics = await getMentorAnalytics(session, org.id);
  const maxEvents = analytics.menteeLeaderboard[0]?.totalEvents || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">
            <Activity className="h-3.5 w-3.5" />
            MENTOR COHORT INTELLIGENCE · TELEMETRY &amp; VELOCITY
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            Cohort Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Performance, GitHub contribution velocity, and review metrics across your supervised cohorts.
          </p>
        </div>

        <Link href={`/org/${params.orgSlug}/mentor/reports`}>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-mono">
            <span>Review Pending Reports ({analytics.pendingReportReviews})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Top KPI Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">Mentees</span>
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {analytics.assignedMenteesCount}
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              Across {analytics.cohorts.length} cohorts
            </div>
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">Hours Logged</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {analytics.totalHoursLogged}h
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {analytics.totalReports} submitted reports
            </div>
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">Review Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {analytics.reviewRate}%
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {analytics.pendingReportReviews} awaiting review
            </div>
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">Task Velocity</span>
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {analytics.taskCompletionRate}%
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {analytics.completedTasksCount}/{analytics.totalTasksCount} completed
            </div>
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">Open Blockers</span>
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                analytics.openBlockersCount > 0 ? "text-amber-500" : "text-emerald-500"
              }`}
            />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {analytics.openBlockersCount}
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {analytics.openBlockersCount > 0 ? "Needs triage" : "All clear"}
            </div>
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10.5px] uppercase font-mono font-semibold tracking-wider">GitHub Sync</span>
            <GitPullRequest className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {analytics.totalGithubEvents}
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {analytics.githubBreakdown.commits} commits · {analytics.githubBreakdown.prsMerged} merged
            </div>
          </div>
        </Card>
      </div>

      {/* Cohort Breakdown Matrix */}
      <Card className="overflow-hidden border-border/80">
        <CardHeader className="p-4 border-b border-border/60 bg-muted/10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Supervised Cohort Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Cohort</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Mentees</th>
                  <th className="py-2.5 px-3 font-semibold">Reports</th>
                  <th className="py-2.5 px-3 font-semibold">Review Rate</th>
                  <th className="py-2.5 px-3 font-semibold">Hours</th>
                  <th className="py-2.5 px-3 font-semibold">Tasks</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Blockers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {analytics.cohorts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-sans font-semibold text-foreground">{c.name}</td>
                    <td className="py-3 px-3 text-center tabular-nums font-bold">{c.menteesCount}</td>
                    <td className="py-3 px-3 tabular-nums">{c.reportsCount}</td>
                    <td className="py-3 px-3">
                      <Badge variant={c.reviewRate >= 60 ? "success" : "warning"} className="text-[10px]">
                        {c.reviewRate}%
                      </Badge>
                    </td>
                    <td className="py-3 px-3 tabular-nums">{c.hoursLogged}h</td>
                    <td className="py-3 px-3 tabular-nums">
                      {c.tasksCompleted}/{c.tasksTotal}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={c.openBlockers > 0 ? "warning" : "success"} className="text-[10px]">
                        {c.openBlockers}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Breakdown & Mentee Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 sm:p-5 border-border/80">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-blue-500" />
            Cohort GitHub Breakdown
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified GitHub contributions by supervised mentees.
          </p>
          <div className="mt-4 space-y-2.5 font-mono text-xs">
            {[
              { label: "Commits", count: analytics.githubBreakdown.commits, color: "bg-blue-500" },
              { label: "PRs Opened", count: analytics.githubBreakdown.prsOpened, color: "bg-purple-500" },
              { label: "PRs Merged", count: analytics.githubBreakdown.prsMerged, color: "bg-emerald-500" },
              { label: "Code Reviews", count: analytics.githubBreakdown.reviews, color: "bg-amber-500" },
              { label: "Issues", count: analytics.githubBreakdown.issues, color: "bg-cyan-500" },
              { label: "Comments", count: analytics.githubBreakdown.comments, color: "bg-pink-500" },
            ].map((item) => (
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
                    className={`h-full ${item.color}`}
                    style={{
                      width: `${
                        analytics.totalGithubEvents > 0
                          ? (item.count / analytics.totalGithubEvents) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden border-border/80">
          <CardHeader className="p-4 border-b border-border/60 bg-muted/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Supervised Mentee GitHub Leaderboard
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click any mentee to inspect their 52-week heatmap and full dossier.
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {analytics.menteeLeaderboard.length} Active
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {analytics.menteeLeaderboard.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No verified GitHub activity recorded for your supervised mentees yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">#</th>
                      <th className="py-2.5 px-4 font-semibold">Mentee</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Commits</th>
                      <th className="py-2.5 px-3 font-semibold text-right">PRs</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Reviews</th>
                      <th className="py-2.5 px-4 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {analytics.menteeLeaderboard.map((m, idx) => (
                      <tr key={m.userId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground font-semibold">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/org/${params.orgSlug}/mentor/mentees/${m.userId}?tab=github`}
                            className="flex items-center gap-2.5 group"
                          >
                            <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
                              {m.avatarUrl ? (
                                <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                m.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <span className="font-sans font-semibold text-foreground group-hover:text-primary transition-colors">
                                {m.name}
                              </span>
                              <div className="text-[10px] text-muted-foreground">@{m.username}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">{m.commits}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{m.prs}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{m.reviews}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.round((m.totalEvents / maxEvents) * 100)}%` }}
                              />
                            </div>
                            <span className="font-bold text-foreground tabular-nums">{m.totalEvents}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
