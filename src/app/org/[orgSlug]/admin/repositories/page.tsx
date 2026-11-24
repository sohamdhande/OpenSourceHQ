import React from "react";
import prisma from "@/lib/db";
import { AdminRepositoriesClient } from "./admin-repositories-client";

export default async function AdminRepositoriesPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    include: {
      repositories: {
        include: {
          cohortRepositories: { include: { cohort: true } },
          _count: { select: { activities: true, tasks: true } },
        },
        orderBy: { fullName: "asc" },
      },
      cohorts: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!org) return null;

  const repositories = org.repositories.map((r) => ({
    id: r.id,
    ownerLogin: r.ownerLogin,
    name: r.name,
    fullName: r.fullName,
    url: r.url,
    description: r.description,
    defaultBranch: r.defaultBranch,
    syncStatus: r.syncStatus,
    cohortRepositories: r.cohortRepositories.map((cr) => ({
      id: cr.id,
      cohort: { name: cr.cohort.name },
    })),
    _count: r._count,
  }));

  return (
    <AdminRepositoriesClient
      repositories={repositories}
      cohorts={org.cohorts}
      orgId={org.id}
      orgSlug={params.orgSlug}
    />
  );
}
