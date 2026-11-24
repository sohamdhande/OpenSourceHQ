import React from "react";
import prisma from "@/lib/db";
import { AdminCohortsClient } from "./admin-cohorts-client";

export default async function AdminCohortsPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    include: {
      cohorts: {
        include: {
          mentors: {
            include: {
              mentor: { select: { id: true, name: true, email: true } },
            },
          },
          enrollments: {
            include: {
              mentee: { select: { id: true, name: true, email: true } },
            },
          },
          cohortRepositories: { include: { repository: true } },
          _count: {
            select: { dailyReports: true, tasks: true },
          },
        },
        orderBy: { startDate: "desc" },
      },
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!org) return null;

  const cohorts = org.cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    status: c.status,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    timezone: c.timezone,
    mentors: c.mentors.map((m) => ({
      id: m.id,
      mentorId: m.mentor.id,
      mentor: { id: m.mentor.id, name: m.mentor.name, email: m.mentor.email },
    })),
    enrollments: c.enrollments.map((e) => ({
      id: e.id,
      menteeId: e.mentee.id,
      mentee: { id: e.mentee.id, name: e.mentee.name, email: e.mentee.email },
    })),
    cohortRepositories: c.cohortRepositories.map((cr) => ({
      id: cr.id,
      repository: { fullName: cr.repository.fullName },
    })),
    _count: c._count,
  }));

  // Available mentors in organization (Members with role MENTOR or ORG_ADMIN)
  const availableMentors = org.memberships
    .filter((m) => m.role === "MENTOR" || m.role === "ORG_ADMIN")
    .map((m) => m.user);

  // Available mentees in organization (Members with role MENTEE)
  const availableMentees = org.memberships
    .filter((m) => m.role === "MENTEE")
    .map((m) => m.user);

  return (
    <AdminCohortsClient
      cohorts={cohorts}
      availableMentors={availableMentors}
      availableMentees={availableMentees}
      orgId={org.id}
      orgSlug={params.orgSlug}
    />
  );
}
