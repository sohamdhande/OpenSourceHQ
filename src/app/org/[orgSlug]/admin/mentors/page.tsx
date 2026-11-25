import React from "react";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminMentorsPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug }, select: { id: true } });
  if (!org) return null;
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      organizationId: org.id,
      status: "ACTIVE",
      OR: [
        { role: "MENTOR" },
        { role: "ORG_ADMIN", user: { cohortMentors: { some: { cohort: { organizationId: org.id } } } } },
      ],
    },
    include: { user: { select: { id: true, name: true, email: true, cohortMentors: { where: { cohort: { organizationId: org.id } }, include: { cohort: { select: { id: true, name: true } } } } } } },
    orderBy: { createdAt: "desc" },
  });
  return <div className="space-y-6"><header><h1 className="text-xl font-semibold tracking-tight">Mentors directory</h1><p className="mt-1 text-sm text-muted-foreground">Active mentors and cohort-supervising admins.</p></header>
    {memberships.length === 0 ? <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">No active mentors are assigned to this organization.</CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{memberships.map((membership) => <Card key={membership.id}><CardHeader className="pb-2"><div className="flex items-center justify-between gap-3"><CardTitle className="text-base">{membership.user.name}</CardTitle><Badge variant="success">{membership.role === "ORG_ADMIN" ? "Admin · Mentor" : "Mentor"}</Badge></div><p className="text-sm text-muted-foreground">{membership.user.email}</p></CardHeader><CardContent><p className="mb-2 text-xs font-medium text-muted-foreground">Assigned cohorts</p><div className="flex flex-wrap gap-2">{membership.user.cohortMentors.map((assignment) => <Badge key={assignment.id} variant="secondary">{assignment.cohort.name}</Badge>)}</div></CardContent></Card>)}</div>}
  </div>;
}
