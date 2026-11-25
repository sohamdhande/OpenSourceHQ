import { PrismaClient, OrgRole, CohortStatus, ReportStatus, ReportVisibility, TaskPriority, TaskAssignmentStatus, TaskReviewDecision, ReportReviewDecision, GitHubActivityType, MilestoneStatus, FeedbackCategory, FeedbackVisibility, AttendanceStatus, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the destructive demo seed in production. Provision production data through an approved administrative workflow.");
  }

  console.log("Seeding OpenSourceHQ database...");

  // Clear existing records in correct relation order
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.discussionComment.deleteMany();
  await prisma.discussionPost.deleteMany();
  await prisma.eventRsvp.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.event.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.blocker.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.menteeMilestone.deleteMany();
  await prisma.learningMilestone.deleteMany();
  await prisma.learningPath.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.gitHubSyncLog.deleteMany();
  await prisma.webhookDelivery.deleteMany();
  await prisma.gitHubActivity.deleteMany();
  await prisma.userRepository.deleteMany();
  await prisma.repositorySuggestion.deleteMany();
  await prisma.cohortRepository.deleteMany();
  await prisma.taskReview.deleteMany();
  await prisma.taskSubmission.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.gitHubInstallation.deleteMany();
  await prisma.gitHubAccount.deleteMany();
  await prisma.reportReview.deleteMany();
  await prisma.reportLink.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.cohortEnrollment.deleteMany();
  await prisma.cohortMentor.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.platformRole.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // 1. Create Users
  // Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      name: "Global Admin",
      email: "admin@opensourcehq.local",
      passwordHash: defaultPasswordHash,
      timezone: "UTC",
      status: UserStatus.ACTIVE,
      platformRole: {
        create: {
          role: "SUPER_ADMIN",
        },
      },
    },
  });

  // Org Admin
  const orgAdmin = await prisma.user.create({
    data: {
      name: "Sarah Jenkins",
      email: "sarah.admin@nstsdc.org",
      passwordHash: defaultPasswordHash,
      timezone: "America/New_York",
      status: UserStatus.ACTIVE,
    },
  });

  // Mentors
  const mentor1 = await prisma.user.create({
    data: {
      name: "Alex Chen",
      email: "alex.mentor@nstsdc.org",
      passwordHash: defaultPasswordHash,
      timezone: "America/Los_Angeles",
      status: UserStatus.ACTIVE,
    },
  });

  const mentor2 = await prisma.user.create({
    data: {
      name: "Maria Rodriguez",
      email: "maria.mentor@nstsdc.org",
      passwordHash: defaultPasswordHash,
      timezone: "Europe/Madrid",
      status: UserStatus.ACTIVE,
    },
  });

  // 8+ Mentees
  const menteeData = [
    { name: "Devon Lane", email: "devon.mentee@nstsdc.org", gh: "devonlane" },
    { name: "Kavita Sharma", email: "kavita.mentee@nstsdc.org", gh: "kavitasharma" },
    { name: "Liam O'Connor", email: "liam.mentee@nstsdc.org", gh: "liamoconnor" },
    { name: "Aisha Patel", email: "aisha.mentee@nstsdc.org", gh: "aishapatel" },
    { name: "Jordan Hayes", email: "jordan.mentee@nstsdc.org", gh: "jordanhayes" },
    { name: "Elena Rostova", email: "elena.mentee@nstsdc.org", gh: "elenarostova" },
    { name: "Marcus Vance", email: "marcus.mentee@nstsdc.org", gh: "marcusvance" },
    { name: "Ananya Rao", email: "ananya.mentee@nstsdc.org", gh: "ananyarao" },
  ];

  const mentees = [];
  for (const m of menteeData) {
    const user = await prisma.user.create({
      data: {
        name: m.name,
        email: m.email,
        passwordHash: defaultPasswordHash,
        timezone: "UTC",
        status: UserStatus.ACTIVE,
        githubAccounts: {
          create: {
            providerUserId: `gh_${m.gh}`,
            username: m.gh,
            profileUrl: `https://github.com/${m.gh}`,
            avatarUrl: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 1000000)}?v=4`,
            connectionStatus: "CONNECTED",
          },
        },
      },
      include: {
        githubAccounts: true,
      },
    });
    mentees.push(user);
  }

  // 2. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: "NSTSDC",
      slug: "nstsdc",
      description: "Open Source Infrastructure & Systems Mentorship Organization",
      timezone: "UTC",
      settings: {
        dailyReportCutoffHour: 23,
        autoShareReports: false,
        requireReviewBeforeNextReport: false,
      },
    },
  });

  // Assign Organization Memberships
  await prisma.organizationMembership.createMany({
    data: [
      { organizationId: org.id, userId: orgAdmin.id, role: OrgRole.ORG_ADMIN },
      { organizationId: org.id, userId: mentor1.id, role: OrgRole.MENTOR },
      { organizationId: org.id, userId: mentor2.id, role: OrgRole.MENTOR },
      ...mentees.map((m) => ({
        organizationId: org.id,
        userId: m.id,
        role: OrgRole.MENTOR ? OrgRole.MENTEE : OrgRole.MENTEE,
      })),
    ],
  });

  // 3. Create Cohorts
  const cohort1 = await prisma.cohort.create({
    data: {
      organizationId: org.id,
      name: "Fall 2026 Kernel & Systems",
      slug: "fall-2026-systems",
      description: "Low-level Linux kernel modules, eBPF telemetry, and high-performance I/O.",
      startDate: new Date("2026-09-01T00:00:00Z"),
      endDate: new Date("2026-12-15T00:00:00Z"),
      status: CohortStatus.ACTIVE,
      createdById: orgAdmin.id,
    },
  });

  const cohort2 = await prisma.cohort.create({
    data: {
      organizationId: org.id,
      name: "Winter 2026 Cloud & Web Tooling",
      slug: "winter-2026-tooling",
      description: "Distributed cache architectures, developer toolchains, and protocol buffers.",
      startDate: new Date("2026-10-15T00:00:00Z"),
      endDate: new Date("2027-01-31T00:00:00Z"),
      status: CohortStatus.ACTIVE,
      createdById: orgAdmin.id,
    },
  });

  // Assign Mentors to Cohorts
  await prisma.cohortMentor.createMany({
    data: [
      { cohortId: cohort1.id, mentorId: mentor1.id },
      { cohortId: cohort1.id, mentorId: mentor2.id },
      { cohortId: cohort2.id, mentorId: mentor1.id },
    ],
  });

  // Enroll Mentees: First 4 into Cohort 1, Next 4 into Cohort 2
  for (let i = 0; i < 4; i++) {
    await prisma.cohortEnrollment.create({
      data: {
        cohortId: cohort1.id,
        menteeId: mentees[i].id,
        status: "ACTIVE",
      },
    });
  }
  for (let i = 4; i < 8; i++) {
    await prisma.cohortEnrollment.create({
      data: {
        cohortId: cohort2.id,
        menteeId: mentees[i].id,
        status: "ACTIVE",
      },
    });
  }

  // 4. Create Tracked Repositories (real open-source repositories)
  const repo1 = await prisma.repository.create({
    data: {
      organizationId: org.id,
      provider: "GITHUB",
      providerRepositoryId: "repo_openmrs_core",
      ownerLogin: "openmrs",
      name: "openmrs-core",
      fullName: "openmrs/openmrs-core",
      url: "https://github.com/openmrs/openmrs-core",
      description: "OpenMRS core medical record system API and business service layer",
      syncStatus: "ACTIVE",
      lastSyncedAt: new Date(),
    },
  });

  const repo2 = await prisma.repository.create({
    data: {
      organizationId: org.id,
      provider: "GITHUB",
      providerRepositoryId: "repo_facebook_react",
      ownerLogin: "facebook",
      name: "react",
      fullName: "facebook/react",
      url: "https://github.com/facebook/react",
      description: "The library for web and native user interfaces",
      syncStatus: "ACTIVE",
      lastSyncedAt: new Date(),
    },
  });

  const repo3 = await prisma.repository.create({
    data: {
      organizationId: org.id,
      provider: "GITHUB",
      providerRepositoryId: "repo_vercel_nextjs",
      ownerLogin: "vercel",
      name: "next.js",
      fullName: "vercel/next.js",
      url: "https://github.com/vercel/next.js",
      description: "The React Framework for the Web",
      syncStatus: "ACTIVE",
      lastSyncedAt: new Date(),
    },
  });

  // Associate Repositories with Cohorts
  await prisma.cohortRepository.createMany({
    data: [
      { cohortId: cohort1.id, repositoryId: repo1.id, addedById: orgAdmin.id },
      { cohortId: cohort1.id, repositoryId: repo2.id, addedById: orgAdmin.id },
      { cohortId: cohort2.id, repositoryId: repo2.id, addedById: orgAdmin.id },
      { cohortId: cohort2.id, repositoryId: repo3.id, addedById: orgAdmin.id },
    ],
  });

  // 4b. Seed Mentee Repositories (self-chosen & mentor-assigned)
  await prisma.userRepository.createMany({
    data: [
      {
        organizationId: org.id,
        userId: mentees[0].id,
        repositoryId: repo1.id,
        assignedById: null, // Self-chosen by Devon
        isPrimary: true,
        notes: null,
      },
      {
        organizationId: org.id,
        userId: mentees[0].id,
        repositoryId: repo2.id,
        assignedById: mentor1.id, // Assigned by mentor Alex
        isPrimary: false,
        notes: "Focus on database optimization PRs and schema documentation.",
      },
    ],
  });

  // 5. Create Daily Reports with varied statuses
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Devon's reports
  const rep1 = await prisma.dailyReport.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      menteeId: mentees[0].id,
      reportDate: twoDaysAgo,
      workDone: "Investigated eBPF map memory leaks in socket buffer filter and wrote reproducible test cases.",
      learning: "Learned how BPF verifier guarantees bounded loops and validates pointer arithmetic.",
      blockers: null,
      nextSteps: "Submit upstream pull request with memory barrier fix.",
      hoursSpent: 5.5,
      visibility: ReportVisibility.COHORT,
      status: ReportStatus.REVIEWED,
      submittedAt: twoDaysAgo,
      links: {
        create: [
          { url: "https://github.com/nstsdc/hyper-kernel/pull/42", label: "PR #42: Fix socket buffer memory barrier", type: "PR" },
        ],
      },
      reviews: {
        create: [
          {
            reviewerId: mentor1.id,
            status: ReportReviewDecision.REVIEWED,
            comment: "Excellent analysis on the BPF verifier constraints. Verified the benchmark graph looks clean.",
          },
        ],
      },
    },
  });

  const rep2 = await prisma.dailyReport.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      menteeId: mentees[0].id,
      reportDate: yesterday,
      workDone: "Drafted ring buffer event producer benchmarks and measured throughput across 16 vCPUs.",
      learning: "Lock contention increases sharply after 8 concurrent producers; batching updates is required.",
      blockers: "Need mentor guidance on choosing between spinlock vs lock-free CAS ring buffer.",
      nextSteps: "Run flamegraph profiling during 100k msg/s benchmark.",
      hoursSpent: 6.0,
      visibility: ReportVisibility.MENTORS_ONLY,
      status: ReportStatus.CHANGES_REQUESTED,
      submittedAt: yesterday,
      reviews: {
        create: [
          {
            reviewerId: mentor1.id,
            status: ReportReviewDecision.CHANGES_REQUESTED,
            comment: "Please attach the flamegraph perf data and benchmark raw numbers before we merge the changes.",
          },
        ],
      },
    },
  });

  // Kavita's report (Submitted, awaiting review)
  await prisma.dailyReport.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      menteeId: mentees[1].id,
      reportDate: yesterday,
      workDone: "Implemented zero-copy TCP receive ring buffer adapter.",
      learning: "Understanding sk_buff lifetime management across kernel/userspace boundary.",
      blockers: null,
      nextSteps: "Add stress tests under packet drop simulation.",
      hoursSpent: 4.5,
      visibility: ReportVisibility.COHORT,
      status: ReportStatus.SUBMITTED,
      submittedAt: yesterday,
      links: {
        create: [
          { url: "https://github.com/nstsdc/hyper-kernel/commit/a8f9c12", label: "commit a8f9c12: add zero-copy ring", type: "COMMIT" },
        ],
      },
    },
  });

  // Jordan's report in Cohort 2 (Draft)
  await prisma.dailyReport.create({
    data: {
      organizationId: org.id,
      cohortId: cohort2.id,
      menteeId: mentees[4].id,
      reportDate: today,
      workDone: "Setting up consistent hashing ring prototype with 256 virtual nodes.",
      learning: "MurmurHash3 distribution properties for node balance.",
      blockers: "Understanding replica node handover protocol on split-brain scenarios.",
      nextSteps: "Complete gossip failure detector node heartbeat loop.",
      hoursSpent: 3.5,
      visibility: ReportVisibility.MENTORS_ONLY,
      status: ReportStatus.DRAFT,
      submittedAt: null,
    },
  });

  // 6. Create Tasks and Assignments
  const task1 = await prisma.task.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      title: "Implement eBPF Socket Filter Tracing",
      description: "Write an eBPF program that monitors TCP connect latency and aggregates percentiles into a BPF histogram map.",
      priority: TaskPriority.HIGH,
      category: "Kernel / eBPF",
      createdById: mentor1.id,
      repositoryId: repo1.id,
      externalIssueUrl: "https://github.com/nstsdc/hyper-kernel/issues/12",
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
    },
  });

  const task2 = await prisma.task.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      title: "Add Static Analysis Rule for OpenMRS Validation",
      description: "Extend openmrs-core visit handler to validate encounters during REST submission.",
      priority: TaskPriority.NORMAL,
      category: "Developer Tooling",
      createdById: mentor2.id,
      repositoryId: repo2.id,
      externalIssueUrl: "https://github.com/openmrs/openmrs-core/issues/5",
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
    },
  });

  const task3 = await prisma.task.create({
    data: {
      organizationId: org.id,
      cohortId: cohort2.id,
      title: "Build Distributed Hash Ring Gossip Protocol",
      description: "Implement SWIM gossip protocol for membership discovery and node heartbeat health check in distributed-cache.",
      priority: TaskPriority.URGENT,
      category: "Distributed Systems",
      createdById: mentor1.id,
      repositoryId: repo3.id,
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    },
  });

  // Task Assignments
  const assign1 = await prisma.taskAssignment.create({
    data: {
      taskId: task1.id,
      menteeId: mentees[0].id,
      status: TaskAssignmentStatus.COMPLETED,
      assignedById: mentor1.id,
      completedAt: new Date(),
      submissions: {
        create: {
          submittedById: mentees[0].id,
          notes: "Finished the BPF histogram filter. Benchmarks show <1% CPU overhead at 50,000 req/sec.",
          evidenceUrl: "https://github.com/nstsdc/hyper-kernel/pull/42",
        },
      },
      reviews: {
        create: {
          reviewerId: mentor1.id,
          decision: TaskReviewDecision.ACCEPTED,
          comment: "Outstanding work! Code is clean, well-commented and passed all automated CI tests.",
        },
      },
    },
  });

  const assign2 = await prisma.taskAssignment.create({
    data: {
      taskId: task1.id,
      menteeId: mentees[1].id,
      status: TaskAssignmentStatus.IN_PROGRESS,
      assignedById: mentor1.id,
    },
  });

  const assign3 = await prisma.taskAssignment.create({
    data: {
      taskId: task2.id,
      menteeId: mentees[2].id,
      status: TaskAssignmentStatus.SUBMITTED,
      assignedById: mentor2.id,
      submissions: {
        create: {
          submittedById: mentees[2].id,
          notes: "Implemented AST check for pthread_mutex_lock. Handled both POSIX and C++11 std::unique_lock cases.",
          evidenceUrl: "https://github.com/openmrs/openmrs-core/pull/18",
        },
      },
    },
  });

  await prisma.taskAssignment.create({
    data: {
      taskId: task3.id,
      menteeId: mentees[4].id,
      status: TaskAssignmentStatus.IN_PROGRESS,
      assignedById: mentor1.id,
    },
  });

  // 7. Labeled GitHub Fixture Activities (isFixture: true)
  const ghAccount0 = mentees[0].githubAccounts[0];
  const ghAccount1 = mentees[1].githubAccounts[0];
  const ghAccount4 = mentees[4].githubAccounts[0];

  await prisma.gitHubActivity.createMany({
    data: [
      {
        organizationId: org.id,
        repositoryId: repo1.id,
        githubAccountId: ghAccount0.id,
        providerEventId: "evt_fix_101",
        activityType: GitHubActivityType.PULL_REQUEST_OPENED,
        title: "PR #42: Fix socket buffer memory barrier and ring buffer drops",
        summary: "Addresses race condition when kernel worker thread preempts socket dequeue.",
        url: "https://github.com/nstsdc/hyper-kernel/pull/42",
        isFixture: true,
        occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
      },
      {
        organizationId: org.id,
        repositoryId: repo1.id,
        githubAccountId: ghAccount0.id,
        providerEventId: "evt_fix_102",
        activityType: GitHubActivityType.PULL_REQUEST_MERGED,
        title: "PR #42 Merged into nstsdc/hyper-kernel:main",
        summary: "Merged by maintainer Alex Chen after passing CI suite.",
        url: "https://github.com/nstsdc/hyper-kernel/pull/42",
        isFixture: true,
        occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
      {
        organizationId: org.id,
        repositoryId: repo1.id,
        githubAccountId: ghAccount1.id,
        providerEventId: "evt_fix_103",
        activityType: GitHubActivityType.COMMIT,
        title: "commit a8f9c12: add zero-copy ring buffer adapter",
        summary: "Implements ring buffer wrapper using mmap zero-copy technique.",
        url: "https://github.com/nstsdc/hyper-kernel/commit/a8f9c12",
        isFixture: true,
        occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
      },
      {
        organizationId: org.id,
        repositoryId: repo3.id,
        githubAccountId: ghAccount4.id,
        providerEventId: "evt_fix_104",
        activityType: GitHubActivityType.ISSUE_OPENED,
        title: "Issue #24: High latency tail during node partition recovery",
        summary: "Raft consensus election timeouts cause 200ms spike during network partition.",
        url: "https://github.com/nstsdc/distributed-cache/issues/24",
        isFixture: true,
        occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      },
    ],
  });

  // 8. Learning Paths & Milestones
  const skill1 = await prisma.skill.create({
    data: {
      organizationId: org.id,
      name: "eBPF & Kernel Tracing",
      category: "Systems",
    },
  });

  const skill2 = await prisma.skill.create({
    data: {
      organizationId: org.id,
      name: "Distributed Consensus & Raft",
      category: "Architecture",
    },
  });

  const path1 = await prisma.learningPath.create({
    data: {
      organizationId: org.id,
      title: "Linux Kernel Systems Mastery",
      description: "From user-space syscalls to in-kernel eBPF packet filters and concurrency primitives.",
      createdById: orgAdmin.id,
    },
  });

  const milestone1 = await prisma.learningMilestone.create({
    data: {
      learningPathId: path1.id,
      title: "Milestone 1: Kernel Compilation & Custom Module Loading",
      description: "Build a custom Linux kernel from source, boot in QEMU, and load a character device driver.",
      sortOrder: 1,
      skillId: skill1.id,
    },
  });

  const milestone2 = await prisma.learningMilestone.create({
    data: {
      learningPathId: path1.id,
      title: "Milestone 2: High-Performance eBPF Program",
      description: "Write and attach a kprobe/xdp eBPF program with userspace ring buffer consumer.",
      sortOrder: 2,
      skillId: skill1.id,
    },
  });

  // Mentee milestones
  await prisma.menteeMilestone.create({
    data: {
      menteeId: mentees[0].id,
      milestoneId: milestone1.id,
      status: MilestoneStatus.APPROVED,
      evidenceUrl: "https://github.com/devonlane/kernel-lab-qemu",
      notes: "Booted custom 6.8 kernel in QEMU with virtio network.",
      reviewedById: mentor1.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.menteeMilestone.create({
    data: {
      menteeId: mentees[0].id,
      milestoneId: milestone2.id,
      status: MilestoneStatus.IN_PROGRESS,
      notes: "Currently working on attaching XDP program to virtual interface.",
    },
  });

  // 9. Feedback
  await prisma.feedback.create({
    data: {
      organizationId: org.id,
      menteeId: mentees[0].id,
      authorId: mentor1.id,
      category: FeedbackCategory.TECHNICAL,
      content: "Devon has shown an exceptional grasp of low-level systems programming. His attention to concurrency edge cases in the eBPF socket buffer PR was on par with senior maintainers.",
      visibility: FeedbackVisibility.PRIVATE_TO_MENTEE,
      acknowledgedAt: new Date(),
    },
  });

  await prisma.feedback.create({
    data: {
      organizationId: org.id,
      menteeId: mentees[1].id,
      authorId: mentor2.id,
      category: FeedbackCategory.COLLABORATION,
      content: "Kavita communicated proactively during cohort standups and helped teammates debug linker errors during cross-compilation.",
      visibility: FeedbackVisibility.PRIVATE_TO_MENTEE,
    },
  });

  // 10. Announcements
  await prisma.announcement.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      authorId: mentor1.id,
      title: "Guest Tech Talk: eBPF in Production at Scale",
      body: "Join us this Thursday at 5 PM UTC for a live tech talk with upstream kernel contributors discussing eBPF observability architectures.",
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
  });

  await prisma.announcement.create({
    data: {
      organizationId: org.id,
      authorId: orgAdmin.id,
      title: "Welcome to OpenSourceHQ 2026 Cohorts!",
      body: "We are thrilled to kick off our new mentorship programs. Make sure to complete your profile and link your GitHub account.",
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    },
  });

  // 11. Events and Attendance
  const syncEvent = await prisma.event.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      title: "Weekly Systems Cohort Sync",
      description: "Review blockers, PR progress, and live code review of open PRs.",
      startsAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
      endsAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
      timezone: "UTC",
      meetingUrl: "https://meet.jit.si/oshq-systems-sync",
      location: "Virtual",
      createdById: mentor1.id,
    },
  });

  await prisma.attendance.createMany({
    data: [
      { eventId: syncEvent.id, userId: mentees[0].id, status: AttendanceStatus.PRESENT, recordedById: mentor1.id },
      { eventId: syncEvent.id, userId: mentees[1].id, status: AttendanceStatus.PRESENT, recordedById: mentor1.id },
      { eventId: syncEvent.id, userId: mentees[2].id, status: AttendanceStatus.EXCUSED, note: "University exam", recordedById: mentor1.id },
      { eventId: syncEvent.id, userId: mentees[3].id, status: AttendanceStatus.ABSENT, recordedById: mentor1.id },
    ],
  });

  // 12. Community Discussions
  const post = await prisma.discussionPost.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      authorId: mentees[0].id,
      title: "Recommended resources for understanding Linux RCU (Read-Copy-Update)?",
      content: "I am reading through kernel Documentation/RCU/ and finding memory ordering diagrams a bit tricky. Does anyone have good visualizations or article recommendations?",
      isPinned: true,
      comments: {
        create: [
          {
            authorId: mentor1.id,
            content: "Paul McKenney's 'Is Parallel Programming Hard, And, If So, What Can You Do About It?' (Perfbook) chapter 9 is the canonical reference. Start there!",
          },
          {
            authorId: mentees[1].id,
            content: "Thanks for asking this Devon, the Perfbook diagrams helped me understand grace periods immensely.",
          },
        ],
      },
    },
  });

  // 12b. Blockers
  await prisma.blocker.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      menteeId: mentees[0].id,
      mentorId: mentor1.id,
      title: "eBPF map memory barrier race condition on ARM64 cross-compile",
      description: "When compiling hyper-kernel for aarch64 on x86_64 runner, memory barriers expand to dmb ishld instead of dmb sy, causing socket filter verifier rejection.",
      category: "Compiler / Architecture",
      urgency: "HIGH",
      status: "OPEN",
      source: "TASK",
      sourceId: task1.id,
    },
  });

  await prisma.blocker.create({
    data: {
      organizationId: org.id,
      cohortId: cohort1.id,
      menteeId: mentees[1].id,
      mentorId: mentor1.id,
      title: "Local QEMU TAP networking bridge permission issue",
      description: "Cannot allocate tap0 interface without sudo password on university development VM.",
      category: "Environment",
      urgency: "MEDIUM",
      status: "RESOLVED",
      source: "GENERAL",
      response: "Configured user in /etc/sudoers.d/tap-net to allow ip tuntap add mode tap tap0 without password.",
      firstRespondedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    },
  });

  // 12c. Event RSVPs
  await prisma.eventRsvp.createMany({
    data: [
      { eventId: syncEvent.id, userId: mentees[0].id, status: "YES" },
      { eventId: syncEvent.id, userId: mentees[1].id, status: "YES" },
      { eventId: syncEvent.id, userId: mentees[2].id, status: "NO", isExcuseRequested: true, excuseReason: "Midterm University Exam" },
    ],
  });

  // 13. Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        actorId: orgAdmin.id,
        action: "COHORT_CREATED",
        targetType: "Cohort",
        targetId: cohort1.id,
        metadata: { name: cohort1.name, slug: cohort1.slug },
      },
      {
        organizationId: org.id,
        actorId: orgAdmin.id,
        action: "MENTOR_ASSIGNED",
        targetType: "CohortMentor",
        targetId: mentor1.id,
        metadata: { cohortId: cohort1.id, mentorName: mentor1.name },
      },
      {
        organizationId: org.id,
        actorId: mentor1.id,
        action: "REPORT_REVIEWED",
        targetType: "DailyReport",
        targetId: rep1.id,
        metadata: { decision: "REVIEWED" },
      },
    ],
  });

  console.log("Database seeded successfully!");
  console.log("Demo Accounts (all passwords: password123):");
  console.log("- Super Admin: admin@opensourcehq.local");
  console.log("- Org Admin:   sarah.admin@nstsdc.org");
  console.log("- Mentor 1:    alex.mentor@nstsdc.org");
  console.log("- Mentor 2:    maria.mentor@nstsdc.org");
  console.log("- Mentee 1:    devon.mentee@nstsdc.org");
  console.log("- Mentee 2:    kavita.mentee@nstsdc.org");
  console.log("- Mentee 5:    jordan.mentee@nstsdc.org (Cohort 2)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

