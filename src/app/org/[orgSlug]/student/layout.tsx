import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";

export default async function StudentAreaLayout({ children, params }: { children: React.ReactNode; params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.isPlatformSuperAdmin) redirect(`/org/${params.orgSlug}/admin`);
  const organization = await prisma.organization.findUnique({ where: { slug: params.orgSlug }, select: { id: true } });
  if (!organization) redirect("/unauthorized");
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: organization.id, userId: session.id } } });
  if (membership?.status !== "ACTIVE" || membership.role !== "MENTEE") redirect("/unauthorized");
  return <>{children}</>;
}
