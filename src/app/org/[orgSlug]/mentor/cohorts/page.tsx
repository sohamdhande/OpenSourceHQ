import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MentorCohortsPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const cohorts = await prisma.cohort.findMany({
    where: {
      organizationId: org.id,
      mentors: { some: { mentorId: session.id } },
    },
    include: {
      enrollments: { where: { status: "ACTIVE" }, include: { mentee: { select: { id: true, name: true, email: true, imageUrl: true, status: true } } } },
      cohortRepositories: { include: { repository: true } },
      _count: { select: { dailyReports: true, tasks: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">My Supervised Cohorts</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cohorts assigned to your mentorship supervision.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cohorts.map((cohort) => (
          <Card key={cohort.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{cohort.name}</CardTitle>
                <Badge variant={cohort.status === "ACTIVE" ? "success" : "secondary"}>
                  {cohort.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{cohort.description}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center py-2 bg-muted/20 rounded">
                <div>
                  <span className="font-bold text-sm block">{cohort.enrollments.length}</span>
                  <span className="text-[10px] text-muted-foreground">Mentees</span>
                </div>
                <div>
                  <span className="font-bold text-sm block">{cohort._count.dailyReports}</span>
                  <span className="text-[10px] text-muted-foreground">Reports</span>
                </div>
                <div>
                  <span className="font-bold text-sm block">{cohort._count.tasks}</span>
                  <span className="text-[10px] text-muted-foreground">Tasks</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                  Tracked Repositories
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {cohort.cohortRepositories.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground italic">
                      No repositories explicitly scoped.
                    </span>
                  ) : (
                    cohort.cohortRepositories.map((cr) => (
                      <Badge key={cr.id} variant="secondary">
                        {cr.repository.fullName}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

