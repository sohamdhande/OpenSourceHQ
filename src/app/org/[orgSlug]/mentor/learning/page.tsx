import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { LearningPathManager } from "@/components/learning/learning-path-manager";

export default async function MentorLearningPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const organization = await prisma.organization.findUnique({ where: { slug: params.orgSlug }, select: { id: true } });
  if (!organization) redirect("/unauthorized");
  const memberships = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: organization.id, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && (memberships?.status !== "ACTIVE" || !["ORG_ADMIN", "MENTOR"].includes(memberships.role))) redirect("/unauthorized");
  const assignments = await prisma.cohortMentor.findMany({ where: { mentorId: session.id, cohort: { organizationId: organization.id, status: "ACTIVE" } }, include: { cohort: { select: { id: true, name: true } } }, orderBy: { cohort: { name: "asc" } } });
  const cohorts = assignments.map((item) => item.cohort);
  return <LearningPathManager organizationId={organization.id} cohorts={cohorts} canCreateOrganizationWide={false} heading="My cohort learning paths" />;
}
