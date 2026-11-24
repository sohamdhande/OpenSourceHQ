import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { MentorTasksManager } from "./mentor-tasks-manager";

export default async function MentorTasksPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  // Cohorts in this organization
  const cohorts = await prisma.cohort.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Repositories tracked in this org
  const repositories = await prisma.repository.findMany({
    where: { organizationId: org.id },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  // Mentees in this organization
  const menteeMemberships = await prisma.organizationMembership.findMany({
    where: { organizationId: org.id, role: "MENTEE" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  const mentees = menteeMemberships.map((m) => m.user);

  // All tasks in org
  const tasksRaw = await prisma.task.findMany({
    where: { organizationId: org.id },
    include: {
      creator: { select: { id: true, name: true } },
      cohort: { select: { id: true, name: true } },
      repository: { select: { id: true, fullName: true } },
      assignments: {
        include: {
          mentee: { select: { id: true, name: true, email: true } },
          submissions: { orderBy: { submittedAt: "desc" } },
          reviews: { orderBy: { createdAt: "desc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const tasks = tasksRaw.map((t) => ({
    ...t,
    dueAt: t.dueAt?.toISOString() || null,
    assignments: t.assignments.map((a) => ({
      ...a,
      submissions: a.submissions.map((s) => ({
        ...s,
        submittedAt: s.submittedAt.toISOString(),
      })),
      reviews: a.reviews.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    })),
  }));

  return (
    <MentorTasksManager
      tasks={tasks}
      cohorts={cohorts}
      repositories={repositories}
      mentees={mentees}
      orgId={org.id}
      orgSlug={params.orgSlug}
    />
  );
}
