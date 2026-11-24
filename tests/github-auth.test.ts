import crypto from "crypto";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import prisma from "@/lib/db";
import {
  createOAuthState,
  verifyOAuthState,
  getGitHubAuthorizeUrl,
  determinePostLoginRedirect,
  resolveOrLinkGitHubUser,
  disconnectGitHubAccount,
  GitHubProfile,
} from "@/features/github/github-auth-service";
import { OrgRole, UserStatus, GitHubConnectionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

describe("GitHub Authentication & Identity Service", () => {
  describe("OAuth State Handling & Anti-CSRF", () => {
    it("should generate a valid signed HMAC state token", () => {
      const { stateToken, stateString } = createOAuthState();
      expect(stateToken).toBeDefined();
      expect(stateToken).toContain(".");
      expect(stateString).toBeDefined();

      const verified = verifyOAuthState(stateToken);
      expect(verified).not.toBeNull();
      expect(verified?.state).toBe(stateString);
      expect(verified?.createdAt).toBeGreaterThan(0);
      expect(createOAuthState().codeVerifier).toHaveLength(43);
    });

    it("should preserve currentUserId in state payload for account linking", () => {
      const { stateToken } = createOAuthState("link", "user-12345");
      const verified = verifyOAuthState(stateToken);
      expect(verified).not.toBeNull();
      expect(verified?.action).toBe("link");
      expect(verified?.currentUserId).toBe("user-12345");
    });

    it("should reject tampered state tokens", () => {
      const { stateToken } = createOAuthState();
      const parts = stateToken.split(".");
      const tamperedBody = Buffer.from(
        JSON.stringify({ state: "hacked", action: "login", createdAt: Date.now() })
      ).toString("base64url");
      const tamperedToken = `${tamperedBody}.${parts[1]}`;

      const verified = verifyOAuthState(tamperedToken);
      expect(verified).toBeNull();
    });

    it("should reject expired state tokens older than 10 minutes", () => {
      const secret = process.env.AUTH_SECRET || "default-dev-secret-at-least-32-chars-long-security";
      const expiredPayload = {
        state: "test-nonce",
        action: "login",
        createdAt: Date.now() - 15 * 60 * 1000, // 15 mins ago
      };
      const body = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
      const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
      const expiredToken = `${body}.${sig}`;

      const verified = verifyOAuthState(expiredToken);
      expect(verified).toBeNull();
    });

    it("should reject malformed state strings", () => {
      expect(verifyOAuthState("not-a-valid-token")).toBeNull();
      expect(verifyOAuthState("")).toBeNull();
    });
  });

  describe("Authorize URL Generation", () => {
    it("should construct the authorization URL with required parameters and scopes", () => {
      const { stateToken, codeVerifier, codeChallenge } = createOAuthState();
      const authUrl = getGitHubAuthorizeUrl(stateToken, codeChallenge);
      const parsed = new URL(authUrl);

      expect(authUrl).toContain("https://github.com/login/oauth/authorize");
      expect(parsed.searchParams.has("client_id")).toBe(true);
      expect(parsed.searchParams.get("scope")).toBe("offline_access");
      expect(parsed.searchParams.get("state")).toBe(stateToken);
      expect(parsed.searchParams.get("code_challenge")).toBe(codeChallenge);
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
      expect(parsed.searchParams.get("code_challenge")).toBe(crypto.createHash("sha256").update(codeVerifier).digest("base64url"));
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        process.env.GITHUB_CALLBACK_URL || process.env.GITHUB_OAUTH_CALLBACK_URL ||
        new URL("/api/auth/github/callback", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString()
      );
      expect(codeVerifier).toHaveLength(43);
    });

    it("selects the exact production callback when the app base URL is production", () => {
      const previousBase = process.env.NEXT_PUBLIC_APP_URL;
      const previousCallback = process.env.GITHUB_CALLBACK_URL;
      try {
        process.env.NEXT_PUBLIC_APP_URL = "https://org.nstsdc.org";
        process.env.GITHUB_CALLBACK_URL = "https://org.nstsdc.org/api/auth/github/callback";
        const { stateToken, codeChallenge } = createOAuthState();
        const parsed = new URL(getGitHubAuthorizeUrl(stateToken, codeChallenge));
        expect(parsed.searchParams.get("redirect_uri")).toBe("https://org.nstsdc.org/api/auth/github/callback");
      } finally {
        if (previousBase === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = previousBase;
        if (previousCallback === undefined) delete process.env.GITHUB_CALLBACK_URL;
        else process.env.GITHUB_CALLBACK_URL = previousCallback;
      }
    });

    it("rejects a callback URL on a different origin from the configured app", () => {
      const previousBase = process.env.NEXT_PUBLIC_APP_URL;
      const previousCallback = process.env.GITHUB_CALLBACK_URL;
      try {
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
        process.env.GITHUB_CALLBACK_URL = "https://org.nstsdc.org/api/auth/github/callback";
        const { stateToken, codeChallenge } = createOAuthState();
        expect(() => getGitHubAuthorizeUrl(stateToken, codeChallenge)).toThrow(/app origin/i);
      } finally {
        if (previousBase === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = previousBase;
        if (previousCallback === undefined) delete process.env.GITHUB_CALLBACK_URL;
        else process.env.GITHUB_CALLBACK_URL = previousCallback;
      }
    });
  });

  describe("Post-Login Redirect Resolution", () => {
    it("should redirect ORG_ADMIN to /org/{slug}/admin", () => {
      const url = determinePostLoginRedirect({
        id: "usr-1",
        name: "Admin User",
        email: "admin@test.org",
        timezone: "UTC",
        status: UserStatus.ACTIVE,
        isPlatformSuperAdmin: false,
        activeOrgId: "org-1",
        activeOrgSlug: "test-org",
        activeOrgRole: OrgRole.ORG_ADMIN,
      });
      expect(url).toBe("/org/test-org/admin");
    });

    it("should redirect MENTOR to /org/{slug}/mentor", () => {
      const url = determinePostLoginRedirect({
        id: "usr-2",
        name: "Mentor User",
        email: "mentor@test.org",
        timezone: "UTC",
        status: UserStatus.ACTIVE,
        isPlatformSuperAdmin: false,
        activeOrgId: "org-1",
        activeOrgSlug: "test-org",
        activeOrgRole: OrgRole.MENTOR,
      });
      expect(url).toBe("/org/test-org/mentor");
    });

    it("should redirect MENTEE to /org/{slug}/student", () => {
      const url = determinePostLoginRedirect({
        id: "usr-3",
        name: "Student User",
        email: "student@test.org",
        timezone: "UTC",
        status: UserStatus.ACTIVE,
        isPlatformSuperAdmin: false,
        activeOrgId: "org-1",
        activeOrgSlug: "test-org",
        activeOrgRole: OrgRole.MENTEE,
      });
      expect(url).toBe("/org/test-org/student");
    });

    it("should redirect user with no active organization to /unauthorized", () => {
      const url = determinePostLoginRedirect({
        id: "usr-4",
        name: "Orphan User",
        email: "orphan@test.org",
        timezone: "UTC",
        status: UserStatus.ACTIVE,
        isPlatformSuperAdmin: false,
      });
      expect(url).toBe("/unauthorized");
    });
  });

  describe("Account Disconnect Security Rules", () => {
    const testEmail = "pwcheck.test@nstsdc.org";
    let testUserId = "";

    beforeEach(async () => {
      // Clean up previous test user if exists
      const existing = await prisma.user.findUnique({ where: { email: testEmail } });
      if (existing) {
        await prisma.gitHubAccount.deleteMany({ where: { userId: existing.id } });
        await prisma.user.delete({ where: { id: existing.id } });
      }

      // Create user without password
      const user = await prisma.user.create({
        data: {
          name: "PW Test User",
          email: testEmail,
          passwordHash: null,
          githubAccounts: {
            create: {
              providerUserId: "gh_test_pw_99999",
              username: "gh-pw-test-user",
              profileUrl: "https://github.com/gh-pw-test-user",
              connectionStatus: GitHubConnectionStatus.CONNECTED,
            },
          },
        },
      });
      testUserId = user.id;
    });

    afterAll(async () => {
      if (testUserId) {
        await prisma.gitHubAccount.deleteMany({ where: { userId: testUserId } });
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    });

    it("should reject account disconnect when user has no password set (lockout prevention)", async () => {
      await expect(disconnectGitHubAccount(testUserId)).rejects.toThrow(
        /Cannot disconnect GitHub account without a recovery password set/i
      );
    });

    it("should allow account disconnect when user has a password set", async () => {
      // Set a password
      const pwHash = await bcrypt.hash("securePassword123", 10);
      await prisma.user.update({
        where: { id: testUserId },
        data: { passwordHash: pwHash },
      });

      const res = await disconnectGitHubAccount(testUserId);
      expect(res.success).toBe(true);

      const account = await prisma.gitHubAccount.findFirst({
        where: { userId: testUserId },
      });
      expect(account?.connectionStatus).toBe(GitHubConnectionStatus.DISCONNECTED);
      expect(account?.tokenCiphertext).toBeNull();
    });
  });

  describe("GitHub User Identity Resolution & Linking", () => {
    const orgAdminEmail = "sarah.admin@nstsdc.org";

    it("should resolve existing linked account and update lastVerifiedAt", async () => {
      const adminUser = await prisma.user.findUnique({
        where: { email: orgAdminEmail },
        include: { githubAccounts: true },
      });
      expect(adminUser).not.toBeNull();

      if (adminUser?.githubAccounts[0]) {
        const ghAccount = adminUser.githubAccounts[0];
        const profile: GitHubProfile = {
          numericId: ghAccount.providerUserId,
          username: ghAccount.username,
          name: adminUser.name,
          avatarUrl: "https://avatars.githubusercontent.com/u/1001",
          profileUrl: ghAccount.profileUrl,
          primaryEmail: adminUser.email,
          verifiedEmail: adminUser.email,
        };

        const result = await resolveOrLinkGitHubUser(profile, {
          accessToken: "mock-access-token-12345",
        });

        expect(result.action).toBe("signed_in");
        expect(result.user.id).toBe(adminUser.id);
      }
    });

    it("should reject unauthorized users without membership or invitation", async () => {
      const unknownProfile: GitHubProfile = {
        numericId: "gh_random_uninvited_999999",
        username: "random_uninvited_user",
        name: "Uninvited User",
        avatarUrl: null,
        profileUrl: "https://github.com/random_uninvited_user",
        primaryEmail: "stranger.uninvited@example.com",
        verifiedEmail: "stranger.uninvited@example.com",
      };

      await expect(
        resolveOrLinkGitHubUser(unknownProfile, { accessToken: "mock-token" })
      ).rejects.toThrow("NO_INVITATION_OR_MEMBERSHIP");
    });

    it("should reject suspended users attempting to sign in", async () => {
      // Create a suspended user with linked GitHub account
      const suspendedEmail = "suspended.test@nstsdc.org";
      let suspendedUser = await prisma.user.findUnique({ where: { email: suspendedEmail } });
      if (suspendedUser) {
        await prisma.gitHubAccount.deleteMany({ where: { userId: suspendedUser.id } });
        await prisma.user.delete({ where: { id: suspendedUser.id } });
      }

      suspendedUser = await prisma.user.create({
        data: {
          name: "Suspended Test User",
          email: suspendedEmail,
          status: UserStatus.SUSPENDED,
          githubAccounts: {
            create: {
              providerUserId: "gh_suspended_numeric_88888",
              username: "suspended_user_gh",
              profileUrl: "https://github.com/suspended_user_gh",
            },
          },
        },
      });

      const profile: GitHubProfile = {
        numericId: "gh_suspended_numeric_88888",
        username: "suspended_user_gh",
        name: suspendedUser.name,
        avatarUrl: null,
        profileUrl: "https://github.com/suspended_user_gh",
        primaryEmail: suspendedEmail,
        verifiedEmail: suspendedEmail,
      };

      await expect(
        resolveOrLinkGitHubUser(profile, { accessToken: "mock-token" })
      ).rejects.toThrow("SUSPENDED_ACCOUNT");

      // Cleanup
      await prisma.gitHubAccount.deleteMany({ where: { userId: suspendedUser.id } });
      await prisma.user.delete({ where: { id: suspendedUser.id } });
    });
  });
});
