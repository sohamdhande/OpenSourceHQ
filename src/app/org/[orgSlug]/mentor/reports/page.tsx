import React from "react";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { AdminReportsClient } from "@/components/reports/admin-reports-client";

export default async function MentorReportsPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    include: {
      cohorts: {
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!org) {
    notFound();
  }

  const reports = await prisma.dailyReport.findMany({
    where: { organizationId: org.id, isSelfTracked: false },
    include: {
      mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
      cohort: { select: { id: true, name: true, slug: true } },
      links: true,
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <AdminReportsClient
      initialReports={reports}
      cohorts={org.cohorts}
      orgSlug={params.orgSlug}
    />
  );
}
