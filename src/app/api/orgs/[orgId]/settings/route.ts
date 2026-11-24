import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  }
  if (!(await canManageOrganization(session, params.orgId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Organization administrator access required." } }, { status: 403 });
  }

  try {
    const body = await request.json();
    const timezone = typeof body?.timezone === "string" ? body.timezone.trim() : "";
    if (!timezone || timezone.length > 100) {
      return NextResponse.json({ error: { code: "INVALID_TIMEZONE", message: "Enter a valid IANA timezone." } }, { status: 400 });
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      return NextResponse.json({ error: { code: "INVALID_TIMEZONE", message: "That timezone is not recognized. Use an IANA timezone such as Asia/Kolkata." } }, { status: 400 });
    }

    const organization = await prisma.organization.update({
      where: { id: params.orgId },
      data: { timezone },
      select: { id: true, name: true, timezone: true },
    });
    await logAudit({
      organizationId: organization.id,
      actorId: session.id,
      action: "ORGANIZATION_TIMEZONE_UPDATED",
      targetType: "Organization",
      targetId: organization.id,
      metadata: { timezone },
    });
    return NextResponse.json({ success: true, organization });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update organization settings.";
    return NextResponse.json({ error: { code: "SETTINGS_UPDATE_FAILED", message } }, { status: 400 });
  }
}
