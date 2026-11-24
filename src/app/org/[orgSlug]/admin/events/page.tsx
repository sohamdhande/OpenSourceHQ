import React from "react";
import prisma from "@/lib/db";
import { AdminEventsClient } from "./admin-events-client";

export default async function AdminEventsPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    include: {
      events: {
        include: {
          cohort: true,
          createdBy: { select: { id: true, name: true } },
          attendances: { include: { user: { select: { id: true, name: true, email: true } } } },
          rsvps: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { startsAt: "desc" },
      },
      cohorts: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!org) return null;

  // Mentees in this organization
  const menteeMemberships = await prisma.organizationMembership.findMany({
    where: { organizationId: org.id, role: "MENTEE", status: "ACTIVE" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          cohortEnrollments: {
            where: { status: "ACTIVE", cohort: { organizationId: org.id, status: "ACTIVE" } },
            select: { cohortId: true },
          },
        },
      },
    },
  });
  const mentees = menteeMemberships.map((membership) => ({
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    cohortIds: membership.user.cohortEnrollments.map((enrollment) => enrollment.cohortId),
  }));

  const events = org.events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    startsAt: ev.startsAt.toISOString(),
    endsAt: ev.endsAt.toISOString(),
    timezone: ev.timezone,
    meetingUrl: ev.meetingUrl,
    location: ev.location,
    cohort: ev.cohort ? { id: ev.cohort.id, name: ev.cohort.name } : null,
    createdBy: ev.createdBy,
    attendances: ev.attendances.map((a) => ({
      id: a.id,
      status: a.status,
      note: a.note,
      user: a.user,
    })),
    rsvps: ev.rsvps.map((r) => ({
      id: r.id,
      status: r.status,
      user: r.user,
    })),
  }));

  return (
    <AdminEventsClient
      events={events}
      cohorts={org.cohorts}
      mentees={mentees}
      orgId={org.id}
      organizationTimezone={org.timezone || "UTC"}
    />
  );
}
