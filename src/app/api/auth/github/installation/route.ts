import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import {
  getAppRedirectUrl,
} from "@/features/github/github-auth-service";
import {
  getGitHubInstallationDetails,
  verifyGitHubInstallationState,
} from "@/features/github/github-app-service";
import { logAudit } from "@/lib/audit";

function clearInstallState(response: NextResponse) {
  response.cookies.delete("oshq_github_install_state");
  return response;
}

function installRedirect(orgSlug: string, status: string) {
  return getAppRedirectUrl(`/org/${encodeURIComponent(orgSlug)}/admin/integrations/github?installation=${encodeURIComponent(status)}`);
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || "";
  const installationId = req.nextUrl.searchParams.get("installation_id") || "";
  const setupAction = req.nextUrl.searchParams.get("setup_action") || "";
  const cookieState = req.cookies.get("oshq_github_install_state")?.value;
  const payload = verifyGitHubInstallationState(state);

  if (!state || state !== cookieState || !payload || !/^\d+$/.test(installationId)) {
    return clearInstallState(NextResponse.redirect(getAppRedirectUrl("/login?error=github_install_state_invalid")));
  }

  const session = await getSession();
  if (!session || session.id !== payload.userId) {
    return clearInstallState(NextResponse.redirect(getAppRedirectUrl("/login?error=github_install_session_expired")));
  }

  const allowed = await canManageOrganization(session, payload.organizationId);
  if (!allowed) {
    return clearInstallState(NextResponse.redirect(getAppRedirectUrl("/unauthorized?reason=github_install_forbidden")));
  }

  if (setupAction !== "install" && setupAction !== "update") {
    const org = await prisma.organization.findUnique({ where: { id: payload.organizationId }, select: { slug: true } });
    return clearInstallState(NextResponse.redirect(org ? installRedirect(org.slug, "cancelled") : getAppRedirectUrl("/select-org")));
  }

  try {
    const details = await getGitHubInstallationDetails(installationId);
    const existing = await prisma.gitHubInstallation.findUnique({ where: { providerInstallationId: String(details.id) } });
    if (existing && existing.organizationId !== payload.organizationId) {
      throw new Error("This GitHub App installation is already connected to another OpenSourceHQ organization.");
    }

    const installation = await prisma.gitHubInstallation.upsert({
      where: { providerInstallationId: String(details.id) },
      create: {
        organizationId: payload.organizationId,
        providerInstallationId: String(details.id),
        accountLogin: details.account.login,
        accountType: details.account.type,
        permissions: details.permissions || {},
        suspendedAt: details.suspended_at ? new Date(details.suspended_at) : null,
      },
      update: {
        accountLogin: details.account.login,
        accountType: details.account.type,
        permissions: details.permissions || {},
        suspendedAt: details.suspended_at ? new Date(details.suspended_at) : null,
      },
    });

    await logAudit({
      organizationId: payload.organizationId,
      actorId: session.id,
      action: "GITHUB_APP_INSTALLATION_CONNECTED",
      targetType: "GitHubInstallation",
      targetId: installation.id,
      metadata: { accountLogin: installation.accountLogin, accountType: installation.accountType },
    });

    const org = await prisma.organization.findUnique({ where: { id: payload.organizationId }, select: { slug: true } });
    const response = NextResponse.redirect(org ? installRedirect(org.slug, "connected") : getAppRedirectUrl("/select-org"));
    return clearInstallState(response);
  } catch (error) {
    console.error("GitHub App installation callback failed:", error);
    const org = await prisma.organization.findUnique({ where: { id: payload.organizationId }, select: { slug: true } });
    const response = NextResponse.redirect(org ? installRedirect(org.slug, "failed") : getAppRedirectUrl("/select-org"));
    return clearInstallState(response);
  }
}
