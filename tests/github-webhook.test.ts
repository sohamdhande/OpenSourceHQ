import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyWebhookSignature } from "@/features/github/github-service";

describe("GitHub Webhook HMAC Signature & Idempotency", () => {
  const secret = "test-webhook-secret-key-123";
  const payload = JSON.stringify({
    action: "opened",
    pull_request: { number: 42, title: "Fix memory barrier" },
  });

  it("should verify valid HMAC SHA-256 signature", () => {
    const hmac = crypto.createHmac("sha256", secret);
    const validSignature = `sha256=${hmac.update(payload).digest("hex")}`;

    const isValid = verifyWebhookSignature(payload, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it("should reject tampered or invalid HMAC signature", () => {
    const invalidSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
    const isValid = verifyWebhookSignature(payload, invalidSignature, secret);
    expect(isValid).toBe(false);
  });

  it("should reject signature when secret is missing", () => {
    const isValid = verifyWebhookSignature(payload, "sha256=123", "");
    expect(isValid).toBe(false);
  });
});

