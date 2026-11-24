import prisma from "@/lib/db";
import { AdminSettingsClient } from "./admin-settings-client";

export default async function AdminSettingsPage({ params }: { params: { orgSlug: string } }) {
  const organization = await prisma.organization.findUnique({ where: { slug: params.orgSlug } });
  if (!organization) return null;

  return (
    <AdminSettingsClient
      organizationId={organization.id}
      name={organization.name}
      slug={organization.slug}
      description={organization.description}
      initialTimezone={organization.timezone || "UTC"}
    />
  );
}
