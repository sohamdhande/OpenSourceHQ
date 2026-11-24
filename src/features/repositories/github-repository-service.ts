import prisma from "@/lib/db";
import { githubInstallationRequest } from "@/features/github/github-app-service";
import { parseGitHubRepositoryReference } from "@/features/repositories/repository-reference";
export { parseGitHubRepositoryReference } from "@/features/repositories/repository-reference";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

export interface GitHubRepositorySummary {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  owner: { login: string; avatar_url?: string };
  stargazers_count?: number;
  forks_count?: number;
  language?: string | null;
  open_issues_count?: number;
  topics?: string[];
  archived?: boolean;
  disabled?: boolean;
}

export interface RepositorySearchResult {
  total_count: number;
  items: GitHubRepositorySummary[];
}

async function githubPublicRequest<T>(path: string, accessToken?: string): Promise<T> {
  const request = (token?: string) => fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "OpenSourceHQ",
    },
    cache: "no-store",
  });
  let response = await request(accessToken);
  // A revoked/expired user token must not prevent discovery of public projects.
  // Retry unauthenticated only for 401; keep rate-limit/permission 403 responses visible.
  if (response.status === 401 && accessToken) response = await request();
  if (!response.ok) {
    const error = new Error(`GitHub public API request failed (${response.status}).`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function searchPublicGitHubRepositories(query: string, accessToken?: string): Promise<RepositorySearchResult> {
  const q = query.trim().slice(0, 120);
  if (q.length < 2) return { total_count: 0, items: [] };
  const searchQuery = `${q} is:public archived:false`;
  return githubPublicRequest<RepositorySearchResult>(`/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=12`, accessToken);
}

export async function resolveGitHubRepository(
  organizationId: string,
  reference: string,
  accessToken?: string
): Promise<GitHubRepositorySummary> {
  const parsed = parseGitHubRepositoryReference(reference);
  if (!parsed) throw new Error("Enter a GitHub repository as owner/name or https://github.com/owner/name.");

  const path = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`;
  try {
    return await githubPublicRequest<GitHubRepositorySummary>(path, accessToken);
  } catch (publicError) {
    const status = (publicError as Error & { status?: number }).status;
    if (status !== 404 && status !== 403) throw publicError;

    // Private repositories are only resolved when the organization's installed GitHub App can see them.
    const installation = await prisma.gitHubInstallation.findFirst({
      where: { organizationId, accountLogin: { equals: parsed.owner, mode: "insensitive" }, suspendedAt: null },
      orderBy: { installedAt: "desc" },
    });
    if (!installation) {
      if (status === 403) throw new Error("GitHub rate limit reached. Try again shortly, or paste the exact public repository URL.");
      throw new Error("Repository not found. Private repositories require the organization GitHub App to be installed with access to that repository.");
    }
    try {
      return await githubInstallationRequest<GitHubRepositorySummary>(installation.providerInstallationId, path);
    } catch {
      throw new Error("GitHub could not access this repository. Check that it exists and that the organization's GitHub App installation has repository access.");
    }
  }
}

export async function connectRepositoryToOrganization(
  organizationId: string,
  remote: GitHubRepositorySummary
) {
  if (remote.archived || remote.disabled) {
    throw new Error("Archived or disabled repositories cannot be selected for active program work.");
  }

  return prisma.repository.upsert({
    where: {
      organizationId_providerRepositoryId: {
        organizationId,
        providerRepositoryId: String(remote.id),
      },
    },
    create: {
      organizationId,
      provider: "GITHUB",
      providerRepositoryId: String(remote.id),
      ownerLogin: remote.owner.login,
      name: remote.name,
      fullName: remote.full_name,
      url: remote.html_url,
      description: remote.description,
      defaultBranch: remote.default_branch || "main",
      visibility: remote.private ? "private" : "public",
      syncStatus: "ACTIVE",
      lastSyncedAt: null,
    },
    update: {
      ownerLogin: remote.owner.login,
      name: remote.name,
      fullName: remote.full_name,
      url: remote.html_url,
      description: remote.description,
      defaultBranch: remote.default_branch || "main",
      visibility: remote.private ? "private" : "public",
      syncStatus: "ACTIVE",
    },
  });
}
