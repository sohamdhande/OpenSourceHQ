import React from "react";
import prisma from "@/lib/db";
import { AdminAnnouncementsClient } from "./admin-announcements-client";

export default async function AdminAnnouncementsPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    include: {
      announcements: {
        include: {
          cohort: true,
          author: { select: { id: true, name: true } },
        },
        orderBy: [
          { isPinned: "desc" },
          { publishedAt: "desc" },
        ],
      },
      cohorts: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!org) return null;

  const announcements = org.announcements.map((ann) => ({
    id: ann.id,
    title: ann.title,
    body: ann.body,
    isPinned: ann.isPinned,
    publishedAt: ann.publishedAt.toISOString(),
    cohort: ann.cohort ? { id: ann.cohort.id, name: ann.cohort.name } : null,
    author: ann.author,
  }));

  return (
    <AdminAnnouncementsClient
      announcements={announcements}
      cohorts={org.cohorts}
      orgId={org.id}
      orgSlug={params.orgSlug}
    />
  );
}
