import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";

export default async function SelfTrackingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const organization = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    select: { id: true, slug: true },
  });
  if (!organization) redirect("/unauthorized");

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: session.id,
      },
    },
    select: { status: true, role: true, selfTrackingEnabled: true },
  });

  if (!membership || membership.status !== "ACTIVE" || !["ORG_ADMIN", "MENTOR"].includes(membership.role)) {
    redirect("/unauthorized");
  }

  if (!membership.selfTrackingEnabled) {
    redirect(`/org/${organization.slug}/${membership.role === "MENTOR" ? "mentor" : "admin"}`);
  }

  return <div className="relative z-10">{children}</div>;
}

