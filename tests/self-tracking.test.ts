import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import {
  canAccessSelfTrackingSetup,
  canManageTask,
  canReviewReport,
  canUseSelfTracking,
  canViewReport,
} from "@/server/authorization/policies";
import { submitSelfTrackedReport } from "@/features/reports/reports-service";
import {
  createSelfTrackedTask,
  deleteSelfTrackedTask,
  updateSelfTrackedTaskStatus,
} from "@/features/tasks/tasks-service";
import {
  createSelfTrackedBlocker,
  listBlockers,
  listSelfTrackedBlockers,
  reopenBlocker,
  resolveBlocker,
} from "@/features/blockers/blockers-service";
import { canManageMemberRepositories } from "@/features/repositories/access";
import { SessionUser } from "@/server/auth/session";

describe("Admin & Mentor Self-Tracking", () => {
  let orgId: string;
  let adminMembershipId: string;
  let mentorMembershipId: string;
  let menteeMembershipId: string;

  let adminSession: SessionUser;
  let mentorSession: SessionUser;
  let menteeSession: SessionUser;

  const createdReportIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdBlockerIds: string[] = [];

  beforeAll(async () => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "nstsdc" } });
    orgId = org.id;

    const [adminMem, mentorMem, menteeMem] = await Promise.all([
      prisma.organizationMembership.findFirstOrThrow({
        where: { organizationId: orgId, role: "ORG_ADMIN", status: "ACTIVE" },
        include: { user: true },
      }),
      prisma.organizationMembership.findFirstOrThrow({
        where: { organizationId: orgId, role: "MENTOR", status: "ACTIVE" },
        include: { user: true },
      }),
      prisma.organizationMembership.findFirstOrThrow({
        where: { organizationId: orgId, role: "MENTEE", status: "ACTIVE" },
        include: { user: true },
      }),
    ]);

    adminMembershipId = adminMem.id;
    mentorMembershipId = mentorMem.id;
    menteeMembershipId = menteeMem.id;

    const makeSession = (m: typeof adminMem): SessionUser => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      timezone: m.user.timezone,
      status: m.user.status,
      isPlatformSuperAdmin: false,
      activeOrgId: orgId,
      activeOrgRole: m.role,
      activeOrgSlug: org.slug,
      activeOrgName: org.name,
    });

    adminSession = makeSession(adminMem);
    mentorSession = makeSession(mentorMem);
    menteeSession = makeSession(menteeMem);

    // Ensure clean starting state
    await prisma.organizationMembership.updateMany({
      where: { id: { in: [adminMembershipId, mentorMembershipId] } },
      data: { selfTrackingEnabled: false, selfTrackingEnabledAt: null },
    });
  });

  afterAll(async () => {
    if (createdReportIds.length) {
      await prisma.dailyReport.deleteMany({ where: { id: { in: createdReportIds } } });
    }
    if (createdTaskIds.length) {
      await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    }
    if (createdBlockerIds.length) {
      await prisma.blocker.deleteMany({ where: { id: { in: createdBlockerIds } } });
    }
    await prisma.organizationMembership.updateMany({
      where: { id: { in: [adminMembershipId, mentorMembershipId] } },
      data: { selfTrackingEnabled: false, selfTrackingEnabledAt: null },
    });
  });

  it("defaults selfTrackingEnabled to false and blocks mentees from opt-in", async () => {
    const adminMem = await prisma.organizationMembership.findUniqueOrThrow({ where: { id: adminMembershipId } });
    expect(adminMem.selfTrackingEnabled).toBe(false);

    expect(await canAccessSelfTrackingSetup(adminSession, orgId)).toBe(true);
    expect(await canAccessSelfTrackingSetup(mentorSession, orgId)).toBe(true);
    expect(await canAccessSelfTrackingSetup(menteeSession, orgId)).toBe(false);

    expect(await canUseSelfTracking(adminSession, orgId)).toBe(false);
    expect(await canUseSelfTracking(menteeSession, orgId)).toBe(false);
  });

  it("enables self-tracking for admin and mentor, and blocks disabled users while preserving data", async () => {
    await prisma.organizationMembership.update({
      where: { id: adminMembershipId },
      data: { selfTrackingEnabled: true, selfTrackingEnabledAt: new Date() },
    });
    expect(await canUseSelfTracking(adminSession, orgId)).toBe(true);
    expect(await canManageMemberRepositories(adminSession, orgId, adminSession.id)).toBe(true);

    // Create a personal daily log
    const report = await submitSelfTrackedReport(adminSession, {
      organizationId: orgId,
      reportDate: "2026-11-27",
      workDone: "Worked on OSS PR #42 and fixed edge case.",
      learning: "Learned how Prisma partial unique indexes work.",
      nextSteps: "Add regression tests and merge.",
      hoursSpent: 2,
    });
    createdReportIds.push(report.id);

    expect(report.cohortId).toBeNull();
    expect(report.isSelfTracked).toBe(true);

    // Upsert same date updates instead of creating duplicate
    const updatedReport = await submitSelfTrackedReport(adminSession, {
      organizationId: orgId,
      reportDate: "2026-11-27",
      workDone: "Updated OSS PR #42 and pushed final commit.",
      learning: "Learned how Prisma partial unique indexes work.",
      nextSteps: "Monitor CI.",
      hoursSpent: 3,
    });
    expect(updatedReport.id).toBe(report.id);

    // Privacy: mentor and another user cannot view or review personal report
    expect(await canViewReport(adminSession, report.id)).toBe(true);
    expect(await canViewReport(mentorSession, report.id)).toBe(false);
    expect(await canViewReport(menteeSession, report.id)).toBe(false);
    expect(await canReviewReport(mentorSession, report.id)).toBe(false);
    expect(await canReviewReport(adminSession, report.id)).toBe(false);

    // Disable self-tracking -> data preserved, access blocked
    await prisma.organizationMembership.update({
      where: { id: adminMembershipId },
      data: { selfTrackingEnabled: false },
    });
    expect(await canUseSelfTracking(adminSession, orgId)).toBe(false);
    expect(await canViewReport(adminSession, report.id)).toBe(false);
    const preserved = await prisma.dailyReport.findUnique({ where: { id: report.id } });
    expect(preserved).not.toBeNull();

    // Re-enable restores access
    await prisma.organizationMembership.update({
      where: { id: adminMembershipId },
      data: { selfTrackingEnabled: true },
    });
    expect(await canViewReport(adminSession, report.id)).toBe(true);
  });

  it("supports personal tasks without mentor review and isolates from other users", async () => {
    await prisma.organizationMembership.update({
      where: { id: mentorMembershipId },
      data: { selfTrackingEnabled: true, selfTrackingEnabledAt: new Date() },
    });

    const task = await createSelfTrackedTask(mentorSession, {
      organizationId: orgId,
      title: "Refactor CLI parser",
      description: "Clean up argument validation in upstream OSS repo.",
      priority: "HIGH",
    });
    createdTaskIds.push(task.id);

    expect(task.isSelfTracked).toBe(true);
    expect(task.cohortId).toBeNull();
    expect(await canManageTask(mentorSession, task.id, mentorSession.id)).toBe(true);
    expect(await canManageTask(adminSession, task.id, mentorSession.id)).toBe(false);

    const completed = await updateSelfTrackedTaskStatus(mentorSession, task.id, "COMPLETED");
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();

    await expect(deleteSelfTrackedTask(adminSession, task.id)).rejects.toThrow();
  });

  it("supports personal blockers isolated from cohort blocker queues", async () => {
    const blocker = await createSelfTrackedBlocker(mentorSession, {
      organizationId: orgId,
      title: "Flaky local integration test",
      description: "Investigating race condition in test teardown.",
      urgency: "MEDIUM",
    });
    createdBlockerIds.push(blocker.id);

    expect(blocker.isSelfTracked).toBe(true);
    expect(blocker.cohortId).toBeNull();
    expect(blocker.mentorId).toBeNull();

    const selfBlockers = await listSelfTrackedBlockers(mentorSession, orgId);
    expect(selfBlockers.some((b) => b.id === blocker.id)).toBe(true);

    // Cohort/org blocker queue must not contain personal blockers
    const orgBlockers = await listBlockers(adminSession, orgId);
    expect(orgBlockers.some((b) => b.id === blocker.id)).toBe(false);

    // Owner can resolve and reopen directly
    const resolved = await resolveBlocker(mentorSession, blocker.id, "Fixed race condition.", "RESOLVED");
    expect(resolved.status).toBe("RESOLVED");

    const reopened = await reopenBlocker(mentorSession, blocker.id);
    expect(reopened.status).toBe("REOPENED");
  });
});

