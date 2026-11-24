import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import {
  createOAuthState,
  getGitHubAuthorizeUrl,
  isGitHubOAuthConfigured,
  getAppRedirectUrl,
} from "@/features/github/github-auth-service";

const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

export async function GET(req: NextRequest) {
  const actionParam = req.nextUrl.searchParams.get("action");
  const redirectUrl = req.nextUrl.searchParams.get("redirectUrl") || undefined;
  const session = await getSession();
  const action = actionParam === "link" && session ? "link" : "login";
  const currentUserId = action === "link" ? session?.id : undefined;

  if (!isGitHubOAuthConfigured()) {
    const error = new URLSearchParams({
      error: "oauth_unconfigured",
      error_description: "GitHub sign-in is not configured for this environment.",
    });
    return NextResponse.redirect(getAppRedirectUrl(`/login?${error.toString()}`));
  }

  try {
    const { stateToken, codeVerifier, codeChallenge } = createOAuthState(action, currentUserId, redirectUrl);
    const response = NextResponse.redirect(getGitHubAuthorizeUrl(stateToken, codeChallenge));
    response.cookies.set("oshq_oauth_state", stateToken, OAUTH_COOKIE_OPTIONS);
    response.cookies.set("oshq_oauth_pkce", codeVerifier, OAUTH_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error("Could not start GitHub authorization flow:", error);
    return NextResponse.redirect(getAppRedirectUrl("/login?error=oauth_configuration_invalid"));
  }
}
