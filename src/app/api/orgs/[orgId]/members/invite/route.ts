import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { inviteOrganizationMember } from "@/features/organizations/orgs-service";
import { InvitationCreateSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = InvitationCreateSchema.safeParse({
      ...body,
      organizationId: params.orgId,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    }

    const invitation = await inviteOrganizationMember(
      session,
      params.orgId,
      parsed.data.email,
      parsed.data.role,
      parsed.data.cohortId
    );

    return NextResponse.json({ success: true, invitation });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invitation failed";
    return NextResponse.json({ error: { code: "INVITE_FAILED", message: msg } }, { status: 403 });
  }
}

