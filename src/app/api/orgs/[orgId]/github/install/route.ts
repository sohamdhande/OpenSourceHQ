import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import {
  createGitHubInstallationState,
  getGitHubAppSlug,
} from "@/features/github/github-app-service";
import { isGitHubAppConfigured } from "@/features/github/github-auth-service";

export async function GET(_req: Request, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const allowed = await canManageOrganization(session, params.orgId);
  if (!allowed) return NextResponse.json({ error: "Organization administrator access required." }, { status: 403 });
  if (!isGitHubAppConfigured()) {
    return NextResponse.json({ error: "GitHub App credentials are not configured on the server." }, { status: 503 });
  }

  try {
    const slug = getGitHubAppSlug();
    const state = createGitHubInstallationState(params.orgId, session.id);
    const response = NextResponse.redirect(`https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`);
    response.cookies.set("oshq_github_install_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error("Unable to start GitHub App installation:", error);
    return NextResponse.json({ error: "GitHub App installation is not configured correctly." }, { status: 503 });
  }
}
