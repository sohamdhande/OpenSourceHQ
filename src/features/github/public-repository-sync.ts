import prisma from "@/lib/db";
import { GitHubActivityType } from "@prisma/client";
import { githubInstallationRequest } from "@/features/github/github-app-service";
import { getFreshGitHubUserAccessToken } from "@/features/github/github-auth-service";
import { GitHubConnectionStatus } from "@prisma/client";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

type GitHubUser = { id?: number; login?: string } | null;
type CommitRow = { sha: string; html_url: string; author?: GitHubUser; commit?: { message?: string; author?: { date?: string }; committer?: { date?: string } } };
type PullRequestRow = { id: number; number: number; title: string; body?: string | null; html_url: string; state: "open" | "closed"; merged_at?: string | null; created_at: string; updated_at: string; user?: GitHubUser };
type IssueRow = { id: number; number: number; title: string; body?: string | null; html_url: string; state: "open" | "closed"; created_at: string; updated_at: string; user?: GitHubUser; pull_request?: unknown };

async function publicGitHubRequest<T>(path: string, accessToken?: string): Promise<T> {
  const request = (token?: string) => fetch(`${API_BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": API_VERSION, "User-Agent": "OpenSourceHQ-Public-Repository-Sync" },
    cache: "no-store",
  });
  let response = await request(accessToken);
  // An expired/revoked GitHub user token should not break public repository sync.
  // Only 401 is retried anonymously; 403/429 remain explicit rate-limit/permission errors.
  if (response.status === 401 && accessToken) response = await request();
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) throw new Error("GitHub public API rate limit reached. Try syncing again later.");
    if (response.status === 404) throw new Error("GitHub repository is no longer public or cannot be found.");
    throw new Error(`GitHub repository sync failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function parseGitHubDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function syncSelectedGitHubRepository(repositoryId: string, organizationId: string) {
  const repository = await prisma.repository.findFirst({ where: { id: repositoryId, organizationId } });
  if (!repository) throw new Error("Repository not found in this organization.");
  const prefix = `/repos/${encodeURIComponent(repository.ownerLogin)}/${encodeURIComponent(repository.name)}`;
  let request: <T>(path: string) => Promise<T> = publicGitHubRequest;
  if (repository.visibility === "public") {
    // Prefer an expiring GitHub App user token from a member who selected this
    // repository. This remains server-side and is not a personal access token.
    // Fall back to unauthenticated public reads when no connected account exists.
    const selectedMembers = await prisma.userRepository.findMany({
      where: {
        organizationId,
        repositoryId,
        user: { memberships: { some: { organizationId, status: "ACTIVE" } } },
      },
      select: { userId: true },
    });
    const memberIds = [...new Set(selectedMembers.map((selection) => selection.userId))];
    if (memberIds.length > 0) {
      const accounts = await prisma.gitHubAccount.findMany({
        where: { userId: { in: memberIds }, connectionStatus: GitHubConnectionStatus.CONNECTED, tokenCiphertext: { not: null } },
        orderBy: { connectedAt: "desc" },
        select: { id: true },
      });
      for (const account of accounts) {
        try {
          const token = await getFreshGitHubUserAccessToken(account.id);
          request = <T>(path: string) => publicGitHubRequest<T>(path, token);
          break;
        } catch {
          // Try another selected member's connected account before falling back.
        }
      }
    }
  }
  if (repository.visibility === "private") {
    const installation = await prisma.gitHubInstallation.findFirst({
      where: { organizationId, accountLogin: { equals: repository.ownerLogin, mode: "insensitive" }, suspendedAt: null },
      orderBy: { installedAt: "desc" },
    });
    if (!installation) throw new Error("Private repository tracking requires a GitHub App installation on the repository owner account with access to this repository.");
    request = <T>(path: string) => githubInstallationRequest<T>(installation.providerInstallationId, path);
  }

  try {
    const [commits, pullRequests, issues] = await Promise.all([
      request<CommitRow[]>(`${prefix}/commits?per_page=30`),
      request<PullRequestRow[]>(`${prefix}/pulls?state=all&sort=updated&direction=desc&per_page=30`),
      request<IssueRow[]>(`${prefix}/issues?state=all&sort=updated&direction=desc&per_page=30`),
    ]);

  const accountIds = [...new Set([
    ...commits.map((item) => item.author?.id),
    ...pullRequests.map((item) => item.user?.id),
    ...issues.map((item) => item.user?.id),
  ].filter((id): id is number => typeof id === "number").map(String))];
  const accounts = accountIds.length ? await prisma.gitHubAccount.findMany({ where: { providerUserId: { in: accountIds } }, select: { id: true, providerUserId: true } }) : [];
  const accountMap = new Map(accounts.map((account) => [account.providerUserId, account.id]));
  let stored = 0;

  const persist = async (input: { eventId: string; type: GitHubActivityType; title: string; summary?: string | null; url?: string | null; occurredAt: Date; accountId?: number; metadata?: Record<string, string | number | boolean | null> }) => {
    await prisma.gitHubActivity.upsert({
      where: { organizationId_providerEventId: { organizationId, providerEventId: input.eventId } },
      create: {
        organizationId, repositoryId, githubAccountId: input.accountId ? accountMap.get(String(input.accountId)) || null : null,
        providerEventId: input.eventId, activityType: input.type, title: input.title.slice(0, 240),
        summary: input.summary?.slice(0, 1000) || null, url: input.url || null, occurredAt: input.occurredAt,
        isFixture: false, metadata: input.metadata || undefined,
      },
      update: {
        githubAccountId: input.accountId ? accountMap.get(String(input.accountId)) || null : null,
        activityType: input.type,
        title: input.title.slice(0, 240),
        summary: input.summary?.slice(0, 1000) || null,
        url: input.url || null,
        occurredAt: input.occurredAt,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });
    stored += 1;
  };

  for (const commit of commits) {
    if (!commit.sha) continue;
    const message = commit.commit?.message || commit.sha.slice(0, 8);
    const occurredAt = parseGitHubDate(commit.commit?.author?.date || commit.commit?.committer?.date);
    if (!occurredAt) continue;
    await persist({ eventId: `commit_${repository.id}_${commit.sha}`, type: GitHubActivityType.COMMIT, title: `Commit: ${message.split("\n")[0]}`, summary: message, url: commit.html_url, occurredAt, accountId: commit.author?.id });
  }
  for (const pr of pullRequests) {
    const action = pr.state === "open" ? "opened" : "closed";
    const type = pr.merged_at ? GitHubActivityType.PULL_REQUEST_MERGED : pr.state === "closed" ? GitHubActivityType.PULL_REQUEST_CLOSED : GitHubActivityType.PULL_REQUEST_OPENED;
    const occurredAt = parseGitHubDate(pr.updated_at || pr.created_at);
    if (!occurredAt) continue;
    await persist({ eventId: `pr_${repository.id}_${pr.number}_${action}`, type, title: `PR #${pr.number} ${action}: ${pr.title}`, summary: pr.body, url: pr.html_url, occurredAt, accountId: pr.user?.id, metadata: { number: pr.number, action } });
  }
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const action = issue.state === "open" ? "opened" : "closed";
    const occurredAt = parseGitHubDate(issue.updated_at || issue.created_at);
    if (!occurredAt) continue;
    await persist({ eventId: `issue_${repository.id}_${issue.number}_${action}`, type: issue.state === "closed" ? GitHubActivityType.ISSUE_CLOSED : GitHubActivityType.ISSUE_OPENED, title: `Issue #${issue.number} ${action}: ${issue.title}`, summary: issue.body, url: issue.html_url, occurredAt, accountId: issue.user?.id, metadata: { number: issue.number, action } });
  }

    await prisma.repository.update({ where: { id: repository.id }, data: { lastSyncedAt: new Date(), syncStatus: "ACTIVE" } });
    return { repositoryId, repository: repository.fullName, commits: commits.length, pullRequests: pullRequests.length, issues: issues.filter((issue) => !issue.pull_request).length, activitiesProcessed: stored };
  } catch (error) {
    await prisma.repository.update({ where: { id: repository.id }, data: { syncStatus: "ERROR" } }).catch(() => undefined);
    throw error;
  }
}
