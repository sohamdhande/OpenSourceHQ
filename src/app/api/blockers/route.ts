import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { createBlocker, listBlockers } from "@/features/blockers/blockers-service";
import { BlockerCreateSchema } from "@/lib/schemas";
import { BlockerStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  const organizationId = req.nextUrl.searchParams.get("organizationId") || session.activeOrgId;
  const statusParam = req.nextUrl.searchParams.get("status");
  if (statusParam && !Object.values(BlockerStatus).includes(statusParam as BlockerStatus)) {
    return NextResponse.json({ error: { code: "INVALID_STATUS", message: "Unsupported blocker status." } }, { status: 400 });
  }
  const status = statusParam as BlockerStatus | undefined;
  if (!organizationId) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "organizationId required" } }, { status: 400 });
  try {
    const blockers = await listBlockers(session, organizationId, status);
    return NextResponse.json({ blockers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unable to list blockers";
    return NextResponse.json({ error: { code: "FORBIDDEN", message: msg } }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  try {
    const parsed = BlockerCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    const blocker = await createBlocker(session, parsed.data);
    return NextResponse.json({ success: true, blocker });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to raise blocker";
    const status = msg.includes("Only active") || msg.includes("must be actively") || msg.includes("choose the cohort") ? 403 : 400;
    return NextResponse.json({ error: { code: "BLOCKER_CREATE_FAILED", message: msg } }, { status });
  }
}
