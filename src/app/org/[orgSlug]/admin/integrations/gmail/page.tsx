import React from "react";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { getGmailIntegrationStatus } from "@/features/integrations/gmail-service";
import { GmailIntegrationClient } from "./gmail-integration-client";

export default async function AdminGmailIntegrationPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string };
  searchParams?: { status?: string; message?: string };
}) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!org) notFound();

  const status = await getGmailIntegrationStatus(org.id);

  return (
    <GmailIntegrationClient
      orgId={org.id}
      orgName={org.name}
      orgSlug={org.slug}
      status={status}
      queryStatus={searchParams?.status}
      queryMessage={searchParams?.message}
    />
  );
}

