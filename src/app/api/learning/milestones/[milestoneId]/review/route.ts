import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { reviewMenteeMilestone } from "@/features/learning/learning-service";
import { MilestoneReviewSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { milestoneId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = MilestoneReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    }

    const reviewed = await reviewMenteeMilestone(
      session,
      parsed.data.menteeId,
      params.milestoneId,
      parsed.data.status,
      parsed.data.notes
    );

    return NextResponse.json({ success: true, milestone: reviewed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Milestone review failed";
    return NextResponse.json({ error: { code: "REVIEW_FAILED", message: msg } }, { status: 400 });
  }
}

