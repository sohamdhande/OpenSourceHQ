import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { reviewDailyReport } from "@/features/reports/reports-service";
import { ReportReviewSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { reportId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = ReportReviewSchema.safeParse({
      ...body,
      reportId: params.reportId,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    }

    const result = await reviewDailyReport(
      session,
      params.reportId,
      parsed.data.decision,
      parsed.data.comment
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Review failed";
    return NextResponse.json({ error: { code: "REVIEW_FAILED", message: msg } }, { status: 403 });
  }
}

