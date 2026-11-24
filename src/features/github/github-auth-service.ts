import crypto from "crypto";
import fs from "fs";
import path from "path";
import prisma from "@/lib/db";
import { encryptToken, decryptToken } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import { SessionUser } from "@/server/auth/session";
import { UserStatus, GitHubConnectionStatus, OrgRole } from "@prisma/client";

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  appId?: string;
  privateKey?: string;
}

export interface GitHubProfile {
  numericId: string;
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
  profileUrl: string;
  primaryEmail?: string | null;
  verifiedEmail?: string | null;
}

export interface OAuthStatePayload {
  state: string;
  action: "login" | "link";
  currentUserId?: string;
  redirectUrl?: string;
  createdAt: number;
}

export function getGitHubPrivateKey(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (raw) {
    if (raw.startsWith("-----BEGIN")) {
      return raw.replace(/\\n/g, "\n");
    }
    // In production, GITHUB_APP_PRIVATE_KEY is a PEM value, never an arbitrary path.
    if (process.env.NODE_ENV !== "production") {
      try {
        if (fs.existsSync(raw)) return fs.readFileSync(raw, "utf8");
      } catch {}
    }
  }
  const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (keyPath) {
    try {
      if (process.env.NODE_ENV === "production" && !path.isAbsolute(keyPath)) return "";
      const resolved = path.resolve(process.cwd(), keyPath);
      if (fs.existsSync(resolved)) return fs.readFileSync(resolved, "utf8");
    } catch {}
  }
  if (process.env.NODE_ENV !== "production") {
    const defaultPath = path.resolve(process.cwd(), ".certs/opensourcesoham.private-key.pem");
    if (fs.existsSync(defaultPath)) return fs.readFileSync(defaultPath, "utf8");
  }
  return "";
}

function getOAuthSigningSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters in production.");
  }
  return secret || "default-dev-secret-at-least-32-chars-long-security";
}

export function getAppBaseUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const appUrl = new URL(configuredUrl);
  if (appUrl.username || appUrl.password || appUrl.search || appUrl.hash || appUrl.pathname !== "/") {
    throw new Error("NEXT_PUBLIC_APP_URL must be an origin-only base URL without credentials, path, query, or hash.");
  }
  if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }
  return appUrl;
}

export function getAppRedirectUrl(pathname: string): URL {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\")) {
    throw new Error("Only application-relative redirect paths are allowed.");
  }
  return new URL(pathname, getAppBaseUrl());
}

function getCallbackUrl(): string {
  const appUrl = getAppBaseUrl();
  const configuredCallback =
    process.env.GITHUB_CALLBACK_URL ||
    process.env.GITHUB_OAUTH_CALLBACK_URL ||
    new URL("/api/auth/github/callback", appUrl).toString();
  const callbackUrl = new URL(configuredCallback);

  if (
    callbackUrl.username || callbackUrl.password || callbackUrl.search || callbackUrl.hash ||
    callbackUrl.pathname !== "/api/auth/github/callback" ||
    callbackUrl.origin !== appUrl.origin
  ) {
    throw new Error("GITHUB_CALLBACK_URL must use the app origin and the exact /api/auth/github/callback path, with no query or fragment.");
  }
  if (process.env.NODE_ENV === "production" && callbackUrl.protocol !== "https:") {
    throw new Error("GITHUB_CALLBACK_URL must use HTTPS in production.");
  }
  return callbackUrl.toString();
}

/** Returns validated GitHub OAuth and GitHub App configuration. */
export function getGitHubOAuthConfig(): GitHubOAuthConfig {
  return {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    callbackUrl: getCallbackUrl(),
    appId: process.env.GITHUB_APP_ID,
    privateKey: getGitHubPrivateKey(),
  };
}

export function isGitHubOAuthConfigured(): boolean {
  try {
    const config = getGitHubOAuthConfig();
    return Boolean(config.clientId && config.clientSecret);
  } catch {
    return false;
  }
}

