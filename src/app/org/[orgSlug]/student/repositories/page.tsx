import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { MemberRepositoriesClient } from "@/components/repositories/member-repositories-client";

export default async function StudentRepositoriesPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const organization = await prisma.organization.findUnique({ where: { slug: params.orgSlug } });
  if (!organization) return <div className="page-empty">Organization not found.</div>;
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: organization.id, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && (!membership || membership.status !== "ACTIVE" || membership.role !== "MENTEE")) redirect("/unauthorized");

  const selected = await prisma.userRepository.findMany({
    where: { organizationId: organization.id, userId: session.id },
    include: { repository: true, assignedBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }],
  });
  return <MemberRepositoriesClient organizationId={organization.id} orgSlug={organization.slug} role="MENTEE" initialSelected={selected.map((item) => ({ ...item, assignedAt: item.assignedAt.toISOString(), repository: { ...item.repository, lastSyncedAt: item.repository.lastSyncedAt?.toISOString() || null } }))} />;
}
