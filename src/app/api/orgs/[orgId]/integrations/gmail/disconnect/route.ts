import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import { disconnectGmail } from "@/features/integrations/gmail-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const isAllowed = await canManageOrganization(session, params.orgId);
  if (!isAllowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only organization admins can manage integrations" } }, { status: 403 });
  }

  try {
    await disconnectGmail(params.orgId, session.id);
    return NextResponse.json({ success: true, message: "Gmail integration disconnected successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to disconnect Gmail";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}

