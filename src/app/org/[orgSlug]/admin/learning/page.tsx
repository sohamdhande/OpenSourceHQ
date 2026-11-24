import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { LearningPathManager } from "@/components/learning/learning-path-manager";

export default async function AdminLearningPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const organization = await prisma.organization.findUnique({ where: { slug: params.orgSlug }, select: { id: true } });
  if (!organization) redirect("/unauthorized");
  const cohorts = await prisma.cohort.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <LearningPathManager organizationId={organization.id} cohorts={cohorts} canCreateOrganizationWide />;
}
