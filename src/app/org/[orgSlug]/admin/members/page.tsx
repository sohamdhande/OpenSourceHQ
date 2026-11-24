import React from "react";
import prisma from "@/lib/db";
import { AdminMembersClient } from "./admin-members-client";

export default async function AdminMembersPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true, name: true, email: true, status: true,
              githubAccounts: { select: { username: true, profileUrl: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      invitations: {
        where: { acceptedAt: null },
        include: {
          invitedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      cohorts: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!org) return null;

  const members = org.memberships.map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    joinedAt: m.joinedAt?.toISOString() || null,
    createdAt: m.createdAt.toISOString(),
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      status: m.user.status,
      githubAccounts: m.user.githubAccounts.map((g) => ({
        username: g.username,
        profileUrl: g.profileUrl,
      })),
    },
  }));

  const invitations = org.invitations.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    cohortId: i.cohortId,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
    inviter: i.invitedBy,
    cohort: org.cohorts.find((c) => c.id === i.cohortId) ? { name: org.cohorts.find((c) => c.id === i.cohortId)!.name } : null,
  }));

  return (
    <AdminMembersClient
      members={members}
      invitations={invitations}
      cohorts={org.cohorts}
      orgId={org.id}
      orgSlug={params.orgSlug}
    />
  );
}
