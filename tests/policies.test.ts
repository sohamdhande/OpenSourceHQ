import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import {
  canManageOrganization,
  canManageCohort,
  canViewReport,
  canReviewReport,
} from "@/server/authorization/policies";
import { OrgRole, UserStatus } from "@prisma/client";

describe("Authorization Policies & Multi-Tenant Isolation", () => {
  let orgAdminUser: any;
  let mentorUser: any;
  let menteeAUser: any;
  let menteeBUser: any;
  let org: any;
  let cohort: any;
  let reportPrivate: any;
  let reportShared: any;

  beforeAll(async () => {
    org = await prisma.organization.findUnique({
      where: { slug: "nstsdc" },
      include: { cohorts: true },
    });

    cohort = org.cohorts[0];

    orgAdminUser = await prisma.user.findUnique({
      where: { email: "sarah.admin@nstsdc.org" },
    });

    mentorUser = await prisma.user.findUnique({
      where: { email: "alex.mentor@nstsdc.org" },
    });

    menteeAUser = await prisma.user.findUnique({
      where: { email: "devon.mentee@nstsdc.org" },
    });

    menteeBUser = await prisma.user.findUnique({
      where: { email: "kavita.mentee@nstsdc.org" },
    });

    // Create a strictly private report for Mentee A
    reportPrivate = await prisma.dailyReport.create({
      data: {
        organizationId: org.id,
        cohortId: cohort.id,
        menteeId: menteeAUser.id,
        reportDate: new Date("2026-08-01T00:00:00Z"),
        workDone: "Confidential research on kernel scheduler",
        learning: "Understanding CFS latency bounds",
        nextSteps: "Benchmark in isolation",
        visibility: "MENTORS_ONLY",
        status: "SUBMITTED",
      },
    });

    // Create a cohort-shared report for Mentee A
    reportShared = await prisma.dailyReport.create({
      data: {
        organizationId: org.id,
        cohortId: cohort.id,
        menteeId: menteeAUser.id,
        reportDate: new Date("2026-08-02T00:00:00Z"),
        workDone: "Shared benchmark results for socket buffers",
        learning: "Memory alignment improves cache line hits",
        nextSteps: "Publish to cohort",
        visibility: "COHORT",
        status: "SUBMITTED",
      },
    });
  });

  afterAll(async () => {
    await prisma.dailyReport.deleteMany({
      where: {
        id: { in: [reportPrivate.id, reportShared.id] },
      },
    });
  });

  it("Org Admin can manage organization", async () => {
    const session = {
      id: orgAdminUser.id,
      name: orgAdminUser.name,
      email: orgAdminUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
    };

    const allowed = await canManageOrganization(session, org.id);
    expect(allowed).toBe(true);
  });

  it("Mentee cannot manage organization", async () => {
    const session = {
      id: menteeAUser.id,
      name: menteeAUser.name,
      email: menteeAUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
    };

    const allowed = await canManageOrganization(session, org.id);
    expect(allowed).toBe(false);
  });

  it("Mentee cannot review their own report", async () => {
    const session = {
      id: menteeAUser.id,
      name: menteeAUser.name,
      email: menteeAUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
    };

    const allowed = await canReviewReport(session, reportPrivate.id);
    expect(allowed).toBe(false);
  });

  it("Assigned Mentor can review mentee report", async () => {
    const session = {
      id: mentorUser.id,
      name: mentorUser.name,
      email: mentorUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
    };

    const allowed = await canReviewReport(session, reportPrivate.id);
    expect(allowed).toBe(true);
  });

  it("Mentee B CANNOT view Mentee A's private report", async () => {
    const session = {
      id: menteeBUser.id,
      name: menteeBUser.name,
      email: menteeBUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
    };

    const allowed = await canViewReport(session, reportPrivate.id);
    expect(allowed).toBe(false);
  });

  it("Mentee B CAN view Mentee A's cohort-shared report", async () => {
    const session = {
      id: menteeBUser.id,
      name: menteeBUser.name,
      email: menteeBUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
    };

    const allowed = await canViewReport(session, reportShared.id);
    expect(allowed).toBe(true);
  });

  it("Cross-tenant isolation: user from Org A cannot manage an unknown Org B", async () => {
    const session = {
      id: menteeAUser.id,
      name: menteeAUser.name,
      email: menteeAUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
    };

    const fakeOrgId = "non-existent-or-other-tenant-id";
    const allowed = await canManageOrganization(session, fakeOrgId);
    expect(allowed).toBe(false);
  });
});

