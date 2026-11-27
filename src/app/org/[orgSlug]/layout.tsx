import { notFound, redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Never redirect an invalid tenant slug to another customer's workspace.
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) notFound();

  // Verify membership
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: session.id,
      },
    },
  });

  if ((!membership || membership.status !== "ACTIVE") && !session.isPlatformSuperAdmin) {
    redirect("/unauthorized");
  }

  const enrichedSession = {
    ...session,
    activeOrgId: org.id,
    activeOrgSlug: org.slug,
    activeOrgName: org.name,
    activeOrgRole: membership?.role ?? (session.isPlatformSuperAdmin ? "ORG_ADMIN" : undefined),
    selfTrackingEnabled: membership?.status === "ACTIVE" ? membership.selfTrackingEnabled : false,
  };

  return (
    <AppShell user={enrichedSession} orgSlug={params.orgSlug}>
      {children}
    </AppShell>
  );
}