export function isGitHubAppConfigured(): boolean {
  try {
    const config = getGitHubOAuthConfig();
    if (!config.appId || !config.privateKey) return false;
    crypto.createPrivateKey(config.privateKey);
    return true;
  } catch {
    return false;
  }
}

/** Generates a signed anti-CSRF state and an independent PKCE verifier. */
export function createOAuthState(
  action: "login" | "link" = "login",
  currentUserId?: string,
  redirectUrl?: string
): { stateToken: string; stateString: string; codeVerifier: string; codeChallenge: string } {
  const randomState = crypto.randomBytes(24).toString("hex");
  const safeRedirectUrl = redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") && !redirectUrl.includes("\\")
    ? redirectUrl
    : undefined;
  const payload: OAuthStatePayload = {
    state: randomState,
    action,
    currentUserId,
    redirectUrl: safeRedirectUrl,
    createdAt: Date.now(),
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getOAuthSigningSecret()).update(data).digest("base64url");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  return { stateToken: `${data}.${signature}`, stateString: randomState, codeVerifier, codeChallenge };
}

/** Verifies and parses the signed OAuth state token. */
export function verifyOAuthState(token: string): OAuthStatePayload | null {
  try {
    const [data, signature, extra] = token.split(".");
    if (!data || !signature || extra) return null;

    const expectedSig = crypto.createHmac("sha256", getOAuthSigningSecret()).update(data).digest("base64url");
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSig);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as OAuthStatePayload;
    const ageMs = Date.now() - payload.createdAt;
    if (
      !payload.state || !["login", "link"].includes(payload.action) ||
      !Number.isFinite(payload.createdAt) || ageMs < 0 || ageMs > 10 * 60 * 1000
    ) return null;
    if (payload.redirectUrl && (!payload.redirectUrl.startsWith("/") || payload.redirectUrl.startsWith("//") || payload.redirectUrl.includes("\\"))) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Builds GitHub App user authorization URL. GitHub Apps support offline_access only. */
export function getGitHubAuthorizeUrl(stateToken: string, codeChallenge: string): string {
  const config = getGitHubOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: "offline_access",
    state: stateToken,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export interface GitHubUserTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshTokenExpiresIn?: number;
  scope: string;
}

/** Exchanges an authorization code using the same configured callback and PKCE verifier. */
export async function exchangeGitHubCode(code: string, codeVerifier: string): Promise<GitHubUserTokenResponse> {
  const config = getGitHubOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("GitHub Client ID and Client Secret must be configured.");
  }
  if (!codeVerifier || codeVerifier.length < 43) throw new Error("GitHub PKCE verifier is missing or invalid.");

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.callbackUrl,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok || data.error || !data.access_token) {
    throw new Error("GitHub authorization code exchange failed. Restart the sign-in flow and try again.");
  }

  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
    refreshTokenExpiresIn: typeof data.refresh_token_expires_in === "number" ? data.refresh_token_expires_in : undefined,
    scope: typeof data.scope === "string" ? data.scope : "",
  };
}

/** Fetches the authenticated GitHub profile and only trusts GitHub-verified email addresses. */
export async function fetchGitHubUserProfile(accessToken: string): Promise<GitHubProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "OpenSourceHQ-Platform",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const userRes = await fetch("https://api.github.com/user", { headers, cache: "no-store" });
  if (!userRes.ok) throw new Error(`Failed to fetch GitHub user profile (${userRes.status}).`);

  const userData = await userRes.json();
  if (!userData.id || !userData.login) throw new Error("GitHub returned an invalid user profile.");

  const numericId = String(userData.id);
  const username = String(userData.login);
  const profileUrl = String(userData.html_url || `https://github.com/${username}`);
  const avatarUrl = userData.avatar_url ? String(userData.avatar_url) : null;
  const name = userData.name ? String(userData.name) : username;
  let primaryEmail: string | null = userData.email ? String(userData.email) : null;
  let verifiedEmail: string | null = null;

  try {
    const emailsRes = await fetch("https://api.github.com/user/emails", { headers, cache: "no-store" });
    if (emailsRes.ok) {
      const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      if (Array.isArray(emails)) {
        const primary = emails.find((email) => email.primary && email.verified);
        const verified = primary || emails.find((email) => email.verified);
        if (verified) {
          verifiedEmail = verified.email;
          primaryEmail = primaryEmail || verified.email;
        }
      }
    }
  } catch {
    // A missing email permission does not invalidate GitHub identity, but it prevents invite auto-enrollment.
  }

  return { numericId, username, name, avatarUrl, profileUrl, primaryEmail, verifiedEmail };
}

