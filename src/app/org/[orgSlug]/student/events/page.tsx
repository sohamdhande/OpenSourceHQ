import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { StudentEventsClient } from "./student-events-client";

export default async function StudentEventsPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const organization = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    select: { id: true, name: true, timezone: true },
  });
  if (!organization) redirect("/unauthorized");

  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: organization.id, userId: session.id } },
    select: { role: true, status: true },
  });
  if (membership?.status !== "ACTIVE" || membership.role !== "MENTEE") redirect("/unauthorized");

  return <StudentEventsClient organizationId={organization.id} organizationName={organization.name} />;
}
