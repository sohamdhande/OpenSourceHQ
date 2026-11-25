import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import { sendGmailMessage } from "@/features/integrations/gmail-service";
import prisma from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const isAllowed = await canManageOrganization(session, params.orgId);
  if (!isAllowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only organization admins can test integrations" } }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, name: true },
  });

  const org = await prisma.organization.findUnique({
    where: { id: params.orgId },
    select: { name: true },
  });

  if (!user?.email) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Admin user has no email address" } }, { status: 400 });
  }

  const targetEmail = user.email;
  const orgName = org?.name || "OpenSourceHQ";

  try {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0b0f19; color: #f1f5f9; border-radius: 12px; border: 1px solid #1e293b;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <h2 style="color: #38bdf8; margin: 0; font-size: 20px;">OpenSourceHQ — Gmail Integration Active</h2>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          Hello ${user.name || "Administrator"},
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          Your Gmail OAuth integration for <strong>${orgName}</strong> is verified and working! Member invitation emails and system notifications can now be dispatched directly via your connected Gmail account.
        </p>
        <div style="margin: 24px 0; padding: 14px; background-color: #111827; border: 1px solid #334155; border-radius: 8px;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8; font-family: monospace;">
            Timestamp: ${new Date().toISOString()}<br/>
            Recipient: ${targetEmail}<br/>
            Organization: ${orgName}
          </p>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
          Sent securely via OpenSourceHQ Gmail OAuth2 API.
        </p>
      </div>
    `;

    const result = await sendGmailMessage({
      orgId: params.orgId,
      to: targetEmail,
      subject: `[OpenSourceHQ] Gmail Integration Test for ${orgName}`,
      html,
    });

    return NextResponse.json({
      success: true,
      message: `Test email successfully sent to ${targetEmail}`,
      messageId: result.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send test email";
    return NextResponse.json({ error: { code: "SEND_FAILED", message } }, { status: 500 });
  }
}

