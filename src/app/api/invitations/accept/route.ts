import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { acceptInvitation } from "@/features/organizations/orgs-service";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required to accept invitation" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const token = body.token;
    if (!token) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invite token required" } }, { status: 400 });
    }

    const membership = await acceptInvitation(token, session.id);
    return NextResponse.json({ success: true, membership });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to accept invite";
    return NextResponse.json({ error: { code: "INVITE_ERROR", message: msg } }, { status: 400 });
  }
}

