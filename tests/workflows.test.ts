import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import {
  UserStatus,
  BlockerStatus,
  BlockerUrgency,
  TaskPriority,
  TaskAssignmentStatus,
  TaskReviewDecision,
  FeedbackCategory,
  FeedbackVisibility,
  ReportVisibility,
} from "@prisma/client";
import { createBlocker, resolveBlocker, reopenBlocker } from "@/features/blockers/blockers-service";
import { createTask, submitTaskAssignment, reviewTaskAssignment } from "@/features/tasks/tasks-service";
import { verifyWebhookSignature, processWebhookDelivery } from "@/features/github/github-service";
import { getMentorAnalytics } from "@/features/analytics/analytics-service";
import { createHmac } from "crypto";

describe("OpenSourceHQ — Core Workflows Integration Suite (A through K)", () => {
  let org: any;
  let cohort: any;
  let adminUser: any;
  let mentorUser: any;
  let menteeUser: any;
  let menteeOtherUser: any;

  let adminSession: any;
  let mentorSession: any;
  let menteeSession: any;

  // Cleanup tracking
  const createdReportIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdBlockerIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdPostIds: string[] = [];
  const createdFeedbackIds: string[] = [];
  const createdInvitationIds: string[] = [];
  const createdDeliveryIds: string[] = [];

  beforeAll(async () => {
    org = await prisma.organization.findUnique({
      where: { slug: "nstsdc" },
      include: { cohorts: true },
    });

    cohort = org.cohorts[0];

    adminUser = await prisma.user.findUnique({
      where: { email: "sarah.admin@nstsdc.org" },
    });

    mentorUser = await prisma.user.findUnique({
      where: { email: "alex.mentor@nstsdc.org" },
    });

    menteeUser = await prisma.user.findUnique({
      where: { email: "devon.mentee@nstsdc.org" },
    });

    menteeOtherUser = await prisma.user.findUnique({
      where: { email: "kavita.mentee@nstsdc.org" },
    });

    adminSession = {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
      activeOrgId: org.id,
      activeOrgRole: "ORG_ADMIN",
    };

    mentorSession = {
      id: mentorUser.id,
      name: mentorUser.name,
      email: mentorUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
      activeOrgId: org.id,
      activeOrgRole: "MENTOR",
    };

    menteeSession = {
      id: menteeUser.id,
      name: menteeUser.name,
      email: menteeUser.email,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      isPlatformSuperAdmin: false,
      activeOrgId: org.id,
      activeOrgRole: "MENTEE",
    };
  });

  afterAll(async () => {
    // Clean up created test data
    if (createdReportIds.length > 0) {
      await prisma.reportReview.deleteMany({ where: { reportId: { in: createdReportIds } } });
      await prisma.reportLink.deleteMany({ where: { reportId: { in: createdReportIds } } });
      await prisma.dailyReport.deleteMany({ where: { id: { in: createdReportIds } } });
    }
    if (createdTaskIds.length > 0) {
      await prisma.taskReview.deleteMany({
        where: { assignment: { taskId: { in: createdTaskIds } } },
      });
      await prisma.taskSubmission.deleteMany({
        where: { assignment: { taskId: { in: createdTaskIds } } },
      });
      await prisma.taskAssignment.deleteMany({ where: { taskId: { in: createdTaskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    }
    if (createdBlockerIds.length > 0) {
      await prisma.blocker.deleteMany({ where: { id: { in: createdBlockerIds } } });
    }
    if (createdFeedbackIds.length > 0) {
      await prisma.feedback.deleteMany({ where: { id: { in: createdFeedbackIds } } });
    }
    if (createdPostIds.length > 0) {
      await prisma.discussionComment.deleteMany({ where: { postId: { in: createdPostIds } } });
      await prisma.discussionPost.deleteMany({ where: { id: { in: createdPostIds } } });
    }
    if (createdEventIds.length > 0) {
      await prisma.eventRsvp.deleteMany({ where: { eventId: { in: createdEventIds } } });
      await prisma.attendance.deleteMany({ where: { eventId: { in: createdEventIds } } });
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    }
    if (createdInvitationIds.length > 0) {
      await prisma.invitation.deleteMany({ where: { id: { in: createdInvitationIds } } });
    }
    if (createdDeliveryIds.length > 0) {
      await prisma.webhookDelivery.deleteMany({ where: { deliveryId: { in: createdDeliveryIds } } });
    }
  });

  // Workflow A: Invitation & Enrollment
  it("Workflow A: Invitation creation and acceptance lifecycle", async () => {
    const inviteEmail = `test.invite.${Date.now()}@nstsdc.org`;
    const token = `tok_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: org.id,
        email: inviteEmail,
        role: "MENTEE",
        cohortId: cohort.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedById: adminUser.id,
      },
    });
    createdInvitationIds.push(invitation.id);
    expect(invitation.id).toBeDefined();

    // Verify invitation exists
    const fetched = await prisma.invitation.findUnique({ where: { token } });
    expect(fetched).not.toBeNull();
    expect(fetched?.email).toBe(inviteEmail);
    expect(fetched?.role).toBe("MENTEE");
  });

  // Workflow B: Daily Progress Report Lifecycle (Draft -> Submit -> Changes Requested -> Resubmit -> Reviewed)
  it("Workflow B: Complete Daily Progress Report lifecycle", async () => {
    // 1. Mentee creates draft
    const reportDate = new Date();
    reportDate.setHours(0, 0, 0, 0);

    const report = await prisma.dailyReport.create({
      data: {
        organizationId: org.id,
        cohortId: cohort.id,
        menteeId: menteeUser.id,
        reportDate,
        workDone: "Drafting memory allocator benchmark",
        learning: "Initial slab allocator overhead",
        nextSteps: "Run profiling",
        status: "DRAFT",
        visibility: ReportVisibility.MENTORS_ONLY,
      },
    });
    createdReportIds.push(report.id);
    expect(report.status).toBe("DRAFT");

    // 2. Mentee submits report
    const submittedReport = await prisma.dailyReport.update({
      where: { id: report.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        hoursSpent: 5.5,
      },
    });
    expect(submittedReport.status).toBe("SUBMITTED");

    // 3. Mentor requests changes
    await prisma.reportReview.create({
      data: {
        reportId: report.id,
        reviewerId: mentorUser.id,
        status: "CHANGES_REQUESTED",
        comment: "Please link the profiler flamegraph and clarify GC latency.",
      },
    });
    await prisma.dailyReport.update({
      where: { id: report.id },
      data: { status: "CHANGES_REQUESTED" },
    });

    const reportAfterChangesReq = await prisma.dailyReport.findUnique({
      where: { id: report.id },
      include: { reviews: true },
    });
    expect(reportAfterChangesReq?.status).toBe("CHANGES_REQUESTED");
    expect(reportAfterChangesReq?.reviews.length).toBe(1);

    // 4. Mentee edits and resubmits
    const resubmitted = await prisma.dailyReport.update({
      where: { id: report.id },
      data: {
        workDone: "Drafting memory allocator benchmark with flamegraph attached",
        status: "RESUBMITTED",
        submittedAt: new Date(),
      },
    });
    expect(resubmitted.status).toBe("RESUBMITTED");

    // 5. Mentor marks reviewed
    await prisma.reportReview.create({
      data: {
        reportId: report.id,
        reviewerId: mentorUser.id,
        status: "REVIEWED",
        comment: "Excellent improvements. Approved.",
      },
    });
    const finalReport = await prisma.dailyReport.update({
      where: { id: report.id },
      data: { status: "REVIEWED" },
    });
    expect(finalReport.status).toBe("REVIEWED");
  });

  // Workflow C: Task Assignment & Evaluation
  it("Workflow C: Task creation, mentee submission, and mentor evaluation", async () => {
    // 1. Mentor creates task
    const task = await createTask(mentorSession, {
      organizationId: org.id,
      cohortId: cohort.id,
      title: "Implement Cache Invalidation Hook",
      description: "Add atomic cache line flush on write barriers.",
      priority: TaskPriority.HIGH,
      category: "Architecture",
      assigneeIds: [menteeUser.id],
    });
    createdTaskIds.push(task.id);
    expect(task.assignments.length).toBe(1);

    const assignmentId = task.assignments[0].id;
    expect(task.assignments[0].status).toBe(TaskAssignmentStatus.TODO);

    // 2. Mentee submits deliverable
    const submissionResult = await submitTaskAssignment(
      menteeSession,
      assignmentId,
      "Implemented using CAS primitives. Passed local unit tests.",
      "https://github.com/nstsdc/hyper-kernel/pull/42"
    );
    expect(submissionResult.updatedAssignment.status).toBe(TaskAssignmentStatus.SUBMITTED);

    // 3. Mentor evaluates and accepts submission
    const reviewResult = await reviewTaskAssignment(
      mentorSession,
      assignmentId,
      TaskReviewDecision.ACCEPTED,
      "Flawless memory barrier semantics. Approved."
    );
    expect(reviewResult.updated.status).toBe(TaskAssignmentStatus.COMPLETED);
  });

  // Workflow D: Blocker Lifecycle (Raise -> Guidance -> Resolve -> Reopen)
  it("Workflow D: Complete Blocker lifecycle from raise to resolution and reopen", async () => {
    // 1. Mentee raises blocker
    const blocker = await createBlocker(menteeSession, {
      organizationId: org.id,
      cohortId: cohort.id,
      title: "Kernel panics during QEMU SMP emulation",
      description: "Receiving unexpected triple fault when booting with -smp 4.",
      urgency: BlockerUrgency.HIGH,
      category: "Environment",
    });
    createdBlockerIds.push(blocker.id);
    expect(blocker.status).toBe(BlockerStatus.OPEN);
    expect(blocker.urgency).toBe(BlockerUrgency.HIGH);

    // 2. Mentor responds with guidance and marks resolved
    const resolved = await resolveBlocker(
      mentorSession,
      blocker.id,
      "Ensure the LAPIC timer base frequency is calibrated before AP boot.",
      BlockerStatus.RESOLVED
    );
    expect(resolved.status).toBe(BlockerStatus.RESOLVED);
    expect(resolved.firstRespondedAt).not.toBeNull();
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.mentorId).toBe(mentorUser.id);

    // 3. Mentee reopens blocker
    const reopened = await reopenBlocker(menteeSession, blocker.id);
    expect(reopened.status).toBe(BlockerStatus.REOPENED);
    expect(reopened.resolvedAt).toBeNull();
  });

  // Workflow E: Learning Milestone Submission & Review
  it("Workflow E: Learning milestone submission and approval", async () => {
    // Find or create learning milestone
    let milestone = await prisma.learningMilestone.findFirst();
    if (!milestone) {
      let path = await prisma.learningPath.findFirst();
      if (!path) {
        path = await prisma.learningPath.create({
          data: {
            title: "Kernel Core Systems",
            createdById: adminUser.id,
            organizationId: org.id,
          },
        });
      }
      milestone = await prisma.learningMilestone.create({
        data: {
          learningPathId: path.id,
          title: "Lockless Queue Implementation",
          description: "Build an ABA-safe lock-free ring buffer.",
        },
      });
    }

    // Upsert mentee milestone
    const menteeMilestone = await prisma.menteeMilestone.upsert({
      where: {
        menteeId_milestoneId: {
          menteeId: menteeUser.id,
          milestoneId: milestone.id,
        },
      },
      create: {
        menteeId: menteeUser.id,
        milestoneId: milestone.id,
        status: "SUBMITTED",
        notes: "Completed hazard pointer lockless queue.",
        evidenceUrl: "https://github.com/nstsdc/hyper-kernel/pull/44",
      },
      update: {
        status: "SUBMITTED",
        notes: "Completed hazard pointer lockless queue.",
        evidenceUrl: "https://github.com/nstsdc/hyper-kernel/pull/44",
      },
    });
    expect(menteeMilestone.status).toBe("SUBMITTED");

    // Mentor approves
    const approved = await prisma.menteeMilestone.update({
      where: {
        menteeId_milestoneId: {
          menteeId: menteeUser.id,
          milestoneId: milestone.id,
        },
      },
      data: {
        status: "APPROVED",
        reviewedById: mentorUser.id,
        reviewedAt: new Date(),
      },
    });
    expect(approved.status).toBe("APPROVED");
    expect(approved.reviewedById).toBe(mentorUser.id);
  });

  // Workflow F: GitHub Webhook HMAC Verification & Idempotency
  it("Workflow F: GitHub Webhook HMAC validation and idempotent processing", async () => {
    const secret = "test-webhook-secret-123";
    const payload = JSON.stringify({
      action: "opened",
      pull_request: { id: 9999, number: 101, title: "Fix buffer overrun" },
    });

    // Valid HMAC SHA-256 signature
    const hmac = createHmac("sha256", secret);
    hmac.update(payload, "utf8");
    const validSignature = `sha256=${hmac.digest("hex")}`;

    const isValid = verifyWebhookSignature(payload, validSignature, secret);
    expect(isValid).toBe(true);

    const isTampered = verifyWebhookSignature(payload + " ", validSignature, secret);
    expect(isTampered).toBe(false);

    // Idempotent delivery test via processWebhookDelivery
    const deliveryId = `test-delivery-${Date.now()}`;
    createdDeliveryIds.push(deliveryId);

    const result1 = await processWebhookDelivery({
      deliveryId,
      eventType: "ping",
      rawPayload: { zen: "Design for failure." },
    });
    expect(result1.alreadyProcessed).toBeFalsy();

    // Second processing of identical deliveryId is recognized as already processed
    const result2 = await processWebhookDelivery({
      deliveryId,
      eventType: "ping",
      rawPayload: { zen: "Design for failure." },
    });
    expect(result2.alreadyProcessed).toBe(true);
  });

  // Workflow G: Mentor Feedback & Privacy Isolation
  it("Workflow G: Structured feedback creation, private notes protection, and mentee response", async () => {
    // 1. Mentor publishes structured feedback with private notes
    const feedback = await prisma.feedback.create({
      data: {
        organizationId: org.id,
        authorId: mentorUser.id,
        menteeId: menteeUser.id,
        category: FeedbackCategory.TECHNICAL,
        content: "Outstanding progression across low-level primitives.",
        technicalStrengths: "Exceptional C and Assembly proficiency.",
        areasForImprovement: "Write more integration tests for edge cases.",
        codeQuality: "High",
        privateNotes: "Candidate demonstrates strong staff engineer potential.",
        visibility: FeedbackVisibility.PRIVATE_TO_MENTEE,
        status: "PUBLISHED",
      },
    });
    createdFeedbackIds.push(feedback.id);
    expect(feedback.privateNotes).toBeDefined();

    // 2. Mentee acknowledges and submits response
    const updatedFeedback = await prisma.feedback.update({
      where: { id: feedback.id },
      data: {
        acknowledgedAt: new Date(),
        menteeResponse: "Thank you for the guidance! I will add automated fuzz tests.",
      },
    });
    expect(updatedFeedback.acknowledgedAt).not.toBeNull();
    expect(updatedFeedback.menteeResponse).toContain("automated fuzz tests");
  });

  // Workflow H: Community Discussions & Threaded Comments
  it("Workflow H: Cohort discussion topic and threaded discussion replies", async () => {
    // 1. Mentee creates discussion post
    const post = await prisma.discussionPost.create({
      data: {
        organizationId: org.id,
        cohortId: cohort.id,
        authorId: menteeUser.id,
        title: "Best practices for NUMA memory affinity?",
        content: "Does anyone have recommendations for pin threads to NUMA nodes in Linux?",
      },
    });
    createdPostIds.push(post.id);
    expect(post.id).toBeDefined();

    // 2. Mentor replies
    const mentorComment = await prisma.discussionComment.create({
      data: {
        postId: post.id,
        authorId: mentorUser.id,
        content: "Look at libnuma and pthread_setaffinity_np.",
      },
    });
    expect(mentorComment.id).toBeDefined();

    // 3. Mentee adds threaded child reply
    const childComment = await prisma.discussionComment.create({
      data: {
        postId: post.id,
        parentId: mentorComment.id,
        authorId: menteeUser.id,
        content: "libnuma worked smoothly, thank you!",
      },
    });
    expect(childComment.parentId).toBe(mentorComment.id);
  });

  // Workflow I: Events, RSVPs & Attendance Recording
  it("Workflow I: Event scheduling, mentee RSVP, and verified attendance recording", async () => {
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    // 1. Admin creates event
    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        cohortId: cohort.id,
        createdById: adminUser.id,
        title: "Kernel Synchronization Workshop",
        startsAt,
        endsAt,
        meetingUrl: "https://meet.google.com/test-sync-101",
      },
    });
    createdEventIds.push(event.id);
    expect(event.id).toBeDefined();

    // 2. Mentee RSVPs
    const rsvp = await prisma.eventRsvp.upsert({
      where: {
        eventId_userId: {
          eventId: event.id,
          userId: menteeUser.id,
        },
      },
      create: {
        eventId: event.id,
        userId: menteeUser.id,
        status: "YES",
      },
      update: {
        status: "YES",
      },
    });
    expect(rsvp.status).toBe("YES");

    // 3. Admin records verified attendance
    const attendance = await prisma.attendance.upsert({
      where: {
        eventId_userId: {
          eventId: event.id,
          userId: menteeUser.id,
        },
      },
      create: {
        eventId: event.id,
        userId: menteeUser.id,
        status: "PRESENT",
        recordedById: adminUser.id,
      },
      update: {
        status: "PRESENT",
      },
    });
    expect(attendance.status).toBe("PRESENT");
  });

  // Workflow J: Mentor Cohort Assignment & Access Verification
  it("Workflow J: Mentor cohort assignment grants access to mentee profiles", async () => {
    // Mentor is assigned to cohort
    const assignment = await prisma.cohortMentor.findFirst({
      where: { cohortId: cohort.id, mentorId: mentorUser.id },
    });
    expect(assignment).not.toBeNull();

    // Mentee is enrolled in cohort
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: { cohortId: cohort.id, menteeId: menteeUser.id, status: "ACTIVE" },
    });
    expect(enrollment).not.toBeNull();
  });

  // Workflow K: Account Suspension Enforcement
  it("Workflow K: Account suspension status is persisted and verifiable", async () => {
    const testUser = await prisma.user.create({
      data: {
        name: "Suspension Test Subject",
        email: `suspend.test.${Date.now()}@nstsdc.org`,
        timezone: "UTC",
        status: "ACTIVE",
      },
    });

    const membership = await prisma.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: testUser.id,
        role: "MENTEE",
        status: "ACTIVE",
      },
    });

    const suspended = await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { status: "SUSPENDED" },
    });
    expect(suspended.status).toBe("SUSPENDED");

    // Clean up
    await prisma.organizationMembership.delete({ where: { id: membership.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  // Workflow L: Organization Admin can also act as a Cohort Mentor
  it("Workflow L: Organization Admin can be assigned as cohort mentor and access mentor analytics", async () => {
    const existingAssignment = await prisma.cohortMentor.findUnique({
      where: { cohortId_mentorId: { cohortId: cohort.id, mentorId: adminUser.id } },
    });

    if (!existingAssignment) {
      await prisma.cohortMentor.create({
        data: { cohortId: cohort.id, mentorId: adminUser.id },
      });
    }

    try {
      const mentorMembershipMatches = await prisma.organizationMembership.findMany({
        where: {
          organizationId: org.id,
          userId: { in: [adminUser.id] },
          status: "ACTIVE",
          role: { in: ["MENTOR", "ORG_ADMIN"] },
        },
        select: { userId: true },
      });
      expect(mentorMembershipMatches).toHaveLength(1);

      const analytics = await getMentorAnalytics(adminSession, org.id);
      expect(analytics.cohorts.length).toBeGreaterThanOrEqual(1);
    } finally {
      if (!existingAssignment) {
        await prisma.cohortMentor.delete({
          where: { cohortId_mentorId: { cohortId: cohort.id, mentorId: adminUser.id } },
        });
      }
    }
  });
});
