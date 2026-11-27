import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { SelfTasksClient } from "./self-tasks-client";

export default async function SelfTasksPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug } });
  if (!org) return null;

  const [tasks, repositories] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId: org.id,
        createdById: session.id,
        isSelfTracked: true,
        archivedAt: null,
      },
      include: {
        repository: { select: { id: true, fullName: true } },
        assignments: { where: { menteeId: session.id } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userRepository.findMany({
      where: { organizationId: org.id, userId: session.id },
      include: { repository: { select: { id: true, fullName: true } } },
    }),
  ]);

  return (
    <SelfTasksClient
      organizationId={org.id}
      repositories={repositories.map((r) => r.repository)}
      initialTasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueAt: t.dueAt?.toISOString() || null,
        repository: t.repository,
        status: (t.assignments[0]?.status || "TODO") as "TODO" | "IN_PROGRESS" | "COMPLETED",
      }))}
    />
  );
}