/** Rotates an expiring GitHub App user token and its one-time refresh token. */
export async function refreshGitHubUserToken(refreshToken: string): Promise<GitHubUserTokenResponse> {
  const config = getGitHubOAuthConfig();
  if (!config.clientId || !config.clientSecret) throw new Error("GitHub OAuth credentials are not configured.");

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || data.error || !data.access_token) {
    throw new Error("GitHub user token refresh failed. Reconnect the GitHub account.");
  }
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
    refreshTokenExpiresIn: typeof data.refresh_token_expires_in === "number" ? data.refresh_token_expires_in : undefined,
    scope: typeof data.scope === "string" ? data.scope : "",
  };
}

/** Returns a valid decrypted user token, rotating it shortly before expiry when needed. */
export async function getFreshGitHubUserAccessToken(githubAccountId: string): Promise<string> {
  const account = await prisma.gitHubAccount.findUnique({ where: { id: githubAccountId } });
  if (!account || account.connectionStatus !== GitHubConnectionStatus.CONNECTED || !account.tokenCiphertext) {
    throw new Error("GitHub account is not connected.");
  }

  const refreshBeforeMs = 5 * 60 * 1000;
  if (!account.tokenExpiresAt || account.tokenExpiresAt.getTime() > Date.now() + refreshBeforeMs) {
    return decryptToken(account.tokenCiphertext);
  }
  if (!account.refreshTokenCiphertext) {
    await prisma.gitHubAccount.update({ where: { id: account.id }, data: { connectionStatus: GitHubConnectionStatus.EXPIRED } });
    throw new Error("GitHub user token expired. Reconnect the GitHub account.");
  }

  try {
    if (account.refreshTokenExpiresAt && account.refreshTokenExpiresAt.getTime() <= Date.now()) {
      await prisma.gitHubAccount.update({ where: { id: account.id }, data: { connectionStatus: GitHubConnectionStatus.EXPIRED } });
      throw new Error("GitHub refresh token expired. Reconnect the GitHub account.");
    }
    const currentRefreshToken = decryptToken(account.refreshTokenCiphertext);
    if (!currentRefreshToken) throw new Error("Stored GitHub refresh token could not be decrypted. Reconnect the GitHub account.");
    const refreshed = await refreshGitHubUserToken(currentRefreshToken);
    if (!refreshed.refreshToken) throw new Error("GitHub did not return a replacement refresh token.");
    const updated = await prisma.gitHubAccount.update({
      where: { id: account.id },
      data: {
        tokenCiphertext: encryptToken(refreshed.accessToken),
        refreshTokenCiphertext: encryptToken(refreshed.refreshToken),
        tokenExpiresAt: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : null,
        refreshTokenExpiresAt: refreshed.refreshTokenExpiresIn ? new Date(Date.now() + refreshed.refreshTokenExpiresIn * 1000) : null,
        connectionStatus: GitHubConnectionStatus.CONNECTED,
      },
    });
    return decryptToken(updated.tokenCiphertext || "");
  } catch (error) {
    // A concurrent request may already have rotated the refresh token. Use its replacement if available.
    const latest = await prisma.gitHubAccount.findUnique({ where: { id: account.id } });
    if (latest?.tokenExpiresAt && latest.tokenExpiresAt.getTime() > Date.now() + refreshBeforeMs && latest.tokenCiphertext) {
      return decryptToken(latest.tokenCiphertext);
    }
    throw error;
  }
}

