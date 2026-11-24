import React from "react";
import prisma from "@/lib/db";
import { getOrganizationAnalytics } from "@/features/analytics/analytics-service";
import { AdminAnalyticsClient } from "@/components/analytics/admin-analytics-client";

export default async function AdminAnalyticsPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!org) return null;

  const { metrics, cohortComparison, activeBlockers } = await getOrganizationAnalytics(org.id);

  return (
    <AdminAnalyticsClient
      orgSlug={org.slug}
      orgName={org.name}
      metrics={metrics}
      cohortComparison={cohortComparison}
      activeBlockers={activeBlockers}
    />
  );
}
