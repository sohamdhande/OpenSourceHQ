import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { submitMilestoneEvidence } from "@/features/learning/learning-service";
import { MilestoneSubmitSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { milestoneId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = MilestoneSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    }

    const milestone = await submitMilestoneEvidence(
      session,
      params.milestoneId,
      parsed.data.notes,
      parsed.data.evidenceUrl
    );

    return NextResponse.json({ success: true, milestone });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Milestone submission failed";
    return NextResponse.json({ error: { code: "SUBMISSION_FAILED", message: msg } }, { status: 400 });
  }
}