export interface ResolveUserResult {
  user: any;
  action: "signed_in" | "linked" | "registered_via_invitation";
  message?: string;
}

/**
 * Resolves or links GitHub identity strictly following identity mapping rules
 */
export async function resolveOrLinkGitHubUser(
  profile: GitHubProfile,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    refreshTokenExpiresIn?: number;
    scope?: string;
  },
  currentUserId?: string
): Promise<ResolveUserResult> {
  const tokenExpiresAt = tokens.expiresIn
    ? new Date(Date.now() + tokens.expiresIn * 1000)
    : null;
  const refreshTokenExpiresAt = tokens.refreshTokenExpiresIn
    ? new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000)
    : null;

  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken
    ? encryptToken(tokens.refreshToken)
    : null;

  // 1. Explicit authenticated account linking flow
  if (currentUserId) {
    const existingOther = await prisma.gitHubAccount.findFirst({
      where: {
        providerUserId: profile.numericId,
        NOT: { userId: currentUserId },
      },
    });

    if (existingOther) {
      throw new Error("This GitHub identity is already linked to a different OpenSourceHQ account.");
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { organization: true },
        },
        platformRole: true,
      },
    });

    if (!user) throw new Error("Authenticated user not found for account linking");
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) throw new Error("SUSPENDED_ACCOUNT");

    // Upsert GitHub account
    await prisma.gitHubAccount.upsert({
      where: { providerUserId: profile.numericId },
      create: {
        userId: currentUserId,
        providerUserId: profile.numericId,
        username: profile.username,
        profileUrl: profile.profileUrl,
        avatarUrl: profile.avatarUrl,
        verifiedEmail: profile.verifiedEmail,
        tokenCiphertext: encryptedAccessToken,
        refreshTokenCiphertext: encryptedRefreshToken,
        tokenExpiresAt,
        refreshTokenExpiresAt,
        lastVerifiedAt: new Date(),
        connectionStatus: GitHubConnectionStatus.CONNECTED,
      },
      update: {
        userId: currentUserId,
        username: profile.username,
        profileUrl: profile.profileUrl,
        avatarUrl: profile.avatarUrl,
        verifiedEmail: profile.verifiedEmail,
        tokenCiphertext: encryptedAccessToken,
        refreshTokenCiphertext: encryptedRefreshToken,
        tokenExpiresAt,
        refreshTokenExpiresAt,
        lastVerifiedAt: new Date(),
        connectionStatus: GitHubConnectionStatus.CONNECTED,
      },
    });

    // Also update user's profile image if none set
    if (!user.imageUrl && profile.avatarUrl) {
      await prisma.user.update({
        where: { id: currentUserId },
        data: { imageUrl: profile.avatarUrl },
      });
    }

    await logAudit({
      organizationId: user.memberships[0]?.organizationId || "global",
      actorId: user.id,
      action: "GITHUB_ACCOUNT_LINKED",
      targetType: "GitHubAccount",
      targetId: profile.numericId,
      metadata: { username: profile.username, numericId: profile.numericId },
    });

    return { user, action: "linked" };
  }

  // 2. Existing linked GitHub user sign in
  const existingLinkedAccount = await prisma.gitHubAccount.findFirst({
    where: {
      OR: [
        { providerUserId: profile.numericId },
        { providerUserId: `gh_${profile.numericId}` },
        { providerUserId: `gh_${profile.username.toLowerCase()}` },
      ],
    },
    include: {
      user: {
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: { organization: true },
          },
          platformRole: true,
        },
      },
    },
  });

  if (existingLinkedAccount) {
    const user = existingLinkedAccount.user;
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
      throw new Error("SUSPENDED_ACCOUNT");
    }

    // Persist the newly issued rotating credentials on every sign-in before
    // returning from any invitation-acceptance branch.
    await prisma.gitHubAccount.update({
      where: { id: existingLinkedAccount.id },
      data: {
        providerUserId: profile.numericId,
        username: profile.username,
        profileUrl: profile.profileUrl,
        avatarUrl: profile.avatarUrl,
        verifiedEmail: profile.verifiedEmail,
        tokenCiphertext: encryptedAccessToken,
        refreshTokenCiphertext: encryptedRefreshToken || existingLinkedAccount.refreshTokenCiphertext,
        tokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshToken ? refreshTokenExpiresAt : existingLinkedAccount.refreshTokenExpiresAt,
        lastVerifiedAt: new Date(),
        connectionStatus: GitHubConnectionStatus.CONNECTED,
      },
    });

    const verifiedEmail = (profile.verifiedEmail || "").toLowerCase().trim();
    if (verifiedEmail) {
      const pendingInvitation = await prisma.invitation.findFirst({
        where: { email: verifiedEmail, acceptedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      if (pendingInvitation) {
        const acceptedInvitation = await prisma.$transaction(async (tx) => {
          const now = new Date();
          const invitation = await tx.invitation.findFirst({
            where: { id: pendingInvitation.id, email: verifiedEmail, acceptedAt: null, expiresAt: { gt: now } },
          });
          if (!invitation) return null;

          const existingMembership = await tx.organizationMembership.findUnique({
            where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
          });
          if (existingMembership?.status === "ACTIVE" && existingMembership.role !== invitation.role) {
            throw new Error("INVITATION_ROLE_CONFLICT");
          }
          if (existingMembership && existingMembership.role !== invitation.role) {
            if (existingMembership.role === OrgRole.MENTEE) {
              await tx.cohortEnrollment.updateMany({ where: { menteeId: user.id, status: "ACTIVE", cohort: { organizationId: invitation.organizationId } }, data: { status: "WITHDRAWN", endedAt: now } });
            } else if (existingMembership.role === OrgRole.MENTOR) {
              await tx.cohortMentor.deleteMany({ where: { mentorId: user.id, cohort: { organizationId: invitation.organizationId } } });
            }
          }

          if (invitation.cohortId) {
            const cohort = await tx.cohort.findFirst({
              where: { id: invitation.cohortId, organizationId: invitation.organizationId, status: "ACTIVE" },
              select: { id: true },
            });
            if (!cohort || !([OrgRole.MENTOR, OrgRole.MENTEE] as OrgRole[]).includes(invitation.role)) {
              throw new Error("INVITATION_COHORT_UNAVAILABLE");
            }
          }

          await tx.organizationMembership.upsert({
            where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
            create: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role, status: "ACTIVE", joinedAt: now },
            update: { role: invitation.role, status: "ACTIVE", joinedAt: now },
          });
          if (invitation.cohortId && invitation.role === OrgRole.MENTOR) {
            await tx.cohortMentor.upsert({
              where: { cohortId_mentorId: { cohortId: invitation.cohortId, mentorId: user.id } },
              create: { cohortId: invitation.cohortId, mentorId: user.id },
              update: {},
            });
          } else if (invitation.cohortId && invitation.role === OrgRole.MENTEE) {
            await tx.cohortEnrollment.upsert({
              where: { cohortId_menteeId: { cohortId: invitation.cohortId, menteeId: user.id } },
              create: { cohortId: invitation.cohortId, menteeId: user.id, status: "ACTIVE" },
              update: { status: "ACTIVE", endedAt: null },
            });
          }

          const consumed = await tx.invitation.updateMany({
            where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now } },
            data: { acceptedAt: now },
          });
          if (consumed.count !== 1) throw new Error("INVITATION_ALREADY_USED");
          return invitation;
        }, { isolationLevel: "Serializable" });

        if (acceptedInvitation) {
          await logAudit({
            organizationId: acceptedInvitation.organizationId,
            actorId: user.id,
            action: "INVITATION_ACCEPTED",
            targetType: "Invitation",
            targetId: acceptedInvitation.id,
            metadata: { provider: "GITHUB", email: verifiedEmail },
          });
          const updatedUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
              memberships: { where: { status: "ACTIVE" }, include: { organization: true } },
              platformRole: true,
            },
          });
          if (updatedUser) return { user: updatedUser, action: "registered_via_invitation" };
        }
      }
    }

    const refreshedLoginUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: { where: { status: "ACTIVE" }, include: { organization: true } },
        platformRole: true,
      },
    });
    if (!refreshedLoginUser) throw new Error("USER_NOT_FOUND_AFTER_GITHUB_LOGIN");

    await logAudit({
      organizationId: refreshedLoginUser.memberships[0]?.organizationId || "global",
      actorId: refreshedLoginUser.id,
      action: "USER_LOGIN_GITHUB",
      targetType: "User",
      targetId: refreshedLoginUser.id,
      metadata: { username: profile.username, numericId: profile.numericId },
    });

    return { user: refreshedLoginUser, action: "signed_in" };
  }

  // 3. Check for pending organization invitations by verified email
  const candidateEmail = (profile.verifiedEmail || "").toLowerCase().trim();
  if (!candidateEmail) throw new Error("UNVERIFIED_GITHUB_EMAIL");

  if (candidateEmail) {
    const pendingInvitation = await prisma.invitation.findFirst({
      where: {
        email: candidateEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: true,
      },
    });

    if (pendingInvitation) {
      const accepted = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const invitation = await tx.invitation.findFirst({
          where: { id: pendingInvitation.id, email: candidateEmail, acceptedAt: null, expiresAt: { gt: now } },
        });
        if (!invitation) return null;

        let user = await tx.user.findUnique({ where: { email: candidateEmail } });
        if (!user) {
          user = await tx.user.create({
            data: {
              name: profile.name || profile.username,
              email: candidateEmail,
              imageUrl: profile.avatarUrl,
              timezone: "UTC",
              status: UserStatus.ACTIVE,
            },
          });
        }
        if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
          throw new Error("SUSPENDED_ACCOUNT");
        }

        const existingMembership = await tx.organizationMembership.findUnique({
          where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
        });
        if (existingMembership?.status === "ACTIVE" && existingMembership.role !== invitation.role) {
          throw new Error("INVITATION_ROLE_CONFLICT");
        }
        if (existingMembership && existingMembership.role !== invitation.role) {
          if (existingMembership.role === OrgRole.MENTEE) {
            await tx.cohortEnrollment.updateMany({ where: { menteeId: user.id, status: "ACTIVE", cohort: { organizationId: invitation.organizationId } }, data: { status: "WITHDRAWN", endedAt: now } });
          } else if (existingMembership.role === OrgRole.MENTOR) {
            await tx.cohortMentor.deleteMany({ where: { mentorId: user.id, cohort: { organizationId: invitation.organizationId } } });
          }
        }
        if (invitation.cohortId) {
          const cohort = await tx.cohort.findFirst({
            where: { id: invitation.cohortId, organizationId: invitation.organizationId, status: "ACTIVE" },
            select: { id: true },
          });
          if (!cohort || !([OrgRole.MENTOR, OrgRole.MENTEE] as OrgRole[]).includes(invitation.role)) {
            throw new Error("INVITATION_COHORT_UNAVAILABLE");
          }
        }

        await tx.gitHubAccount.create({
          data: {
            userId: user.id,
            providerUserId: profile.numericId,
            username: profile.username,
            profileUrl: profile.profileUrl,
            avatarUrl: profile.avatarUrl,
            verifiedEmail: candidateEmail,
            tokenCiphertext: encryptedAccessToken,
            refreshTokenCiphertext: encryptedRefreshToken,
            tokenExpiresAt,
            refreshTokenExpiresAt,
            lastVerifiedAt: now,
            connectionStatus: GitHubConnectionStatus.CONNECTED,
          },
        });
        await tx.organizationMembership.upsert({
          where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
          create: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role, status: "ACTIVE", joinedAt: now },
          update: { role: invitation.role, status: "ACTIVE", joinedAt: now },
        });
        if (invitation.cohortId && invitation.role === OrgRole.MENTOR) {
          await tx.cohortMentor.upsert({
            where: { cohortId_mentorId: { cohortId: invitation.cohortId, mentorId: user.id } },
            create: { cohortId: invitation.cohortId, mentorId: user.id },
            update: {},
          });
        } else if (invitation.cohortId && invitation.role === OrgRole.MENTEE) {
          await tx.cohortEnrollment.upsert({
            where: { cohortId_menteeId: { cohortId: invitation.cohortId, menteeId: user.id } },
            create: { cohortId: invitation.cohortId, menteeId: user.id, status: "ACTIVE" },
            update: { status: "ACTIVE", endedAt: null },
          });
        }
        const consumed = await tx.invitation.updateMany({
          where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now },
        });
        if (consumed.count !== 1) throw new Error("INVITATION_ALREADY_USED");
        return { userId: user.id, invitation };
      }, { isolationLevel: "Serializable" });

      if (!accepted) throw new Error("INVITATION_ALREADY_USED");
      await logAudit({
        organizationId: accepted.invitation.organizationId,
        actorId: accepted.userId,
        action: "INVITATION_ACCEPTED",
        targetType: "Invitation",
        targetId: accepted.invitation.id,
        metadata: { provider: "GITHUB", email: candidateEmail },
      });
      const refreshedUser = await prisma.user.findUnique({
        where: { id: accepted.userId },
        include: {
          memberships: { where: { status: "ACTIVE" }, include: { organization: true } },
          platformRole: true,
        },
      });
      if (!refreshedUser) throw new Error("USER_NOT_FOUND_AFTER_INVITATION");
      return { user: refreshedUser, action: "registered_via_invitation" };

    }
  }

  // 4. Unauthorized User (No invitation and not previously linked)
  // Per Section 4 of PRD: Never auto-merge by email alone; never allow self-assignment of roles.
  throw new Error("NO_INVITATION_OR_MEMBERSHIP");
}

