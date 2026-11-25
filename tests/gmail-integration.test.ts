import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateGoogleOAuthUrl,
  signOAuthState,
  verifyOAuthState,
  getGoogleOAuthClientConfig,
} from "../src/features/integrations/gmail-service";
import { encryptToken, decryptToken } from "../src/lib/encryption";
import fs from "fs";
import path from "path";

describe("Gmail OAuth Integration & Security", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "mock-google-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "mock-google-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/integrations/google/callback";
    process.env.APP_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.APP_SECRET = "mock-app-secret-at-least-32-chars-long";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("1 & 2. reads GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI from environment variables", () => {
    const config = getGoogleOAuthClientConfig();
    expect(config.clientId).toBe("mock-google-client-id.apps.googleusercontent.com");
    expect(config.clientSecret).toBe("mock-google-client-secret");
    expect(config.redirectUri).toBe("http://localhost:3000/api/integrations/google/callback");
  });

  it("3. requests openid, email and gmail.send scopes", () => {
    const { url } = generateGoogleOAuthUrl({
      orgId: "org-123",
      userId: "user-456",
    });

    const parsed = new URL(url);
    const scope = parsed.searchParams.get("scope") || "";
    expect(scope).toContain("openid");
    expect(scope).toContain("email");
    expect(scope).toContain("https://www.googleapis.com/auth/gmail.send");
  });

  it("4. requests offline access and consent prompt for refresh token handling", () => {
    const { url } = generateGoogleOAuthUrl({
      orgId: "org-123",
      userId: "user-456",
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("mock-google-client-id.apps.googleusercontent.com");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/integrations/google/callback");
  });

  it("5. ensures refresh tokens are encrypted at rest with AES-256-GCM and decryptable", () => {
    const plaintextRefreshToken = "1//04mock_refresh_token_abcdef123456";
    const ciphertext = encryptToken(plaintextRefreshToken);

    expect(ciphertext).not.toBe(plaintextRefreshToken);
    expect(ciphertext.length).toBeGreaterThan(30);

    const decrypted = decryptToken(ciphertext);
    expect(decrypted).toBe(plaintextRefreshToken);
  });

  it("6. validates HMAC-signed OAuth state and detects tampering or user mismatch", () => {
    const statePayload = {
      orgId: "org-123",
      userId: "admin-789",
      timestamp: Date.now(),
      nonce: "random-nonce-123",
    };

    const state = signOAuthState(statePayload);
    expect(state).toContain(".");

    // Valid state verification
    const verified = verifyOAuthState(state, "admin-789");
    expect(verified.orgId).toBe("org-123");
    expect(verified.userId).toBe("admin-789");

    // Rejection on user mismatch
    expect(() => verifyOAuthState(state, "attacker-999")).toThrow("STATE_USER_MISMATCH");

    // Rejection on signature tampering
    const tampered = state.slice(0, -4) + "XXXX";
    expect(() => verifyOAuthState(tampered, "admin-789")).toThrow();

    // Rejection on expired timestamp (> 10 minutes)
    const expiredState = signOAuthState({
      ...statePayload,
      timestamp: Date.now() - 15 * 60 * 1000,
    });
    expect(() => verifyOAuthState(expiredState, "admin-789")).toThrow("STATE_EXPIRED");
  });

  it("7. verifies .env.local and .env are gitignored", () => {
    const gitignorePath = path.resolve(process.cwd(), ".gitignore");
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");

    expect(gitignoreContent).toMatch(/\.env/);
    expect(gitignoreContent).toMatch(/\.env\.local/);
  });
});

