import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { FeedbackRespondSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  try {
    const parsed = FeedbackRespondSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    const feedback = await prisma.feedback.findUnique({ where: { id: params.id } });
    if (!feedback || feedback.deletedAt) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Feedback not found" } }, { status: 404 });
    const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: feedback.organizationId, userId: session.id } } });
    if (feedback.menteeId !== session.id || (!session.isPlatformSuperAdmin && (membership?.status !== "ACTIVE" || membership.role !== "MENTEE"))) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only the active feedback recipient can respond" } }, { status: 403 });
    if (feedback.status !== "PUBLISHED" || feedback.visibility === "PRIVATE_TO_MENTORS") return NextResponse.json({ error: { code: "FEEDBACK_NOT_VISIBLE", message: "This feedback is not published to you" } }, { status: 403 });
    const menteeResponse = parsed.data.menteeResponse.trim();
    const updated = await prisma.feedback.update({ where: { id: params.id }, data: { acknowledgedAt: new Date(), menteeResponse } });
    const organization = await prisma.organization.findUnique({ where: { id: feedback.organizationId }, select: { slug: true } });
    await prisma.notification.create({ data: {
      organizationId: feedback.organizationId,
      userId: feedback.authorId,
      type: "FEEDBACK_ACKNOWLEDGED",
      title: menteeResponse ? "Mentee responded to feedback" : "Mentee acknowledged your feedback",
      body: menteeResponse ? `${session.name} responded: "${menteeResponse.substring(0, 80)}"` : `${session.name} acknowledged your feedback.`,
      targetUrl: `/org/${organization?.slug || feedback.organizationId}/mentor/reviews`,
    } });
    return NextResponse.json({ success: true, feedback: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Feedback response failed";
    return NextResponse.json({ error: { code: "RESPONSE_FAILED", message: msg } }, { status: 400 });
  }
}
