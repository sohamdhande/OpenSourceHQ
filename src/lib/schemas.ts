import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  inviteToken: z.string().optional(),
});

export const InvitationCreateSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
  role: z.enum(["ORG_ADMIN", "MENTOR", "MENTEE", "OBSERVER"]),
  cohortId: z.string().optional().nullable(),
});

export const CohortCreateSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  timezone: z.string().default("UTC"),
  mentorIds: z.array(z.string()).optional(),
  menteeIds: z.array(z.string()).optional(),
  repositoryIds: z.array(z.string()).optional(),
});

export const CohortUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timezone: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "COMPLETED"]).optional(),
  mentorIds: z.array(z.string()).optional(),
  menteeIds: z.array(z.string()).optional(),
  repositoryIds: z.array(z.string()).optional(),
});

export const DailyReportCreateSchema = z.object({
  organizationId: z.string(),
  cohortId: z.string(),
  reportDate: z.string(), // ISO date e.g. YYYY-MM-DD
  workDone: z.string().min(5, "Work completed must be at least 5 characters"),
  learning: z.string().min(5, "Key learnings must be at least 5 characters"),
  blockers: z.string().optional().nullable(),
  nextSteps: z.string().min(5, "Next steps must be at least 5 characters"),
  hoursSpent: z.number().min(0).max(24).optional().nullable(),
  visibility: z.enum(["MENTORS_ONLY", "COHORT"]).default("MENTORS_ONLY"),
  status: z.enum(["DRAFT", "SUBMITTED", "RESUBMITTED"]).default("SUBMITTED"),
  revisionNotes: z.string().optional().nullable(),
  links: z
    .array(
      z.object({
        url: z.string().url(),
        label: z.string().min(1),
        type: z.string().default("GITHUB"),
      })
    )
    .optional(),
});

export const ReportReviewSchema = z.object({
  reportId: z.string(),
  decision: z.enum(["REVIEWED", "CHANGES_REQUESTED"]),
  comment: z.string().min(2),
});

export const TaskCreateSchema = z.object({
  organizationId: z.string(),
  cohortId: z.string().optional().nullable(),
  title: z.string().min(3),
  description: z.string().min(5),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  category: z.string().default("General"),
  repositoryId: z.string().optional().nullable(),
  externalIssueUrl: z.string().url().optional().nullable().or(z.literal("")),
  dueAt: z.string().optional().nullable(),
  acceptanceCriteria: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).default([]),
});

