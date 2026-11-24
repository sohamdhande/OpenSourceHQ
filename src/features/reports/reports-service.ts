import { formatDate } from "@/lib/date";
import prisma from "@/lib/db";
import { ReportStatus, ReportVisibility, ReportReviewDecision } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { canReviewReport, canViewReport } from "@/server/authorization/policies";
import { SessionUser } from "@/server/auth/session";

export interface CreateReportInput {
  organizationId: string;
  cohortId: string;
  menteeId: string;
  reportDate: string | Date;
  workDone: string;
  learning: string;
  blockers?: string | null;
  nextSteps: string;
  hoursSpent?: number | null;
  visibility?: ReportVisibility;
  status?: ReportStatus;
  revisionNotes?: string | null;
  links?: { url: string; label: string; type?: string }[];
}

export async function submitDailyReport(user: SessionUser, input: CreateReportInput) {
  // A report date is a calendar date, not a browser-local instant.
  if (typeof input.reportDate === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(input.reportDate)) {
    throw new Error("Report date must use YYYY-MM-DD format.");
  }
  const parsedDate = new Date(input.reportDate);
  if (Number.isNaN(parsedDate.getTime())) throw new Error("Report date is invalid.");
  parsedDate.setUTCHours(0, 0, 0, 0);
  if (input.hoursSpent != null && (!Number.isFinite(input.hoursSpent) || input.hoursSpent < 0 || input.hoursSpent > 24)) {
    throw new Error("Hours spent must be between 0 and 24.");
  }

  if (user.id !== input.menteeId) throw new Error("Only a mentee can submit their own report.");
  const [membership, cohort] = await Promise.all([
    prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: input.organizationId, userId: user.id } } }),
    prisma.cohort.findUnique({ where: { id: input.cohortId }, select: { organizationId: true, status: true } }),
  ]);
  if (membership?.status !== "ACTIVE" || membership.role !== "MENTEE") {
    throw new Error("An active mentee organization membership is required to submit a daily report.");
  }
  if (!cohort || cohort.organizationId !== input.organizationId || cohort.status !== "ACTIVE") throw new Error("Select an active cohort in this organization to submit a report.");

  const enrollment = await prisma.cohortEnrollment.findUnique({
    where: { cohortId_menteeId: { cohortId: input.cohortId, menteeId: user.id } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") throw new Error("You are not actively enrolled in this cohort.");

  const uniqueKey = { cohortId: input.cohortId, menteeId: user.id, reportDate: parsedDate };
  const requestedStatus = input.status ?? ReportStatus.SUBMITTED;
  if (!([ReportStatus.DRAFT, ReportStatus.SUBMITTED, ReportStatus.RESUBMITTED] as ReportStatus[]).includes(requestedStatus)) {
    throw new Error("Mentees may only save drafts, submit reports, or resubmit reports after requested changes.");
  }
  if (requestedStatus === ReportStatus.RESUBMITTED && (input.revisionNotes?.trim().length ?? 0) < 5) {
    throw new Error("Add at least five characters explaining the revisions before resubmitting.");
  }

  // Re-read and transition the report inside a serializable transaction. This
  // prevents a concurrent mentor review and mentee save from overwriting each
  // other's status transition.
  const { report, nextStatus } = await prisma.$transaction(async (tx) => {
    const existing = await tx.dailyReport.findUnique({ where: { cohortId_menteeId_reportDate: uniqueKey } });
    if (existing && existing.organizationId !== input.organizationId) {
      throw new Error("Report organization does not match the selected cohort.");
    }
    if (existing && !([ReportStatus.DRAFT, ReportStatus.CHANGES_REQUESTED] as ReportStatus[]).includes(existing.status)) {
      throw new Error("This report has already been submitted for review. Create or edit a report only while it is a draft or changes have been requested.");
    }
    if (!existing && requestedStatus === ReportStatus.RESUBMITTED) {
      throw new Error("A new report cannot be marked as a resubmission.");
    }
    if (existing?.status === ReportStatus.DRAFT && requestedStatus === ReportStatus.RESUBMITTED) {
      throw new Error("Only a report with requested changes can be resubmitted.");
    }
    if (existing?.status === ReportStatus.CHANGES_REQUESTED && requestedStatus === ReportStatus.SUBMITTED) {
      throw new Error("Use the resubmit action after addressing mentor feedback.");
    }

    const nextStatus = existing?.status === ReportStatus.CHANGES_REQUESTED && requestedStatus === ReportStatus.DRAFT
      ? ReportStatus.CHANGES_REQUESTED
      : requestedStatus;
    const isBeingSubmitted = nextStatus === ReportStatus.SUBMITTED || nextStatus === ReportStatus.RESUBMITTED;
    const reportData = {
      workDone: input.workDone.trim(),
      learning: input.learning.trim(),
      blockers: input.blockers?.trim() || null,
      nextSteps: input.nextSteps.trim(),
      hoursSpent: input.hoursSpent,
      visibility: input.visibility ?? ReportVisibility.MENTORS_ONLY,
      status: nextStatus,
      submittedAt: isBeingSubmitted ? new Date() : existing?.submittedAt ?? null,
      revisionNotes: nextStatus === ReportStatus.RESUBMITTED ? input.revisionNotes?.trim() || null : null,
    };
    const links = input.links?.map((link) => ({ url: link.url, label: link.label.trim(), type: link.type || "GITHUB" })) || [];

    let saved;
    if (existing) {
      const guarded = await tx.dailyReport.updateMany({
        where: { id: existing.id, status: existing.status },
        data: reportData,
      });
      if (guarded.count !== 1) throw new Error("The report status changed. Refresh and try again.");
      saved = await tx.dailyReport.update({
        where: { id: existing.id },
        data: { links: { deleteMany: {}, ...(links.length ? { create: links } : {}) } },
        include: { links: true, reviews: true },
      });
    } else {
      saved = await tx.dailyReport.create({
        data: {
          organizationId: input.organizationId,
          cohortId: input.cohortId,
          menteeId: user.id,
          reportDate: parsedDate,
          ...reportData,
          links: links.length ? { create: links } : undefined,
        },
        include: { links: true, reviews: true },
      });
    }
    return { report: saved, nextStatus };
  }, { isolationLevel: "Serializable" });

  await logAudit({
    organizationId: input.organizationId,
    actorId: user.id,
    action: nextStatus === ReportStatus.DRAFT ? "REPORT_DRAFT_SAVED" : nextStatus === ReportStatus.RESUBMITTED ? "REPORT_RESUBMITTED" : "REPORT_SUBMITTED",
    targetType: "DailyReport",
    targetId: report.id,
    metadata: { cohortId: input.cohortId, reportDate: parsedDate.toISOString(), status: report.status },
  });
  return report;
}

export async function reviewDailyReport(
  user: SessionUser,
  reportId: string,
  decision: ReportReviewDecision,
  comment: string
) {
  const allowed = await canReviewReport(user, reportId);
  if (!allowed) throw new Error("Unauthorized to review this report");
  if (!comment.trim()) throw new Error("A review comment is required.");

  const newStatus = decision === "REVIEWED" ? ReportStatus.REVIEWED : ReportStatus.CHANGES_REQUESTED;
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.dailyReport.findUnique({ where: { id: reportId } });
    if (!current) throw new Error("Report not found.");
    const eligibleStatuses: ReportStatus[] = [ReportStatus.SUBMITTED, ReportStatus.RESUBMITTED, ReportStatus.UNDER_REVIEW];
    if (!eligibleStatuses.includes(current.status)) throw new Error("Only submitted reports can be reviewed. This report may already have been reviewed.");
    const guarded = await tx.dailyReport.updateMany({
      where: { id: reportId, status: { in: eligibleStatuses } },
      data: { status: newStatus },
    });
    if (guarded.count !== 1) throw new Error("The report status changed. Refresh and try again.");
    const review = await tx.reportReview.create({
      data: { reportId, reviewerId: user.id, status: decision, comment: comment.trim() },
    });
    const report = await tx.dailyReport.findUniqueOrThrow({
      where: { id: reportId },
      include: { mentee: { select: { id: true, name: true, email: true, imageUrl: true } }, cohort: { select: { id: true, name: true, slug: true } }, organization: { select: { slug: true } } },
    });
    return { review, report };
  });

  await prisma.notification.create({
    data: {
      organizationId: result.report.organizationId,
      userId: result.report.menteeId,
      type: "REPORT_REVIEWED",
      title: decision === "REVIEWED" ? "Report Reviewed" : "Changes Requested on Report",
      body: `${user.name} reviewed your report for ${formatDate(result.report.reportDate)}: "${comment.trim().substring(0, 80)}"`,
      targetUrl: `/org/${result.report.organization.slug}/student/reports`,
    },
  });

  await logAudit({
    organizationId: result.report.organizationId,
    actorId: user.id,
    action: "REPORT_REVIEWED",
    targetType: "DailyReport",
    targetId: reportId,
    metadata: { decision, status: newStatus },
  });
  return result;
}

export async function getDailyReport(user: SessionUser, reportId: string) {
  const allowed = await canViewReport(user, reportId);
  if (!allowed) {
    throw new Error("Unauthorized to view this report");
  }

  return prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: {
      mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
      cohort: { select: { id: true, name: true, slug: true } },
      links: true,
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

