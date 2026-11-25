import prisma from "@/lib/db";
import { sendGmailMessage } from "@/features/integrations/gmail-service";

interface SendInviteParams {
  organizationId: string;
  email: string;
  role: string;
  token: string;
  inviterName?: string;
  cohortName?: string | null;
}

export async function dispatchInvitationEmail({
  organizationId,
  email,
  role,
  token,
  inviterName,
  cohortName,
}: SendInviteParams): Promise<boolean> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, settings: true },
    });

    if (!org) return false;

    const settings = (org.settings as Record<string, unknown>) || {};
    const gmail = settings.gmail as { connected?: boolean } | undefined;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://org.nstsdc.org";
    const acceptUrl = `${appUrl}/login?invite=${encodeURIComponent(token)}`;

    // If Gmail is not connected, log the invite link for local development / testing
    if (!gmail?.connected) {
      console.log(`[Invitation Mailer (Simulated)] Email to: ${email} | Accept Link: ${acceptUrl}`);
      return false;
    }

    const orgName = org.name;
    const roleLabel = role.replace(/_/g, " ");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background-color: #0b0f19; color: #f8fafc; border-radius: 14px; border: 1px solid #1e293b;">
        <div style="margin-bottom: 24px;">
          <h1 style="color: #38bdf8; font-size: 22px; font-weight: 700; margin: 0 0 6px 0;">OpenSourceHQ</h1>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">Open Source Mentorship & Engineering Fellowship</p>
        </div>

        <div style="background-color: #111827; border: 1px solid #1e293b; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 12px 0; font-size: 15px; color: #f1f5f9; line-height: 1.5;">
            You have been invited to join <strong>${orgName}</strong> as a <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; background-color: #1e3a8a; color: #93c5fd; font-size: 12px; font-weight: 600; text-transform: uppercase;">${roleLabel}</span>.
          </p>
          ${
            cohortName
              ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #cbd5e1;">Assigned Cohort: <strong>${cohortName}</strong></p>`
              : ""
          }
          ${
            inviterName
              ? `<p style="margin: 0; font-size: 13px; color: #94a3b8;">Invited by: ${inviterName}</p>`
              : ""
          }
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${acceptUrl}" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
            Accept Invitation & Sign In with GitHub
          </a>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
          Or copy and paste this acceptance URL into your browser:
        </p>
        <p style="font-size: 11px; word-break: break-all; color: #38bdf8; font-family: monospace; background: #070a12; padding: 10px; border-radius: 6px; border: 1px solid #1e293b;">
          ${acceptUrl}
        </p>

        <p style="font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px;">
          This invitation was sent to ${email} and will expire in 7 days. If you were not expecting this invitation, you can ignore this email.
        </p>
      </div>
    `;

    await sendGmailMessage({
      orgId: organizationId,
      to: email,
      subject: `[OpenSourceHQ] You're invited to join ${orgName} as ${roleLabel}`,
      html,
    });

    return true;
  } catch (error) {
    console.error("Failed to dispatch invitation email via Gmail:", error);
    return false;
  }
}