export const TaskSubmissionSchema = z.object({
  taskAssignmentId: z.string(),
  notes: z.string().min(3),
  evidenceUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export const TaskReviewSchema = z.object({
  taskAssignmentId: z.string(),
  decision: z.enum(["ACCEPTED", "CHANGES_REQUESTED"]),
  comment: z.string().min(2),
});

export const BlockerCreateSchema = z.object({
  organizationId: z.string(),
  cohortId: z.string().optional().nullable(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(5000),
  category: z.string().trim().min(1).max(80).default("General"),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  source: z.enum(["DAILY_REPORT", "TASK", "LEARNING_MILESTONE", "GITHUB", "GENERAL"]).default("GENERAL"),
  sourceId: z.string().trim().min(1).max(128).optional().nullable(),
}).superRefine((value, context) => {
  if (value.source !== "GENERAL" && !value.sourceId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceId"], message: "A source record is required for linked blockers." });
  }
});

export const BlockerResolveSchema = z.object({
  response: z.string().min(2),
  status: z.enum(["RESOLVED", "IN_PROGRESS", "REOPENED"]).default("RESOLVED"),
});

export const MilestoneSubmitSchema = z.object({
  evidenceUrl: z.string().url().optional().nullable().or(z.literal("")),
  notes: z.string().min(3),
});

export const MilestoneReviewSchema = z.object({
  menteeId: z.string().min(1),
  status: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const EventRsvpSchema = z.object({
  status: z.enum(["YES", "NO", "MAYBE"]),
  notes: z.string().optional().nullable(),
  isExcuseRequested: z.boolean().default(false),
  excuseReason: z.string().optional().nullable(),
});

export const FeedbackStructuredSchema = z.object({
  organizationId: z.string(),
  menteeId: z.string(),
  category: z.preprocess((val) => {
    if (typeof val === "string") {
      const u = val.trim().toUpperCase();
      if (["TECHNICAL", "COLLABORATION", "COMMUNICATION", "LEARNING", "GENERAL"].includes(u)) return u;
      if (u.includes("TECH") || u.includes("CODE")) return "TECHNICAL";
      if (u.includes("COLLAB") || u.includes("TEAM")) return "COLLABORATION";
      if (u.includes("COMM")) return "COMMUNICATION";
      if (u.includes("LEARN")) return "LEARNING";
      return "GENERAL";
    }
    return "GENERAL";
  }, z.enum(["TECHNICAL", "COLLABORATION", "COMMUNICATION", "LEARNING", "GENERAL"])).default("GENERAL"),
  content: z.string().min(5),
  technicalStrengths: z.string().optional().nullable(),
  areasForImprovement: z.string().optional().nullable(),
  codeQuality: z.string().optional().nullable(),
  communication: z.string().optional().nullable(),
  collaboration: z.string().optional().nullable(),
  problemSolving: z.string().optional().nullable(),
  consistency: z.string().optional().nullable(),
  recommendations: z.string().optional().nullable(),
  privateNotes: z.string().optional().nullable(),
  visibility: z.preprocess((val) => {
    if (typeof val === "string") {
      const u = val.trim().toUpperCase();
      if (["PRIVATE_TO_MENTEE", "PRIVATE_TO_MENTORS", "COHORT"].includes(u)) return u;
      if (u === "PRIVATE_TO_STUDENT" || u.includes("STUDENT")) return "PRIVATE_TO_MENTEE";
      if (u === "SHARED_COHORT" || u.includes("COHORT")) return "COHORT";
      if (u.includes("MENTOR")) return "PRIVATE_TO_MENTORS";
      return "PRIVATE_TO_MENTEE";
    }
    return "PRIVATE_TO_MENTEE";
  }, z.enum(["PRIVATE_TO_MENTEE", "PRIVATE_TO_MENTORS", "COHORT"])).default("PRIVATE_TO_MENTEE"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
});

export const FeedbackRespondSchema = z.object({
  // Acknowledgment without a written reply is valid; a reply is optional.
  menteeResponse: z.string().trim().max(2000).optional().default(""),
});

export const ProfileUpdateSchema = z.object({
  name: z.string().min(2),
  timezone: z.string().min(2),
});

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
});

export const MemberRoleUpdateSchema = z.object({
  role: z.enum(["ORG_ADMIN", "MENTOR", "MENTEE", "OBSERVER"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
});

export const RepositoryAddSchema = z.object({
  organizationId: z.string(),
  ownerLogin: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(3),
  url: z.string().url(),
  description: z.string().optional().nullable(),
  cohortIds: z.array(z.string()).optional(),
});

export const DiscussionPostCreateSchema = z.object({
  organizationId: z.string(),
  cohortId: z.string().optional().nullable(),
  title: z.string().min(3),
  content: z.string().min(5),
});

export const DiscussionCommentCreateSchema = z.object({
  postId: z.string(),
  parentId: z.string().optional().nullable(),
  content: z.string().min(2),
});

export const AnnouncementCreateSchema = z.object({
  organizationId: z.string(),
  cohortId: z.string().optional().nullable(),
  title: z.string().min(3),
  body: z.string().min(5),
  isPinned: z.boolean().default(false),
});

export const EventCreateSchema = z.object({
  organizationId: z.string(),
  cohortId: z.string().optional().nullable(),
  title: z.string().min(3),
  description: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  timezone: z.string().min(1).max(100).optional(),
  meetingUrl: z.string().url().optional().nullable().or(z.literal("")),
  location: z.string().optional(),
});

export const AttendanceRecordSchema = z.object({
  eventId: z.string(),
  userId: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "EXCUSED", "NOT_RECORDED"]),
  note: z.string().optional().nullable(),
});
