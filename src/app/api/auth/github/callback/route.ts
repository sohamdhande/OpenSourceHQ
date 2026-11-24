import { NextRequest, NextResponse } from "next/server";
import {
  verifyOAuthState,
  exchangeGitHubCode,
  fetchGitHubUserProfile,
  resolveOrLinkGitHubUser,
  determinePostLoginRedirect,
  getAppRedirectUrl,
} from "@/features/github/github-auth-service";
import { createSessionCookie, SessionUser } from "@/server/auth/session";
import { PlatformRoleType } from "@prisma/client";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete("oshq_oauth_state");
  response.cookies.delete("oshq_oauth_pkce");
  return response;
}

function loginError(code: string, description?: string) {
  const params = new URLSearchParams({ error: code });
  if (description) params.set("error_description", description);
  return clearOAuthCookies(NextResponse.redirect(getAppRedirectUrl(`/login?${params.toString()}`)));
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const githubError = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  if (githubError) {
    return loginError("github_authorization_cancelled", errorDescription || "GitHub authorization was cancelled.");
  }
  if (!code || !state) {
    return loginError("missing_code_or_state", "Required GitHub authorization parameters were missing.");
  }

  const cookieState = req.cookies.get("oshq_oauth_state")?.value;
  const codeVerifier = req.cookies.get("oshq_oauth_pkce")?.value;
  if (!cookieState || cookieState !== state || !codeVerifier) {
    return loginError("invalid_oauth_session", "Your GitHub sign-in session expired. Start again.");
  }

  const statePayload = verifyOAuthState(state);
  if (!statePayload) {
    return loginError("invalid_state", "GitHub authorization could not be verified. Start again.");
  }

  try {
    const tokenData = await exchangeGitHubCode(code, codeVerifier);
    if (!tokenData.refreshToken || !tokenData.expiresIn || !tokenData.refreshTokenExpiresIn) {
      throw new Error("GITHUB_EXPIRING_TOKENS_REQUIRED");
    }
    const profile = await fetchGitHubUserProfile(tokenData.accessToken);
    const result = await resolveOrLinkGitHubUser(profile, tokenData, statePayload.currentUserId);
    const user = result.user;

    const activeMembership = user.memberships?.[0];
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      timezone: user.timezone,
      status: user.status,
      isPlatformSuperAdmin: user.platformRole?.role === PlatformRoleType.SUPER_ADMIN,
      activeOrgId: activeMembership?.organizationId,
      activeOrgRole: activeMembership?.role,
      activeOrgSlug: activeMembership?.organization?.slug,
      activeOrgName: activeMembership?.organization?.name,
    };

    if (result.action === "linked") {
      const destination = statePayload.redirectUrl || `/org/${sessionUser.activeOrgSlug || "nstsdc"}/student/profile?success=github_linked`;
      return clearOAuthCookies(NextResponse.redirect(getAppRedirectUrl(destination)));
    }

    const targetPath = user.memberships && user.memberships.length > 1
      ? "/select-org"
      : determinePostLoginRedirect(sessionUser);

    const sessionCookie = createSessionCookie({
      userId: user.id,
      email: user.email,
      activeOrgId: sessionUser.activeOrgId,
      createdAt: Date.now(),
    });

    const response = NextResponse.redirect(getAppRedirectUrl(targetPath));
    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return clearOAuthCookies(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "GitHub authentication failed.";
    if (message === "SUSPENDED_ACCOUNT") {
      return loginError("account_suspended", "Your OpenSourceHQ account is not active. Contact your organization administrator.");
    }
    if (message === "NO_INVITATION_OR_MEMBERSHIP") {
      return clearOAuthCookies(NextResponse.redirect(getAppRedirectUrl(
        "/unauthorized?reason=no_invitation&message=Your+GitHub+account+is+not+linked+to+an+active+OpenSourceHQ+membership+or+invitation."
      )));
    }
    if (message === "UNVERIFIED_GITHUB_EMAIL") {
      return loginError("verified_email_required", "Verify an email address in GitHub, then try signing in again.");
    }
    if (message === "GITHUB_EXPIRING_TOKENS_REQUIRED") {
      return loginError("github_expiring_tokens_required", "GitHub did not return expiring access and refresh tokens. Verify the GitHub App user-authorization configuration and retry.");
    }
    console.error("GitHub OAuth callback failed:", error);
    return loginError("oauth_error", "GitHub sign-in could not be completed. Start again or contact your administrator.");
  }
}
