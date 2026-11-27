import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { isGitHubConfigured } from "@/features/github/github-service";
import { SelfProfileClient } from "./self-profile-client";

export default async function SelfProfilePage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug } });
  if (!org) return null;

  const [membership, ghAccount] = await Promise.all([
    prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: session.id } },
      select: { role: true, selfTrackingEnabled: true, selfTrackingEnabledAt: true },
    }),
    prisma.gitHubAccount.findFirst({
      where: { userId: session.id },
      orderBy: { connectedAt: "desc" },
    }),
  ]);

  return (
    <SelfProfileClient
      orgId={org.id}
      orgSlug={org.slug}
      orgName={org.name}
      role={membership?.role || "MENTOR"}
      userName={session.name}
      userEmail={session.email}
      timezone={session.timezone}
      selfTrackingEnabledAt={membership?.selfTrackingEnabledAt?.toISOString() || null}
      githubConfigured={isGitHubConfigured()}
      githubAccount={
        ghAccount?.connectionStatus === "CONNECTED"
          ? { username: ghAccount.username, profileUrl: ghAccount.profileUrl }
          : null
      }
    />
  );
}

