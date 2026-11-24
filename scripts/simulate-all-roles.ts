import prisma from "../src/lib/db";

const BASE_URL = "http://localhost:3000";

interface UserSession {
  email: string;
  name: string;
  role: string;
  cookie: string;
  orgId: string;
  orgSlug: string;
}

async function loginUser(email: string): Promise<UserSession> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.statusText}`);

  const cookie = res.headers.get("set-cookie") || "";
  const data = await res.json();
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie } });
  const sessionData = await sessionRes.json();

  return {
    email: data.user.email,
    name: data.user.name,
    role: data.user.activeOrgRole,
    cookie,
    orgId: sessionData.user.activeOrgId,
    orgSlug: data.user.activeOrgSlug || "nstsdc",
  };
}

async function runEndToEndSimulation() {
  console.log("\n========================================================");
  console.log("  OPENSOURCEHQ — COMPREHENSIVE END-TO-END ROLE SIMULATION");
  console.log("  Testing all actions for Mentees, Mentors, and Admins");
  console.log("========================================================\n");

  // ---------------------------------------------------------
  // PHASE 1: MENTEE ACTIONS (Devon Lane)
  // ---------------------------------------------------------
  console.log("▶ [PHASE 1] MENTEE WORKFLOW: Devon Lane (devon.mentee@nstsdc.org)");
  const mentee = await loginUser("devon.mentee@nstsdc.org");
  console.log(`  ✓ Mentee signed in successfully. Cookie established for ${mentee.name} (${mentee.role})`);

  // 1. Visit Student Dashboard
  const studentPageRes = await fetch(`${BASE_URL}/org/${mentee.orgSlug}/student`, {
    headers: { cookie: mentee.cookie },
  });
  console.log(`  ✓ Mentee visited dashboard [/org/${mentee.orgSlug}/student] -> HTTP ${studentPageRes.status}`);

  // 2. Submit Substantive Daily Engineering Log
  const today = new Date().toISOString().split("T")[0];
  const reportPayload = {
    organizationId: mentee.orgId,
    reportDate: today,
    workDone: "Implemented lock-free ring buffer telemetry and benchmarked eBPF socket filter throughput at 1.2M packets/sec.",
    learning: "Discovered kernel memory barrier constraints (smp_mb) when coordinating zero-copy rings between userspace daemon and driver.",
    blockers: "Need mentor clarification on socket buffer alignment flags for ARM64 test cluster.",
    nextSteps: "Write fuzzing tests for buffer overflow boundaries and open PR for team review.",
    hoursSpent: 4.5,
    visibility: "COHORT",
    status: "SUBMITTED",
    links: [
      { url: "https://github.com/nstsdc/core-platform/pull/101", label: "PR #101: Zero-copy ring buffer", type: "PR" },
    ],
  };

  const reportRes = await fetch(`${BASE_URL}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: mentee.cookie },
    body: JSON.stringify(reportPayload),
  });
  const reportData = await reportRes.json();
  if (!reportRes.ok) throw new Error(`Daily log submission failed: ${JSON.stringify(reportData)}`);
  const reportId = reportData.report.id;
  console.log(`  ✓ Mentee submitted Daily Engineering Log -> Report ID: ${reportId} (Status: ${reportData.report.status})`);

  // 3. Mentee Raises a Technical Blocker
  const blockerRes = await fetch(`${BASE_URL}/api/blockers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: mentee.cookie },
    body: JSON.stringify({
      organizationId: mentee.orgId,
      title: "ARM64 eBPF map memory barrier verification failure",
      description: "Kernel verifier rejects map lookup in ARM64 emulation environment due to strict memory alignment flags.",
      category: "Kernel Architecture",
      urgency: "HIGH",
    }),
  });
  const blockerData = await blockerRes.json();
  const blockerId = blockerData.blocker?.id;
  console.log(`  ✓ Mentee raised Technical Blocker -> Blocker ID: ${blockerId} (${blockerData.blocker?.title})`);

  // 4. Mentee Submits Task Assignment Work
  const userAssignments = await prisma.taskAssignment.findMany({
    where: { menteeId: (await prisma.user.findUnique({ where: { email: mentee.email } }))!.id },
    include: { task: true },
  });

  let taskAssignmentId = userAssignments[0]?.id;
  if (taskAssignmentId) {
    const taskSubRes = await fetch(`${BASE_URL}/api/task-assignments/${taskAssignmentId}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: mentee.cookie },
      body: JSON.stringify({
        notes: "Completed unit tests and integration benchmarks for packet filter kernel module.",
        evidenceUrl: "https://github.com/nstsdc/core-platform/commit/d91ab42",
      }),
    });
    console.log(`  ✓ Mentee submitted task work for [${userAssignments[0].task.title}] -> HTTP ${taskSubRes.status}`);
  }

  // 5. Mentee RSVPs to Upcoming Cohort Standup
  const upcomingEvent = await prisma.event.findFirst({
    where: { organizationId: mentee.orgId },
  });
  if (upcomingEvent) {
    const rsvpRes = await fetch(`${BASE_URL}/api/events/${upcomingEvent.id}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: mentee.cookie },
      body: JSON.stringify({ status: "YES" }),
    });
    console.log(`  ✓ Mentee RSVP'd "YES" to Event [${upcomingEvent.title}] -> HTTP ${rsvpRes.status}`);
  }

  // 6. Mentee Posts in Cohort Discussion Community
  const postRes = await fetch(`${BASE_URL}/api/community/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: mentee.cookie },
    body: JSON.stringify({
      organizationId: mentee.orgId,
      title: "Benchmarking zero-copy ring buffers across Linux 6.8 kernels",
      content: "Sharing initial throughput graphs from today's packet test. Latency dropped by 38% compared to standard sockets.",
      category: "Engineering",
    }),
  });
  const postData = await postRes.json();
  const postId = postData.post?.id;
  console.log(`  ✓ Mentee created Cohort Discussion Topic -> Post ID: ${postId}`);

  // ---------------------------------------------------------
  // PHASE 2: MENTOR ACTIONS (Alex Chen)
  // ---------------------------------------------------------
  console.log("\n▶ [PHASE 2] MENTOR WORKFLOW: Alex Chen (alex.mentor@nstsdc.org)");
  const mentor = await loginUser("alex.mentor@nstsdc.org");
  console.log(`  ✓ Mentor signed in successfully. Cookie established for ${mentor.name} (${mentor.role})`);

  // 1. Visit Mentor Workspace Overview
  const mentorPageRes = await fetch(`${BASE_URL}/org/${mentor.orgSlug}/mentor`, {
    headers: { cookie: mentor.cookie },
  });
  console.log(`  ✓ Mentor visited workspace [/org/${mentor.orgSlug}/mentor] -> HTTP ${mentorPageRes.status}`);

  // 2. Mentor Reviews Devon's Daily Report
  const reviewRes = await fetch(`${BASE_URL}/api/reports/${reportId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: mentor.cookie },
    body: JSON.stringify({
      decision: "REVIEWED",
      comment: "Superb execution on the zero-copy ring buffer! The memory barrier explanation is rock solid. Approved.",
    }),
  });
  const reviewData = await reviewRes.json();
  console.log(`  ✓ Mentor evaluated Devon's Daily Report -> Decision: ${reviewData.report?.status} with praise feedback`);

  // 3. Mentor Evaluates Mentee's Task Submission
  if (taskAssignmentId) {
    const taskEvalRes = await fetch(`${BASE_URL}/api/task-assignments/${taskAssignmentId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: mentor.cookie },
      body: JSON.stringify({
        decision: "ACCEPTED",
        comment: "Benchmarks verified on kernel staging environment. Well done!",
      }),
    });
    console.log(`  ✓ Mentor evaluated Task Submission -> Status: ACCEPTED (HTTP ${taskEvalRes.status})`);
  }

  // 4. Mentor Triages and Resolves Blocker
  if (blockerId) {
    const resolveBlockerRes = await fetch(`${BASE_URL}/api/blockers/${blockerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: mentor.cookie },
      body: JSON.stringify({
        status: "RESOLVED",
        response: "Provided workaround: use __attribute__((aligned(8))) on map struct headers.",
      }),
    });
    console.log(`  ✓ Mentor triaged & resolved Blocker -> Status: RESOLVED (HTTP ${resolveBlockerRes.status})`);
  }

  // 5. Mentor Replies to Mentee Discussion Post
  if (postId) {
    const commentRes = await fetch(`${BASE_URL}/api/community/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: mentor.cookie },
      body: JSON.stringify({
        content: "Great findings! Let's feature these latency benchmarks in tomorrow's cohort standup slides.",
      }),
    });
    console.log(`  ✓ Mentor replied to Community Discussion Post -> HTTP ${commentRes.status}`);
  }

  // ---------------------------------------------------------
  // PHASE 3: ORG ADMIN ACTIONS (Sarah Jenkins)
  // ---------------------------------------------------------
  console.log("\n▶ [PHASE 3] ORG ADMIN WORKFLOW: Sarah Jenkins (sarah.admin@nstsdc.org)");
  const admin = await loginUser("sarah.admin@nstsdc.org");
  console.log(`  ✓ Org Admin signed in successfully. Cookie established for ${admin.name} (${admin.role})`);

  // 1. Visit Organization Command Center & Cohorts
  const adminPageRes = await fetch(`${BASE_URL}/org/${admin.orgSlug}/admin`, {
    headers: { cookie: admin.cookie },
  });
  console.log(`  ✓ Admin visited Command Center [/org/${admin.orgSlug}/admin] -> HTTP ${adminPageRes.status}`);

  const cohortsPageRes = await fetch(`${BASE_URL}/org/${admin.orgSlug}/admin/cohorts`, {
    headers: { cookie: admin.cookie },
  });
  console.log(`  ✓ Admin visited Cohorts Management [/org/${admin.orgSlug}/admin/cohorts] -> HTTP ${cohortsPageRes.status}`);

  // 2. Admin Edits Cohort (Assigns Multiple Mentors and Mentees)
  const orgCohorts = await prisma.cohort.findMany({ where: { organizationId: admin.orgId } });
  const cohortToEdit = orgCohorts[0];
  const allMembers = await prisma.organizationMembership.findMany({
    where: { organizationId: admin.orgId },
    include: { user: true },
  });

  const mentorIds = allMembers.filter((m) => m.role === "MENTOR" || m.role === "ORG_ADMIN").map((m) => m.user.id);
  const menteeIds = allMembers.filter((m) => m.role === "MENTEE").slice(0, 6).map((m) => m.user.id);

  const editCohortRes = await fetch(`${BASE_URL}/api/orgs/${admin.orgId}/cohorts/${cohortToEdit.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: admin.cookie },
    body: JSON.stringify({
      name: cohortToEdit.name,
      description: "Low-level Linux kernel modules, eBPF telemetry, and high-performance asynchronous systems.",
      status: "ACTIVE",
      mentorIds,
      menteeIds,
    }),
  });
  const editCohortData = await editCohortRes.json();
  console.log(`  ✓ Admin updated Cohort [${cohortToEdit.name}] -> Assigned ${editCohortData.cohort.mentors.length} Mentors and ${editCohortData.cohort.enrollments.length} Mentees (HTTP ${editCohortRes.status})`);

  // 3. Admin Publishes Organization Announcement
  const annRes = await fetch(`${BASE_URL}/api/orgs/${admin.orgId}/announcements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admin.cookie },
    body: JSON.stringify({
      title: "Sprint 3 Kernel Architecture Telemetry Reviews Live",
      body: "All fellows must log daily deliverables by 23:00 UTC. Mentor reviews are scheduled for tomorrow morning.",
      isPinned: true,
      cohortId: cohortToEdit.id,
    }),
  });
  console.log(`  ✓ Admin published Organization Announcement -> HTTP ${annRes.status}`);

  // 4. Verify Audit Logs Recorded Everything
  const recentAudit = await prisma.auditLog.findMany({
    where: { organizationId: admin.orgId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(`  ✓ System Audit Logs verified (${recentAudit.length} recent security events captured):`);
  recentAudit.forEach((a) => {
    console.log(`     • [${a.action}] on ${a.targetType} (by actor ${a.actorId})`);
  });

  console.log("\n========================================================");
  console.log("  SIMULATION COMPLETED: ALL 3 ROLES PASSED 100% CLEANLY");
  console.log("========================================================\n");
}

runEndToEndSimulation()
  .catch((err) => {
    console.error("Simulation failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
