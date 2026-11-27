import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { submitDailyReport, submitSelfTrackedReport } from "@/features/reports/reports-service";
import { DailyReportCreateSchema, SelfTrackedReportCreateSchema } from "@/lib/schemas";
import { canUseSelfTracking } from "@/server/authorization/policies";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId") || session.activeOrgId;
  const cohortId = searchParams.get("cohortId");
  const menteeId = searchParams.get("menteeId");
  const status = searchParams.get("status");
  const reportDate = searchParams.get("reportDate");
  const mode = searchParams.get("mode");

  if (!organizationId) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "organizationId required" } }, { status: 400 });
  }

  if (mode === "self") {
    const canSelfTrack = await canUseSelfTracking(session, organizationId);
    if (!canSelfTrack) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Self-tracking is not enabled for this organization." } }, { status: 403 });
    }
    const selfWhere: Record<string, unknown> = {
      organizationId,
      menteeId: session.id,
      cohortId: null,
      isSelfTracked: true,
    };
    if (status) selfWhere.status = status;
    if (reportDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
        return NextResponse.json({ error: { code: "INVALID_REPORT_DATE", message: "Report date must use YYYY-MM-DD format." } }, { status: 400 });
      }
      const exactDate = new Date(`${reportDate}T00:00:00.000Z`);
      if (Number.isNaN(exactDate.getTime()) || exactDate.toISOString().slice(0, 10) !== reportDate) {
        return NextResponse.json({ error: { code: "INVALID_REPORT_DATE", message: "Enter a valid calendar date." } }, { status: 400 });
      }
      selfWhere.reportDate = exactDate;
    }

    const reports = await prisma.dailyReport.findMany({
      where: selfWhere,
      include: { links: true },
      orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
      ...(reportDate ? {} : { take: 100 }),
    });
    return NextResponse.json({ reports });
  }

  // Multi-tenant check
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.id } },
  });

  if ((!membership || membership.status !== "ACTIVE") && !session.isPlatformSuperAdmin) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Access denied to organization" } }, { status: 403 });
  }

  // Mentee role can only list own reports + cohort-shared reports in their enrolled cohort
  let whereClause: any = { organizationId, isSelfTracked: false };

  if (cohortId) whereClause.cohortId = cohortId;
  if (status) whereClause.status = status;
  if (membership?.role !== "MENTEE" && status === "DRAFT") {
    return NextResponse.json({ error: { code: "DRAFT_PRIVATE", message: "Draft reports are visible only to their author until submitted." } }, { status: 403 });
  }

  if (membership?.role === "MENTEE") {
    if (menteeId && menteeId !== session.id) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Mentees can only retrieve their own reports." } }, { status: 403 });
    }
    const enrollments = await prisma.cohortEnrollment.findMany({
      where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } },
      select: { cohortId: true },
    });
    const cohortIds = enrollments.map((item) => item.cohortId);
    if (cohortId && !cohortIds.includes(cohortId)) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not enrolled in this cohort" } }, { status: 403 });
    }
    if (menteeId === session.id) {
      whereClause.menteeId = session.id;
      if (reportDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return NextResponse.json({ error: { code: "INVALID_REPORT_DATE", message: "Report date must use YYYY-MM-DD format." } }, { status: 400 });
        const exactDate = new Date(`${reportDate}T00:00:00.000Z`);
        if (Number.isNaN(exactDate.getTime()) || exactDate.toISOString().slice(0, 10) !== reportDate) return NextResponse.json({ error: { code: "INVALID_REPORT_DATE", message: "Enter a valid calendar date." } }, { status: 400 });
        whereClause.reportDate = exactDate;
      }
    } else {
      whereClause.AND = [
        { OR: [
          { menteeId: session.id },
          { visibility: "COHORT", status: { not: "DRAFT" }, cohortId: { in: cohortIds } },
        ] },
        ...(status ? [{ status }] : []),
      ];
      delete whereClause.status;
    }
  } else if (membership?.role === "MENTOR") {
    const assigned = await prisma.cohortMentor.findMany({ where: { mentorId: session.id, cohort: { organizationId, status: "ACTIVE" } }, select: { cohortId: true } });
    const cohortIds = assigned.map((item) => item.cohortId);
    if (cohortId && !cohortIds.includes(cohortId)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not assigned to this cohort" } }, { status: 403 });
    whereClause.cohortId = cohortId ? cohortId : { in: cohortIds };
    whereClause.mentee = {
      memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } },
      cohortEnrollments: { some: { cohortId: { in: cohortIds }, status: "ACTIVE" } },
    };
    if (!status) whereClause.status = { not: "DRAFT" };
    if (menteeId) {
      const enrollment = await prisma.cohortEnrollment.findFirst({ where: { menteeId, cohortId: { in: cohortIds }, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } } });
      if (!enrollment) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You do not mentor this mentee" } }, { status: 403 });
      whereClause.menteeId = menteeId;
    }
  } else if (membership?.role === "OBSERVER") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Observers can view program-level aggregates, not individual daily reports." } }, { status: 403 });
  } else if (menteeId) {
    const targetMembership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: menteeId } } });
    if (targetMembership?.status !== "ACTIVE" || targetMembership.role !== "MENTEE") return NextResponse.json({ error: { code: "INVALID_MENTEE", message: "Target must be an active mentee in this organization" } }, { status: 400 });
    whereClause.menteeId = menteeId;
  }

  const reports = await prisma.dailyReport.findMany({
    where: whereClause,
    include: {
      mentee: { select: { id: true, name: true, email: true, imageUrl: true } },
      cohort: {
        select: {
          id: true,
          name: true,
          slug: true,
          ...(membership?.role === "MENTEE" ? { enrollments: { where: { status: "ACTIVE" }, select: { menteeId: true } } } : {}),
        },
      },
      links: true,
      reviews: {
        include: { reviewer: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { reportDate: "desc" },
    take: 50,
  });

  const visibleReports = membership?.role === "MENTEE"
    ? reports.filter((report: any) => report.menteeId === session.id || (
        report.visibility === "COHORT" && report.status !== "DRAFT" &&
        report.cohort.enrollments.some((enrollment: { menteeId: string }) => enrollment.menteeId === report.menteeId)
      ))
    : reports;
  return NextResponse.json({ reports: visibleReports });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : session.activeOrgId;
    if (!organizationId) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "organizationId required" } }, { status: 400 });

    if (body.mode === "self") {
      if (!(await canUseSelfTracking(session, organizationId))) {
        return NextResponse.json({ error: { code: "FORBIDDEN", message: "Self-tracking is not enabled for this organization." } }, { status: 403 });
      }
      const parsedSelf = SelfTrackedReportCreateSchema.safeParse({ ...body, organizationId });
      if (!parsedSelf.success) {
        const formattedMessage = parsedSelf.error.errors
          .map((e) => e.message || `${e.path.join(".")}: invalid`)
          .join(". ");
        return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: formattedMessage } }, { status: 400 });
      }
      const report = await submitSelfTrackedReport(session, parsedSelf.data);
      return NextResponse.json({ success: true, report });
    }

    const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: session.id } } });
    if (!session.isPlatformSuperAdmin && (membership?.status !== "ACTIVE" || membership.role !== "MENTEE")) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only active mentees can submit their own reports" } }, { status: 403 });
    }
    body.organizationId = organizationId;

    // Infer a cohort only when the mentee has exactly one active enrollment in this organization.
    if (!body.cohortId) {
      const enrollments = await prisma.cohortEnrollment.findMany({
        where: { menteeId: session.id, status: "ACTIVE", cohort: { organizationId, status: "ACTIVE" } },
        select: { cohortId: true },
      });
      if (enrollments.length === 1) body.cohortId = enrollments[0].cohortId;
      else if (enrollments.length > 1) return NextResponse.json({ error: { code: "COHORT_REQUIRED", message: "Choose which active cohort this report belongs to." } }, { status: 400 });
    }

    const parsed = DailyReportCreateSchema.safeParse(body);
    if (!parsed.success) {
      const formattedMessage = parsed.error.errors
        .map((e) => e.message || `${e.path.join(".")}: invalid`)
        .join(". ");
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: formattedMessage } }, { status: 400 });
    }

    const report = await submitDailyReport(session, {
      ...parsed.data,
      menteeId: session.id,
    });

    return NextResponse.json({ success: true, report });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    const msg = error.message || "Report submission failed";
    const status = error.code === "P2034" || error.code === "P2002" ? 409 : 400;
    return NextResponse.json({ error: { code: status === 409 ? "REPORT_CONFLICT" : "SUBMISSION_FAILED", message: status === 409 ? "The report changed while you were saving. Refresh to see the latest version, then try again." : msg } }, { status });
  }
}
