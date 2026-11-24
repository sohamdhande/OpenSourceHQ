import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { canViewMentee } from "@/server/authorization/policies";
import { redirect } from "next/navigation";
import { MenteeProfileClient } from "./mentee-profile-client";
import { computeGitHubStats } from "@/features/github/github-stats";

export default async function MenteeProfileDetailPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string; menteeId: string };
  searchParams: { tab?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  // This page renders a full mentor/admin dossier, not the limited peer profile.
  // Only active organization administrators and mentors assigned to a shared cohort may open it.
  const viewerMembership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: session.id } },
  });
  const allowed = session.isPlatformSuperAdmin || (
    viewerMembership?.status === "ACTIVE" &&
    (viewerMembership.role === "ORG_ADMIN" || viewerMembership.role === "MENTOR") &&
    await canViewMentee(session, params.menteeId, org.id)
  );
  if (!allowed) {
    return (
      <div className="p-6 text-center text-xs text-destructive">
        Unauthorized to view this mentee profile.
      </div>
    );
  }

  // Mentor dossiers must not reveal records from cohorts they do not supervise.
  // Administrators retain organization-wide visibility.
  const mentorScoped = viewerMembership?.role === "MENTOR" && !session.isPlatformSuperAdmin;
  const mentorCohortIds = mentorScoped
    ? (await prisma.cohort.findMany({
        where: {
          organizationId: org.id,
          status: "ACTIVE",
          mentors: { some: { mentorId: session.id } },
          enrollments: { some: { menteeId: params.menteeId, status: "ACTIVE" } },
        },
        select: { id: true },
      })).map((cohort) => cohort.id)
    : [];
  const visibleCohortWhere = mentorScoped
    ? { OR: [{ cohortId: null }, { cohortId: { in: mentorCohortIds } }] }
    : {};

  const mentee = await prisma.user.findUnique({
    where: { id: params.menteeId },
    select: {
      // Explicit allow-list: never serialize passwordHash or other authentication fields to the client.
      id: true,
      name: true,
      email: true,
      imageUrl: true,
      timezone: true,
      status: true,
      createdAt: true,
      githubAccounts: {
        where: { connectionStatus: "CONNECTED" },
        select: { id: true, username: true, profileUrl: true, avatarUrl: true, connectedAt: true, lastSyncedAt: true, connectionStatus: true },
      },
      cohortEnrollments: {
        where: mentorScoped ? { cohortId: { in: mentorCohortIds }, status: "ACTIVE", cohort: { organizationId: org.id, status: "ACTIVE" } } : { cohort: { organizationId: org.id } },
        include: { cohort: true },
      },
      dailyReports: {
        where: { organizationId: org.id, ...(mentorScoped ? { cohortId: { in: mentorCohortIds } } : {}) },
        include: {
          links: true,
          reviews: { include: { reviewer: { select: { id: true, name: true, imageUrl: true } } } },
        },
        orderBy: { reportDate: "desc" },
      },
      assignedTasks: {
        where: { task: { organizationId: org.id, ...visibleCohortWhere } },
        include: {
          task: true,
          submissions: { orderBy: { submittedAt: "desc" } },
          reviews: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { assignedAt: "desc" },
      },
      menteeMilestones: {
        where: { milestone: { learningPath: { organizationId: org.id, ...visibleCohortWhere } } },
        include: {
          milestone: { include: { skill: true } },
          reviewedBy: { select: { id: true, name: true, imageUrl: true } },
        },
      },
      feedbackReceived: {
        where: { organizationId: org.id },
        include: { author: { select: { id: true, name: true, imageUrl: true } } },
        orderBy: { createdAt: "desc" },
      },
      attendances: {
        where: { event: { organizationId: org.id, ...visibleCohortWhere } },
        include: { event: true },
        orderBy: { recordedAt: "desc" },
      },
    },
  });

  if (!mentee) return null;

  // GitHub activities
  const ghAccount = mentee.githubAccounts[0];
  const selectedRepositoryIds = mentorScoped
    ? (await prisma.userRepository.findMany({ where: { organizationId: org.id, userId: mentee.id }, select: { repositoryId: true } })).map((record) => record.repositoryId)
    : undefined;
  const githubActivities = ghAccount
    ? await prisma.gitHubActivity.findMany({
        where: { githubAccountId: ghAccount.id, organizationId: org.id, ...(selectedRepositoryIds ? { repositoryId: { in: selectedRepositoryIds } } : {}) },
        orderBy: { occurredAt: "desc" },
        take: 50,
      })
    : [];

  // Fetch all GitHub activities (lightweight projection) for computing stats
  const allGithubActivities = ghAccount
    ? await prisma.gitHubActivity.findMany({
        where: { githubAccountId: ghAccount.id, organizationId: org.id, ...(selectedRepositoryIds ? { repositoryId: { in: selectedRepositoryIds } } : {}) },
        select: {
          activityType: true,
          occurredAt: true,
          repository: { select: { name: true, fullName: true } },
        },
        orderBy: { occurredAt: "desc" },
      })
    : [];

  // Compute GitHub stats from all activities
  const githubStats = computeGitHubStats(allGithubActivities);

  // Repositories specifically chosen by or assigned to this mentee
  const menteeRepositories = await prisma.userRepository.findMany({
    where: {
      organizationId: org.id,
      userId: mentee.id,
    },
    include: {
      repository: true,
      assignedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }],
  });

  // Blockers raised by this mentee
  const blockers = await prisma.blocker.findMany({
    where: {
      organizationId: org.id,
      menteeId: mentee.id,
      ...(mentorScoped ? { OR: [{ mentorId: session.id }, { cohortId: { in: mentorCohortIds } }] } : {}),
    },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Community discussion posts and comments authored by mentee
  const discussionPosts = await prisma.discussionPost.findMany({
    where: { organizationId: org.id, authorId: mentee.id, ...visibleCohortWhere },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const discussionComments = await prisma.discussionComment.findMany({
    where: { authorId: mentee.id, post: { organizationId: org.id, ...visibleCohortWhere } },
    include: {
      post: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const serializedMenteeRepositories = menteeRepositories.map((mr) => ({
    ...mr,
    assignedAt: mr.assignedAt.toISOString(),
    repository: { ...mr.repository, lastSyncedAt: mr.repository.lastSyncedAt?.toISOString() || null },
  }));

  return (
    <MenteeProfileClient
      mentee={mentee}
      orgId={org.id}
      orgSlug={params.orgSlug}
      initialTab={searchParams.tab || "overview"}
      githubActivities={githubActivities}
      githubStats={githubStats}
      menteeRepositories={serializedMenteeRepositories}
      blockers={blockers}
      discussionPosts={discussionPosts}
      discussionComments={discussionComments}
      currentUserId={session.id}
    />
  );
}
