import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";

export default async function MentorMenteesPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug }, select: { id: true, name: true } });
  if (!org) return null;

  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: session.id } },
  });
  if (!session.isPlatformSuperAdmin && (membership?.status !== "ACTIVE" || !["ORG_ADMIN", "MENTOR"].includes(membership.role))) {
    redirect("/unauthorized");
  }

  const cohorts = await prisma.cohort.findMany({
    where: {
      organizationId: org.id,
      status: "ACTIVE",
      ...(membership?.role === "MENTOR" ? { mentors: { some: { mentorId: session.id } } } : {}),
    },
    include: {
      enrollments: {
        where: {
          status: "ACTIVE",
          mentee: { memberships: { some: { organizationId: org.id, status: "ACTIVE", role: "MENTEE" } } },
        },
        include: {
          mentee: {
            select: {
              id: true,
              name: true,
              email: true,
              githubAccounts: {
                where: { connectionStatus: "CONNECTED" },
                select: { username: true, profileUrl: true },
                take: 1,
              },
              _count: {
                select: {
                  dailyReports: { where: { organizationId: org.id } },
                  assignedTasks: { where: { task: { organizationId: org.id } } },
                },
              },
            },
          },
        },
        orderBy: { enrolledAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const totalMentees = cohorts.reduce((count, cohort) => count + cohort.enrollments.length, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="page-eyebrow">MENTORSHIP</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{membership?.role === "ORG_ADMIN" ? "Organization mentees" : "My assigned mentees"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{totalMentees} active mentees across {cohorts.length} {cohorts.length === 1 ? "cohort" : "cohorts"} in {org.name}.</p>
      </header>

      {cohorts.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">No active mentees are currently assigned to your cohorts.</CardContent></Card>
      ) : (
        <div className="space-y-5">
          {cohorts.map((cohort) => (
            <Card key={cohort.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <div><CardTitle className="text-base">{cohort.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Active cohort roster</p></div>
                <Badge variant="secondary">{cohort.enrollments.length} mentees</Badge>
              </CardHeader>
              <CardContent>
                {cohort.enrollments.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">No active mentees in this cohort.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="border-b border-border text-xs text-muted-foreground"><tr>
                        <th scope="col" className="py-3 font-medium">Mentee</th><th scope="col" className="py-3 font-medium">GitHub</th><th scope="col" className="py-3 font-medium">Reports</th><th scope="col" className="py-3 font-medium">Tasks</th><th scope="col" className="py-3 text-right font-medium">Action</th>
                      </tr></thead>
                      <tbody className="divide-y divide-border/60">
                        {cohort.enrollments.map((enrollment) => {
                          const github = enrollment.mentee.githubAccounts[0];
                          return <tr key={enrollment.id} className="transition-colors hover:bg-muted/30">
                            <td className="py-3"><div className="font-medium">{enrollment.mentee.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{enrollment.mentee.email}</div></td>
                            <td className="py-3">{github ? <a href={github.profileUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">@{github.username}</a> : <span className="text-xs text-muted-foreground">Not connected</span>}</td>
                            <td className="py-3 tabular-nums">{enrollment.mentee._count.dailyReports}</td><td className="py-3 tabular-nums">{enrollment.mentee._count.assignedTasks}</td>
                            <td className="py-3 text-right"><Link href={`/org/${params.orgSlug}/mentor/mentees/${enrollment.mentee.id}`} className="text-sm font-medium text-primary hover:underline">Open profile</Link></td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
