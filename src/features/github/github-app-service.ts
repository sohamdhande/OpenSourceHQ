import crypto from "crypto";
import { getGitHubOAuthConfig } from "@/features/github/github-auth-service";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";
const installationTokenCache = new Map<string, { token: string; expiresAt: number }>();

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/** Creates a short-lived GitHub App JWT. Never expose this token to the browser. */
export function createGitHubAppJwt(nowSeconds = Math.floor(Date.now() / 1000)): string {
  const config = getGitHubOAuthConfig();
  if (!config.appId || !config.privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required for GitHub App API access.");
  }

  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    iat: nowSeconds - 60,
    exp: nowSeconds + 9 * 60,
    iss: config.appId,
  }));
  const unsignedToken = `${header}.${payload}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsignedToken), config.privateKey).toString("base64url");
  return `${unsignedToken}.${signature}`;
}

async function githubAppRequest<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    throw new Error("GitHub API path must be an absolute API-relative path.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${createGitHubAppJwt()}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "OpenSourceHQ-Platform",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    // Do not include response bodies, which may contain account or credential details.
    throw new Error(`GitHub App API request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export interface GitHubInstallationDetails {
  id: number;
  account: { id: number; login: string; type: string };
  permissions?: Record<string, string>;
  repository_selection?: string;
  suspended_at?: string | null;
}

export async function getGitHubInstallationDetails(installationId: string): Promise<GitHubInstallationDetails> {
  if (!/^\d+$/.test(installationId)) throw new Error("Invalid GitHub installation ID.");
  return githubAppRequest<GitHubInstallationDetails>(`/app/installations/${installationId}`);
}

/** Mint or reuse an installation token. Tokens remain server-side and are never persisted as user PATs. */
export async function getGitHubInstallationAccessToken(installationId: string): Promise<string> {
  if (!/^\d+$/.test(installationId)) throw new Error("Invalid GitHub installation ID.");
  const cached = installationTokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) return cached.token;

  const data = await githubAppRequest<{ token: string; expires_at: string }>(
    `/app/installations/${installationId}/access_tokens`,
    "POST",
    {}
  );
  const expiresAt = new Date(data.expires_at).getTime();
  if (!data.token || !Number.isFinite(expiresAt)) throw new Error("GitHub returned an invalid installation token response.");
  installationTokenCache.set(installationId, { token: data.token, expiresAt });
  return data.token;
}

/** Makes an authenticated API request as the GitHub App installation for a known installation ID. */
export async function githubInstallationRequest<T>(
  installationId: string,
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    throw new Error("GitHub API path must be an absolute API-relative path.");
  }
  const token = await getGitHubInstallationAccessToken(installationId);
  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "OpenSourceHQ-Platform",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub installation API request failed (${response.status}).`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function clearGitHubInstallationTokenCache(installationId?: string): void {
  if (installationId) installationTokenCache.delete(installationId);
  else installationTokenCache.clear();
}

export function getGitHubAppSlug(): string {
  const slug = process.env.GITHUB_APP_SLUG || "";
  if (!/^[a-zA-Z0-9-]+$/.test(slug)) throw new Error("GITHUB_APP_SLUG is not configured or invalid.");
  return slug;
}


export interface GitHubInstallationState {
  organizationId: string;
  userId: string;
  nonce: string;
  createdAt: number;
}

function getInstallationStateSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters in production.");
  }
  return secret || "default-dev-secret-at-least-32-chars-long-security";
}

export function createGitHubInstallationState(organizationId: string, userId: string): string {
  const payload: GitHubInstallationState = {
    organizationId,
    userId,
    nonce: crypto.randomBytes(24).toString("hex"),
    createdAt: Date.now(),
  };
  const data = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", getInstallationStateSecret()).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifyGitHubInstallationState(token: string): GitHubInstallationState | null {
  try {
    const [data, signature, extra] = token.split(".");
    if (!data || !signature || extra) return null;
    const expected = crypto.createHmac("sha256", getInstallationStateSecret()).update(data).digest("base64url");
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as GitHubInstallationState;
    const age = Date.now() - payload.createdAt;
    if (!payload.organizationId || !payload.userId || !payload.nonce || !Number.isFinite(age) || age < 0 || age > 10 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
