import prisma from "@/lib/db";
import { SessionUser } from "@/server/auth/session";

/**
 * Database-backed Analytics Service
 * Provides traceable metrics for Org Admin, Mentor, and Mentee
 */

export async function getOrganizationAnalytics(organizationId: string) {
  const [
    totalMentors,
    totalMentees,
    totalCohorts,
    reports,
    tasks,
    blockers,
    activities,
    cohorts,
  ] = await Promise.all([
    prisma.organizationMembership.count({ where: { organizationId, role: "MENTOR", status: "ACTIVE" } }),
    prisma.organizationMembership.count({ where: { organizationId, role: "MENTEE", status: "ACTIVE" } }),
    prisma.cohort.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.dailyReport.findMany({
      where: { organizationId },
      select: {
        id: true,
        cohortId: true,
        hoursSpent: true,
        status: true,
        reportDate: true,
        createdAt: true,
      },
    }),
    prisma.taskAssignment.findMany({
      where: {
        task: { organizationId, archivedAt: null },
        mentee: { memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } } },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        status: true,
        task: { select: { cohortId: true } },
      },
    }),
    prisma.blocker.findMany({
      where: { organizationId },
      select: {
        id: true,
        cohortId: true,
        title: true,
        status: true,
        urgency: true,
        source: true,
        createdAt: true,
        mentee: { select: { id: true, name: true, email: true } },
        cohort: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gitHubActivity.findMany({
      where: { organizationId },
      select: {
        id: true,
        activityType: true,
        occurredAt: true,
        isFixture: true,
        repository: { select: { id: true, name: true, fullName: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.cohort.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  const cohortIds = cohorts.map((c) => c.id);
  let enrollments: Array<{ cohortId: string }> = [];
  let cohortMentors: Array<{ cohortId: string }> = [];

  if (cohortIds.length > 0) {
    [enrollments, cohortMentors] = await Promise.all([
      prisma.cohortEnrollment.findMany({
        where: {
          cohortId: { in: cohortIds },
          status: "ACTIVE",
          mentee: { memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } } },
        },
        select: { cohortId: true },
      }),
      prisma.cohortMentor.findMany({
        where: {
          cohortId: { in: cohortIds },
          mentor: { memberships: { some: { organizationId, role: "MENTOR", status: "ACTIVE" } } },
        },
        select: { cohortId: true },
      }),
    ]);
  }

  // Count helpers
  const countByCohort = (items: Array<{ cohortId: string | null }>) => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.cohortId) {
        map.set(item.cohortId, (map.get(item.cohortId) || 0) + 1);
      }
    }
    return map;
  };

  const enrollmentCounts = countByCohort(enrollments);
  const mentorCounts = countByCohort(cohortMentors);

  // Reports analytics
  const nonDraftReports = reports.filter((r) => r.status !== "DRAFT");
  const reportsCount = nonDraftReports.length;
  const reviewedReportsCount = reports.filter(
    (r) => r.status === "REVIEWED" || r.status === "CHANGES_REQUESTED"
  ).length;
  const pendingReviewReportsCount = reports.filter(
    (r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW" || r.status === "RESUBMITTED"
  ).length;
  const changesRequestedCount = reports.filter((r) => r.status === "CHANGES_REQUESTED").length;
  const totalHoursLogged = Math.round(
    reports.reduce((acc, r) => acc + (r.hoursSpent || 0), 0) * 10
  ) / 10;
  const reportReviewRate = reportsCount > 0 ? Math.round((reviewedReportsCount / reportsCount) * 100) : 0;

  // Report status breakdown
  const statusBreakdown = {
    submitted: reports.filter((r) => r.status === "SUBMITTED" || r.status === "RESUBMITTED").length,
    underReview: reports.filter((r) => r.status === "UNDER_REVIEW").length,
    changesRequested: changesRequestedCount,
    reviewed: reports.filter((r) => r.status === "REVIEWED").length,
    draft: reports.filter((r) => r.status === "DRAFT").length,
  };

  // Tasks analytics
  const tasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgressTasksCount = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "SUBMITTED").length;
  const taskCompletionRate = tasksCount > 0 ? Math.round((completedTasksCount / tasksCount) * 100) : 0;

  // Blockers analytics
  const totalBlockers = blockers.length;
  const openBlockers = blockers.filter((b) => b.status !== "RESOLVED").length;
  const resolvedBlockers = blockers.filter((b) => b.status === "RESOLVED").length;
  const blockerResolutionRate = totalBlockers > 0 ? Math.round((resolvedBlockers / totalBlockers) * 100) : 0;

  // GitHub activity breakdown
  const githubBreakdown = {
    prsOpened: activities.filter((a) => a.activityType === "PULL_REQUEST_OPENED").length,
    prsMerged: activities.filter((a) => a.activityType === "PULL_REQUEST_MERGED").length,
    prsClosed: activities.filter((a) => a.activityType === "PULL_REQUEST_CLOSED").length,
    commits: activities.filter((a) => a.activityType === "COMMIT").length,
    reviews: activities.filter((a) => a.activityType === "REVIEW_SUBMITTED").length,
    issues: activities.filter((a) => a.activityType === "ISSUE_OPENED" || a.activityType === "ISSUE_CLOSED").length,
    comments: activities.filter((a) => a.activityType === "COMMENT_CREATED").length,
    others: activities.filter((a) => !["PULL_REQUEST_OPENED", "PULL_REQUEST_MERGED", "PULL_REQUEST_CLOSED", "COMMIT", "REVIEW_SUBMITTED", "ISSUE_OPENED", "ISSUE_CLOSED", "COMMENT_CREATED"].includes(a.activityType)).length,
  };

  // Mentor to mentee ratio
  const ratioVal = totalMentors > 0 ? (totalMentees / totalMentors).toFixed(1) : "0.0";
  const mentorMenteeRatio = `1:${ratioVal}`;

  // Cohort breakdown
  const cohortComparison = cohorts.map((cohort) => {
    const cohortReports = reports.filter((r) => r.cohortId === cohort.id);
    const cohortNonDraft = cohortReports.filter((r) => r.status !== "DRAFT");
    const cohortReviewed = cohortReports.filter(
      (r) => r.status === "REVIEWED" || r.status === "CHANGES_REQUESTED"
    );
    const cohortHours = Math.round(cohortReports.reduce((acc, r) => acc + (r.hoursSpent || 0), 0) * 10) / 10;
    const cohortTasks = tasks.filter((t) => t.task.cohortId === cohort.id);
    const cohortCompletedTasks = cohortTasks.filter((t) => t.status === "COMPLETED").length;
    const cohortOpenBlockers = blockers.filter((b) => b.cohortId === cohort.id && b.status !== "RESOLVED").length;

    const mentees = enrollmentCounts.get(cohort.id) || 0;
    const mentors = mentorCounts.get(cohort.id) || 0;
    const cRatio = mentors > 0 ? `1:${(mentees / mentors).toFixed(1)}` : `${mentees}:0`;
    const cReviewRate = cohortNonDraft.length > 0 ? Math.round((cohortReviewed.length / cohortNonDraft.length) * 100) : 0;
    const cTaskRate = cohortTasks.length > 0 ? Math.round((cohortCompletedTasks / cohortTasks.length) * 100) : 0;

    return {
      id: cohort.id,
      name: cohort.name,
      slug: cohort.slug,
      status: cohort.status,
      mentees,
      mentors,
      ratio: cRatio,
      reports: cohortNonDraft.length,
      allReports: cohortReports.length,
      reviewedReports: cohortReviewed.length,
      reviewRate: cReviewRate,
      hours: cohortHours,
      tasks: cohortTasks.length,
      completedTasks: cohortCompletedTasks,
      taskCompletionRate: cTaskRate,
      openBlockers: cohortOpenBlockers,
    };
  });

  // Active blockers needing attention
  const activeBlockers = blockers
    .filter((b) => b.status !== "RESOLVED")
    .map((b) => ({
      id: b.id,
      title: b.title,
      status: b.status,
      urgency: b.urgency,
      source: b.source,
      createdAt: b.createdAt.toISOString(),
      menteeName: b.mentee.name,
      menteeEmail: b.mentee.email,
      cohortName: b.cohort?.name || "Unassigned",
    }));

  // GitHub Contributor Leaderboard
  const githubLeaderboard = await prisma.gitHubActivity.groupBy({
    by: ['githubAccountId'],
    where: { organizationId, isFixture: false },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  const leaderboardAccountIds = githubLeaderboard
    .map(entry => entry.githubAccountId)
    .filter((id): id is string => id !== null);

  const leaderboardAccounts = leaderboardAccountIds.length > 0
    ? await prisma.gitHubAccount.findMany({
        where: { id: { in: leaderboardAccountIds } },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          user: { select: { id: true, name: true, email: true } },
        },
      })
    : [];

  const githubContributors = githubLeaderboard
    .map(entry => {
      const account = leaderboardAccounts.find(a => a.id === entry.githubAccountId);
      if (!account) return null;
      return {
        userId: account.user.id,
        name: account.user.name,
        email: account.user.email,
        username: account.username,
        avatarUrl: account.avatarUrl,
        totalEvents: entry._count.id,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  // Webhook health metrics
  const [totalWebhooks, processedWebhooks, failedWebhooks] = await Promise.all([
    prisma.webhookDelivery.count(),
    prisma.webhookDelivery.count({ where: { status: 'PROCESSED' } }),
    prisma.webhookDelivery.count({ where: { status: 'FAILED' } }),
  ]);

  return {
    metrics: {
      totalMentors,
      totalMentees,
      totalCohorts,
      mentorMenteeRatio,
      reportsCount,
      allReportsCount: reports.length,
      reviewedReportsCount,
      pendingReviewReportsCount,
      changesRequestedCount,
      reportReviewRate,
      totalHoursLogged,
      tasksCount,
      completedTasksCount,
      inProgressTasksCount,
      taskCompletionRate,
      totalBlockers,
      openBlockers,
      resolvedBlockers,
      blockerResolutionRate,
      activityCount: activities.length,
      nonFixtureActivityCount: activities.filter((a) => !a.isFixture).length,
      statusBreakdown,
      githubBreakdown,
      webhookHealth: {
        total: totalWebhooks,
        processed: processedWebhooks,
        failed: failedWebhooks,
        successRate: totalWebhooks > 0 ? Math.round((processedWebhooks / totalWebhooks) * 100) : 100,
      },
      githubContributors,
    },
    cohortComparison,
    activeBlockers,
  };
}

export async function getMentorAnalytics(user: SessionUser, organizationId: string) {
  const mentoredCohorts = await prisma.cohortMentor.findMany({
    where: {
      mentorId: user.id,
      cohort: { organizationId, status: "ACTIVE" },
      mentor: { memberships: { some: { organizationId, role: "MENTOR", status: "ACTIVE" } } },
    },
    include: {
      cohort: {
        include: {
          enrollments: {
            where: {
              status: "ACTIVE",
              mentee: { memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } } },
            },
            include: { mentee: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });

  const cohortIds = mentoredCohorts.map((item) => item.cohortId);
  const activeEnrollments = await prisma.cohortEnrollment.findMany({
    where: {
      cohortId: { in: cohortIds },
      status: "ACTIVE",
      cohort: { organizationId, status: "ACTIVE" },
      mentee: { memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } } },
    },
    select: { menteeId: true, cohortId: true },
  });
  const menteeIds = [...new Set(activeEnrollments.map((enrollment) => enrollment.menteeId))];
  const [
    pendingReportReviews,
    pendingTasks,
    cohortReports,
    cohortTasks,
    cohortBlockers,
    cohortActivities,
  ] = await Promise.all([
    prisma.dailyReport.count({
      where: {
        organizationId,
        cohortId: { in: cohortIds },
        menteeId: { in: menteeIds },
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED"] },
      },
    }),
    prisma.taskAssignment.count({
      where: {
        menteeId: { in: menteeIds },
        task: {
          organizationId,
          archivedAt: null,
          OR: [{ cohortId: null }, { cohortId: { in: cohortIds } }],
        },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),
    menteeIds.length > 0
      ? prisma.dailyReport.findMany({
          where: { organizationId, cohortId: { in: cohortIds }, menteeId: { in: menteeIds } },
          select: { id: true, cohortId: true, status: true, hoursSpent: true },
        })
      : Promise.resolve([]),
    menteeIds.length > 0
      ? prisma.taskAssignment.findMany({
          where: {
            menteeId: { in: menteeIds },
            task: { organizationId, archivedAt: null, OR: [{ cohortId: null }, { cohortId: { in: cohortIds } }] },
            status: { not: "CANCELLED" },
          },
          select: { id: true, status: true, task: { select: { cohortId: true } } },
        })
      : Promise.resolve([]),
    menteeIds.length > 0
      ? prisma.blocker.findMany({
          where: { organizationId, cohortId: { in: cohortIds }, menteeId: { in: menteeIds } },
          select: { id: true, cohortId: true, status: true },
        })
      : Promise.resolve([]),
    menteeIds.length > 0
      ? prisma.gitHubActivity.findMany({
          where: {
            organizationId,
            isFixture: false,
            githubAccount: { userId: { in: menteeIds } },
          },
          select: {
            id: true,
            activityType: true,
            githubAccount: {
              select: {
                userId: true,
                username: true,
                avatarUrl: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const nonDraftReports = cohortReports.filter((r) => r.status !== "DRAFT");
  const reviewedReports = cohortReports.filter((r) => r.status === "REVIEWED" || r.status === "CHANGES_REQUESTED");
  const totalHoursLogged = Math.round(cohortReports.reduce((sum, r) => sum + (r.hoursSpent || 0), 0) * 10) / 10;
  const reviewRate = nonDraftReports.length > 0 ? Math.round((reviewedReports.length / nonDraftReports.length) * 100) : 0;

  const completedTasksCount = cohortTasks.filter((t) => t.status === "COMPLETED").length;
  const taskCompletionRate = cohortTasks.length > 0 ? Math.round((completedTasksCount / cohortTasks.length) * 100) : 0;
  const openBlockersCount = cohortBlockers.filter((b) => b.status !== "RESOLVED").length;

  const githubBreakdown = {
    commits: cohortActivities.filter((a) => a.activityType === "COMMIT").length,
    prsOpened: cohortActivities.filter((a) => a.activityType === "PULL_REQUEST_OPENED").length,
    prsMerged: cohortActivities.filter((a) => a.activityType === "PULL_REQUEST_MERGED").length,
    reviews: cohortActivities.filter((a) => a.activityType === "REVIEW_SUBMITTED").length,
    issues: cohortActivities.filter((a) => a.activityType === "ISSUE_OPENED" || a.activityType === "ISSUE_CLOSED").length,
    comments: cohortActivities.filter((a) => a.activityType === "COMMENT_CREATED").length,
  };

  // Build scoped GitHub contributor leaderboard
  const contribMap = new Map<
    string,
    { userId: string; name: string; email: string; username: string; avatarUrl: string | null; totalEvents: number; commits: number; prs: number; reviews: number }
  >();
  for (const act of cohortActivities) {
    const acc = act.githubAccount;
    if (!acc) continue;
    const existing = contribMap.get(acc.userId) || {
      userId: acc.user.id,
      name: acc.user.name,
      email: acc.user.email,
      username: acc.username,
      avatarUrl: acc.avatarUrl,
      totalEvents: 0,
      commits: 0,
      prs: 0,
      reviews: 0,
    };
    existing.totalEvents++;
    if (act.activityType === "COMMIT") existing.commits++;
    if (act.activityType.startsWith("PULL_REQUEST_")) existing.prs++;
    if (act.activityType === "REVIEW_SUBMITTED") existing.reviews++;
    contribMap.set(acc.userId, existing);
  }
  const menteeLeaderboard = Array.from(contribMap.values()).sort((a, b) => b.totalEvents - a.totalEvents);

  return {
    assignedMenteesCount: menteeIds.length,
    pendingReportReviews,
    pendingTasks,
    totalReports: nonDraftReports.length,
    reviewedReportsCount: reviewedReports.length,
    reviewRate,
    totalHoursLogged,
    totalTasksCount: cohortTasks.length,
    completedTasksCount,
    taskCompletionRate,
    openBlockersCount,
    totalGithubEvents: cohortActivities.length,
    githubBreakdown,
    menteeLeaderboard,
    cohorts: mentoredCohorts.map((item) => {
      const cReports = cohortReports.filter((r) => r.cohortId === item.cohort.id && r.status !== "DRAFT");
      const cReviewed = cReports.filter((r) => r.status === "REVIEWED" || r.status === "CHANGES_REQUESTED");
      const cHours = Math.round(cohortReports.filter((r) => r.cohortId === item.cohort.id).reduce((s, r) => s + (r.hoursSpent || 0), 0) * 10) / 10;
      const cTasks = cohortTasks.filter((t) => t.task.cohortId === item.cohort.id);
      const cCompleted = cTasks.filter((t) => t.status === "COMPLETED").length;
      const cBlockers = cohortBlockers.filter((b) => b.cohortId === item.cohort.id && b.status !== "RESOLVED").length;

      return {
        id: item.cohort.id,
        name: item.cohort.name,
        menteesCount: item.cohort.enrollments.length,
        reportsCount: cReports.length,
        reviewRate: cReports.length > 0 ? Math.round((cReviewed.length / cReports.length) * 100) : 0,
        hoursLogged: cHours,
        tasksTotal: cTasks.length,
        tasksCompleted: cCompleted,
        openBlockers: cBlockers,
      };
    }),
  };
}

export async function getMenteeAnalytics(userId: string, organizationId: string) {
  const activeEnrollments = await prisma.cohortEnrollment.findMany({
    where: { menteeId: userId, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } },
    select: { cohortId: true },
  });
  const activeCohortIds = activeEnrollments.map((enrollment) => enrollment.cohortId);
  const visibleTaskScope = {
    organizationId,
    archivedAt: null,
    OR: [{ cohortId: null }, { cohortId: { in: activeCohortIds } }],
  };
  const visibleLearningPathScope = {
    organizationId,
    OR: [{ cohortId: null }, { cohortId: { in: activeCohortIds } }],
  };
  const [
    myReportsCount,
    myReviewedReports,
    myCompletedTasks,
    myTotalTasks,
    myActivitiesCount,
    milestonesApproved,
    milestonesTotal,
  ] = await Promise.all([
    prisma.dailyReport.count({
      where: { menteeId: userId, organizationId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "RESUBMITTED", "REVIEWED"] } },
    }),
    prisma.dailyReport.count({
      where: { menteeId: userId, organizationId, status: "REVIEWED" },
    }),
    prisma.taskAssignment.count({
      where: { menteeId: userId, task: visibleTaskScope, status: "COMPLETED" },
    }),
    prisma.taskAssignment.count({
      where: { menteeId: userId, task: visibleTaskScope, status: { not: "CANCELLED" } },
    }),
    prisma.gitHubActivity.count({
      where: {
        organizationId,
        githubAccount: { userId },
        isFixture: false,
        repository: { memberRepositories: { some: { organizationId, userId } } },
      },
    }),
    prisma.menteeMilestone.count({
      where: { menteeId: userId, status: "APPROVED", milestone: { learningPath: visibleLearningPathScope } },
    }),
    prisma.learningMilestone.count({ where: { learningPath: visibleLearningPathScope } }),
  ]);

  return {
    myReportsCount,
    myReviewedReports,
    myCompletedTasks,
    myTotalTasks,
    myActivitiesCount,
    milestonesApproved,
    milestonesTotal,
  };
}