/**
 * Computes role-based redirect target after successful authentication
 */
export function determinePostLoginRedirect(user: SessionUser): string {
  if (user.isPlatformSuperAdmin) {
    if (user.activeOrgSlug) return `/org/${user.activeOrgSlug}/admin`;
    return "/platform";
  }

  // User belongs to an active organization
  if (user.activeOrgSlug) {
    switch (user.activeOrgRole) {
      case OrgRole.ORG_ADMIN:
        return `/org/${user.activeOrgSlug}/admin`;
      case OrgRole.MENTOR:
        return `/org/${user.activeOrgSlug}/mentor`;
      case OrgRole.MENTEE:
        return `/org/${user.activeOrgSlug}/student`;
      case OrgRole.OBSERVER:
        return `/org/${user.activeOrgSlug}/observer`;
      default:
        return "/unauthorized";
    }
  }

  return "/unauthorized";
}

/**
 * Safely disconnects a GitHub account while ensuring account recovery prerequisites
 */
export async function disconnectGitHubAccount(userId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      githubAccounts: true,
      memberships: true,
    },
  });

  if (!user) throw new Error("User not found");
  if (!user.githubAccounts.length) throw new Error("No linked GitHub account found");

  // Security prerequisite: User must have an existing password before disconnecting
  if (!user.passwordHash) {
    throw new Error(
      "Cannot disconnect GitHub account without a recovery password set. Please set a password in your Profile Settings first."
    );
  }

  const accountId = user.githubAccounts[0].id;

  // Disconnect without deleting OpenSourceHQ account
  await prisma.gitHubAccount.update({
    where: { id: accountId },
    data: {
      connectionStatus: GitHubConnectionStatus.DISCONNECTED,
      tokenCiphertext: null,
      refreshTokenCiphertext: null,
      tokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    },
  });

  await logAudit({
    organizationId: user.memberships[0]?.organizationId || "global",
    actorId: user.id,
    action: "GITHUB_ACCOUNT_DISCONNECTED",
    targetType: "GitHubAccount",
    targetId: accountId,
    metadata: { userId },
  });

  return { success: true, message: "GitHub account disconnected successfully." };
}

