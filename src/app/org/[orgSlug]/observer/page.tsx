import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeInTimeZone } from "@/lib/timezone";
import { CalendarDays, ClipboardList, GraduationCap, Layers3, Megaphone, Users } from "lucide-react";

export default async function ObserverOverviewPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.isPlatformSuperAdmin) redirect(`/org/${params.orgSlug}/admin`);
  const organization = await prisma.organization.findUnique({ where: { slug: params.orgSlug }, select: { id: true, name: true, timezone: true } });
  if (!organization) redirect("/unauthorized");
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: organization.id, userId: session.id } } });
  if (membership?.status !== "ACTIVE" || membership.role !== "OBSERVER") redirect("/unauthorized");

  const now = new Date();
  const [cohortCount, menteeCount, mentorCount, sharedReportCount, upcomingEvents, announcements] = await Promise.all([
    prisma.cohort.count({ where: { organizationId: organization.id, status: "ACTIVE" } }),
    prisma.organizationMembership.count({ where: { organizationId: organization.id, role: "MENTEE", status: "ACTIVE" } }),
    prisma.organizationMembership.count({ where: { organizationId: organization.id, role: "MENTOR", status: "ACTIVE" } }),
    prisma.dailyReport.count({ where: { organizationId: organization.id, visibility: "COHORT", status: { not: "DRAFT" } } }),
    prisma.event.findMany({ where: { organizationId: organization.id, startsAt: { gte: now }, cohortId: null }, orderBy: { startsAt: "asc" }, take: 5, select: { id: true, title: true, startsAt: true, endsAt: true, timezone: true, location: true, meetingUrl: true } }),
    prisma.announcement.findMany({ where: { organizationId: organization.id, cohortId: null, archivedAt: null }, orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }], take: 5, select: { id: true, title: true, body: true, publishedAt: true, isPinned: true, author: { select: { name: true } } } }),
  ]);

  const metrics = [
    { label: "Active cohorts", value: cohortCount, icon: Layers3 },
    { label: "Active mentees", value: menteeCount, icon: GraduationCap },
    { label: "Active mentors", value: mentorCount, icon: Users },
    { label: "Cohort-shared reports", value: sharedReportCount, icon: ClipboardList },
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="page-eyebrow">PROGRAM OBSERVATION</p>
        <h1 className="text-3xl font-semibold tracking-tight">{organization.name} overview</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">A read-only view of program activity, public announcements and organization-wide events. Individual task submissions, private reports and mentor-only notes remain restricted.</p>
        <Badge variant="outline">Read-only access</Badge>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return <Card key={metric.label} className="metric-surface"><CardContent className="flex items-center gap-3 p-4"><div className="metric-icon"><Icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-0.5 text-2xl font-semibold tabular-nums">{metric.value}</p></div></CardContent></Card>;
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Upcoming organization events</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.length ? upcomingEvents.map((event) => <div key={event.id} className="flex items-start justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-medium">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTimeInTimeZone(event.startsAt, event.timezone || organization.timezone || "UTC")} – {formatDateTimeInTimeZone(event.endsAt, event.timezone || organization.timezone || "UTC")}</p><p className="mt-1 text-xs text-muted-foreground">{event.location || "Online / location not specified"}</p></div>{event.meetingUrl ? <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Join</a> : null}</div>) : <p className="text-sm text-muted-foreground">No upcoming organization-wide events.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" /> Organization announcements</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {announcements.length ? announcements.map((item) => <div key={item.id} className="border-b border-border/70 pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-2"><p className="text-sm font-medium">{item.title}</p>{item.isPinned ? <Badge variant="secondary">Pinned</Badge> : null}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.author.name} · {formatDateTimeInTimeZone(item.publishedAt, organization.timezone || "UTC")}</p></div>) : <p className="text-sm text-muted-foreground">No organization-wide announcements have been published.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
