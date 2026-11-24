import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { disconnectGitHubAccount } from "@/features/github/github-auth-service";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const result = await disconnectGitHubAccount(session.id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Disconnect failed";
    return NextResponse.json({ error: { code: "DISCONNECT_FAILED", message: msg } }, { status: 400 });
  }
}

