import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { getActiveOrganizationMembership } from "@/features/repositories/access";
import { searchPublicGitHubRepositories, resolveGitHubRepository } from "@/features/repositories/github-repository-service";
import prisma from "@/lib/db";
import { getFreshGitHubUserAccessToken } from "@/features/github/github-auth-service";
import { GitHubConnectionStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  const organizationId = req.nextUrl.searchParams.get("organizationId") || session.activeOrgId;
  const query = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!organizationId) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Organization is required." } }, { status: 400 });

  const membership = await getActiveOrganizationMembership(session, organizationId);
  if (!membership && !session.isPlatformSuperAdmin) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required." } }, { status: 403 });
  if (!session.isPlatformSuperAdmin && !["ORG_ADMIN", "MENTOR", "MENTEE"].includes(membership!.role)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Repository search is not available to observers." } }, { status: 403 });
  }

  if (query.length < 2) return NextResponse.json({ totalCount: 0, repositories: [] });

  let userAccessToken: string | undefined;
  const githubAccount = await prisma.gitHubAccount.findFirst({
    where: { userId: session.id, connectionStatus: GitHubConnectionStatus.CONNECTED, tokenCiphertext: { not: null } },
    orderBy: { connectedAt: "desc" },
    select: { id: true },
  });
  if (githubAccount) {
    try { userAccessToken = await getFreshGitHubUserAccessToken(githubAccount.id); }
    catch { /* Public repository search can still use GitHub's unauthenticated endpoint. */ }
  }

  try {
    if (/^(https?:\/\/github\.com\/|[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+)$/.test(query)) {
      const remote = await resolveGitHubRepository(organizationId, query, userAccessToken);
      return NextResponse.json({ totalCount: 1, repositories: [remote] });
    }
    const result = await searchPublicGitHubRepositories(query, userAccessToken);
    return NextResponse.json({ totalCount: result.total_count, repositories: result.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub repository search failed.";
    const status = message.includes("rate limit") ? 429 : 502;
    return NextResponse.json({ error: { code: "GITHUB_SEARCH_FAILED", message } }, { status });
  }
}
