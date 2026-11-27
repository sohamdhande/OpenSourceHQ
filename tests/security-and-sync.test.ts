import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { signOAuthState } from "@/features/integrations/gmail-service";
import { computeReportingStreak } from "@/lib/timezone";

describe("Security & Audit Regression Checks", () => {
  let suspendedUserId: string;
  const suspendedEmail = `suspended.login.${Date.now()}@nstsdc.org`;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("TestPassword123!", 10);
    const user = await prisma.user.create({
      data: {
        name: "Suspended User",
        email: suspendedEmail,
        passwordHash,
        status: "SUSPENDED",
      },
    });
    suspendedUserId = user.id;
  });

  afterAll(async () => {
    if (suspendedUserId) {
      await prisma.user.delete({ where: { id: suspendedUserId } }).catch(() => undefined);
    }
  });

  it("blocks suspended users from signing in with password", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: suspendedEmail, password: "TestPassword123!" }),
    });
    const res = await loginPost(req);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error?.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("requires a configured secret for Gmail OAuth state signing in production", () => {
    const origEnv = process.env.NODE_ENV;
    const origApp = process.env.APP_SECRET;
    const origAuth = process.env.AUTH_SECRET;
    const origEnc = process.env.APP_ENCRYPTION_KEY;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.APP_SECRET;
      delete process.env.AUTH_SECRET;
      delete process.env.APP_ENCRYPTION_KEY;

      expect(() =>
        signOAuthState({ orgId: "org1", userId: "user1", timestamp: Date.now(), nonce: "abc" })
      ).toThrow();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
      if (origApp !== undefined) process.env.APP_SECRET = origApp;
      if (origAuth !== undefined) process.env.AUTH_SECRET = origAuth;
      if (origEnc !== undefined) process.env.APP_ENCRYPTION_KEY = origEnc;
    }
  });

  it("computes consecutive reporting streaks accurately", () => {
    const today = new Date("2026-11-27T00:00:00.000Z");
    expect(computeReportingStreak([], today)).toBe(0);

    const consecutive = [
      new Date("2026-11-27T00:00:00.000Z"),
      new Date("2026-11-26T00:00:00.000Z"),
      new Date("2026-11-25T00:00:00.000Z"),
      new Date("2026-11-23T00:00:00.000Z"),
    ];
    expect(computeReportingStreak(consecutive, today)).toBe(3);

    const yesterdayOnly = [
      new Date("2026-11-26T00:00:00.000Z"),
      new Date("2026-11-25T00:00:00.000Z"),
    ];
    expect(computeReportingStreak(yesterdayOnly, today)).toBe(2);
  });
});

