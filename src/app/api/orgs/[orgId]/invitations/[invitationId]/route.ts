import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canManageOrganization } from "@/server/authorization/policies";
import { dispatchInvitationEmail } from "@/lib/email/invitation-mailer";

export async function DELETE(_req: NextRequest, { params }: { params: { orgId: string; invitationId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  if (!(await canManageOrganization(session, params.orgId))) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 });
  const existing = await prisma.invitation.findFirst({ where: { id: params.invitationId, organizationId: params.orgId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Invitation not found" } }, { status: 404 });
  await prisma.invitation.delete({ where: { id: existing.id } });
  await logAudit({ organizationId: params.orgId, actorId: session.id, action: "INVITATION_REVOKED", targetType: "Invitation", targetId: existing.id, metadata: { email: existing.email } });
  return NextResponse.json({ success: true, message: "Invitation revoked" });
}

export async function POST(_req: NextRequest, { params }: { params: { orgId: string; invitationId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  if (!(await canManageOrganization(session, params.orgId))) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 });
  const existing = await prisma.invitation.findFirst({ where: { id: params.invitationId, organizationId: params.orgId, acceptedAt: null } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Pending invitation not found" } }, { status: 404 });
  const invitation = await prisma.invitation.update({ where: { id: existing.id }, data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  await logAudit({ organizationId: params.orgId, actorId: session.id, action: "INVITATION_RESENT", targetType: "Invitation", targetId: invitation.id, metadata: { email: invitation.email } });
  
  dispatchInvitationEmail({
    organizationId: params.orgId,
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    inviterName: session.name || session.email,
  }).catch((err) => console.error("Async resend invitation email dispatch error:", err));

  return NextResponse.json({ success: true, invitation });
}
