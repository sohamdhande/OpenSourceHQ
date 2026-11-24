import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "@/lib/encryption";

describe("Encryption & At-Rest Token Protection", () => {
  it("should encrypt and decrypt a plaintext token accurately", () => {
    const rawToken = "gho_16DigitsRandomOauthAccessTokenForGitHub1234";
    const encrypted = encryptToken(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.length).toBeGreaterThan(32);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it("should return empty string on invalid ciphertext", () => {
    const corrupted = "invalid-ciphertext-string";
    const decrypted = decryptToken(corrupted);
    expect(decrypted).toBe("");
  });
});

