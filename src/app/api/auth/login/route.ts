import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSessionCookie } from "@/server/auth/session";
import { LoginSchema } from "@/lib/schemas";

const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 15;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count += 1;
  return { allowed: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid email or password format" } }, { status: 400 });
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rateCheck = checkLoginRateLimit(`${clientIp}:${normalizedEmail}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: { code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please wait a few minutes and try again." } },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSec ?? 60) } }
      );
    }

    const { password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { organization: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }, { status: 401 });
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: { code: "ACCOUNT_SUSPENDED", message: "Your OpenSourceHQ account is suspended. Contact your organization administrator." } },
        { status: 403 }
      );
    }

    loginAttempts.delete(`${clientIp}:${normalizedEmail}`);

    const activeOrg = user.memberships[0];
    const sessionCookie = createSessionCookie({
      userId: user.id,
      email: user.email,
      activeOrgId: activeOrg?.organizationId,
      createdAt: Date.now(),
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        activeOrgSlug: activeOrg?.organization.slug,
        activeOrgRole: activeOrg?.role,
      },
    });

    res.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

