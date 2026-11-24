import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { FeedbackStructuredSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  const organizationId = req.nextUrl.searchParams.get("organizationId") || session.activeOrgId;
  const menteeId = req.nextUrl.searchParams.get("menteeId");
  if (!organizationId) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "organizationId required" } }, { status: 400 });
  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });
  const where: any = { organizationId, deletedAt: null };
  let hidePrivateNotes = false;
  if (membership?.role === "MENTEE") {
    where.menteeId = session.id;
    where.status = "PUBLISHED";
    where.visibility = { in: ["PRIVATE_TO_MENTEE", "COHORT"] };
    hidePrivateNotes = true;
  } else if (membership?.role === "MENTOR") {
    const rows = await prisma.cohortEnrollment.findMany({ where: { status: "ACTIVE", cohort: { organizationId, status: "ACTIVE", mentors: { some: { mentorId: session.id } } }, mentee: { memberships: { some: { organizationId, role: "MENTEE", status: "ACTIVE" } } } }, select: { menteeId: true } });
    const menteeIds = [...new Set(rows.map((row) => row.menteeId))];
    where.menteeId = menteeId ? menteeId : { in: menteeIds };
    if (menteeId && !menteeIds.includes(menteeId)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You do not mentor this mentee" } }, { status: 403 });
  } else if (membership?.role === "OBSERVER") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Feedback is private to its mentee and assigned mentors." } }, { status: 403 });
  } else if (menteeId) {
    const targetMembership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: menteeId } } });
    if (targetMembership?.status !== "ACTIVE" || targetMembership.role !== "MENTEE") return NextResponse.json({ error: { code: "INVALID_MENTEE", message: "Feedback target must be an active mentee in this organization" } }, { status: 400 });
    where.menteeId = menteeId;
  }
  const feedbacks = await prisma.feedback.findMany({
    where,
    include: { author: { select: { id: true, name: true, imageUrl: true } }, mentee: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const safeFeedbacks = hidePrivateNotes ? feedbacks.map(({ privateNotes, ...feedback }) => feedback) : feedbacks;
  return NextResponse.json({ feedbacks: safeFeedbacks });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  try {
    const parsed = FeedbackStructuredSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    const input = parsed.data;
    const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: input.organizationId, userId: session.id } } });
    if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });
    if (!session.isPlatformSuperAdmin && membership?.role !== "ORG_ADMIN" && membership?.role !== "MENTOR") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only administrators and mentors can write feedback" } }, { status: 403 });
    const [target, organization] = await Promise.all([
      prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: input.organizationId, userId: input.menteeId } } }),
      prisma.organization.findUnique({ where: { id: input.organizationId }, select: { slug: true } }),
    ]);
    if (target?.status !== "ACTIVE" || target.role !== "MENTEE") return NextResponse.json({ error: { code: "INVALID_MENTEE", message: "Feedback target must be an active mentee in this organization" } }, { status: 400 });
    if (membership?.role === "MENTOR") {
      const enrollment = await prisma.cohortEnrollment.findFirst({ where: { menteeId: input.menteeId, status: "ACTIVE", cohort: { organizationId: input.organizationId, status: "ACTIVE", mentors: { some: { mentorId: session.id } } } } });
      if (!enrollment) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You can write feedback only for mentees in your assigned cohorts" } }, { status: 403 });
    }
    if (!organization) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Organization not found" } }, { status: 404 });
    const feedback = await prisma.feedback.create({
      data: {
        organizationId: input.organizationId, menteeId: input.menteeId, authorId: session.id,
        category: input.category, content: input.content.trim(), technicalStrengths: input.technicalStrengths,
        areasForImprovement: input.areasForImprovement, codeQuality: input.codeQuality,
        communication: input.communication, collaboration: input.collaboration,
        problemSolving: input.problemSolving, consistency: input.consistency,
        recommendations: input.recommendations, privateNotes: input.privateNotes,
        visibility: input.visibility, status: input.status,
      },
      include: { author: { select: { name: true } }, mentee: { select: { name: true, email: true } } },
    });
    if (feedback.status === "PUBLISHED" && feedback.visibility !== "PRIVATE_TO_MENTORS") {
      await prisma.notification.create({ data: {
        organizationId: input.organizationId, userId: input.menteeId, type: "FEEDBACK_PUBLISHED", title: "New mentor feedback published",
        body: `${session.name} published feedback on your progress: "${feedback.content.substring(0, 80)}"`,
        targetUrl: `/org/${organization.slug}/student/feedback`,
      } });
    }
    await logAudit({ organizationId: input.organizationId, actorId: session.id, action: "FEEDBACK_CREATED", targetType: "Feedback", targetId: feedback.id, metadata: { menteeId: feedback.menteeId, category: feedback.category } });
    return NextResponse.json({ success: true, feedback });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create feedback";
    return NextResponse.json({ error: { code: "FEEDBACK_FAILED", message: msg } }, { status: 400 });
  }
}
