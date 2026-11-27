import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { SelfBlockersClient } from "./self-blockers-client";

export default async function SelfBlockersPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug } });
  if (!org) return null;

  const blockers = await prisma.blocker.findMany({
    where: {
      organizationId: org.id,
      menteeId: session.id,
      isSelfTracked: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <SelfBlockersClient
      organizationId={org.id}
      initialBlockers={blockers.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        urgency: b.urgency,
        status: b.status,
        response: b.response,
        createdAt: b.createdAt.toISOString(),
      }))}
    />
  );
}

