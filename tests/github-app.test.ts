import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGitHubAppJwt,
  createGitHubInstallationState,
  verifyGitHubInstallationState,
} from "@/features/github/github-app-service";

const originalAppId = process.env.GITHUB_APP_ID;
const originalPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;

afterEach(() => {
  if (originalAppId === undefined) delete process.env.GITHUB_APP_ID;
  else process.env.GITHUB_APP_ID = originalAppId;
  if (originalPrivateKey === undefined) delete process.env.GITHUB_APP_PRIVATE_KEY;
  else process.env.GITHUB_APP_PRIVATE_KEY = originalPrivateKey;
});

describe("GitHub App authentication", () => {
  it("creates a signed, short-lived RS256 App JWT", () => {
    const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.GITHUB_APP_ID = "123456";
    process.env.GITHUB_APP_PRIVATE_KEY = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    const jwt = createGitHubAppJwt(1_800_000_000);
    const [headerPart, payloadPart, signaturePart] = jwt.split(".");
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    const valid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${headerPart}.${payloadPart}`),
      pair.publicKey,
      Buffer.from(signaturePart, "base64url")
    );

    expect(header.alg).toBe("RS256");
    expect(payload.iss).toBe("123456");
    expect(payload.iat).toBe(1_799_999_940);
    expect(payload.exp).toBe(1_800_000_540);
    expect(valid).toBe(true);
  });

  it("signs and validates organization installation state", () => {
    const state = createGitHubInstallationState("org-123", "user-456");
    const parsed = verifyGitHubInstallationState(state);
    expect(parsed?.organizationId).toBe("org-123");
    expect(parsed?.userId).toBe("user-456");
    expect(verifyGitHubInstallationState(`${state}tampered`)).toBeNull();
    expect(verifyGitHubInstallationState("invalid")).toBeNull();
  });
});
