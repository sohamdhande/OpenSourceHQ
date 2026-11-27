import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { computeReportingStreak, getDateKeyInTimeZone } from "@/lib/timezone";
import { SelfDailyLogClient } from "./self-daily-log-client";

export default async function SelfDailyLogPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug } });
  if (!org) return null;

  const todayKey = getDateKeyInTimeZone(new Date(), org.timezone || "UTC");
  const today = new Date(`${todayKey}T00:00:00.000Z`);

  const [existing, pastReports] = await Promise.all([
    prisma.dailyReport.findFirst({
      where: {
        organizationId: org.id,
        menteeId: session.id,
        cohortId: null,
        isSelfTracked: true,
        reportDate: today,
      },
      include: { links: true },
    }),
    prisma.dailyReport.findMany({
      where: {
        organizationId: org.id,
        menteeId: session.id,
        cohortId: null,
        isSelfTracked: true,
        status: { not: "DRAFT" },
      },
      select: { reportDate: true },
      orderBy: { reportDate: "desc" },
    }),
  ]);

  const loggedDateKeys = pastReports.map((r) => r.reportDate.toISOString().split("T")[0]);
  const streak = computeReportingStreak(
    pastReports.map((r) => r.reportDate),
    today
  );

  return (
    <SelfDailyLogClient
      organizationId={org.id}
      orgSlug={params.orgSlug}
      defaultDate={todayKey}
      initialStreak={streak}
      initialLoggedDates={loggedDateKeys}
      initialReport={
        existing
          ? {
              id: existing.id,
              reportDate: existing.reportDate.toISOString().split("T")[0],
              workDone: existing.workDone,
              learning: existing.learning,
              blockers: existing.blockers || "",
              nextSteps: existing.nextSteps,
              hoursSpent: existing.hoursSpent,
              status: existing.status,
              links: existing.links.map((l) => ({ url: l.url, label: l.label, type: l.type })),
            }
          : null
      }
    />
  );
}
