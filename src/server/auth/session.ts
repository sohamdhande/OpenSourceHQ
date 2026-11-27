import crypto from "crypto";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { OrgRole, PlatformRoleType, UserStatus } from "@prisma/client";

export const SESSION_COOKIE_NAME = "oshq_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  imageUrl?: string | null;
  timezone: string;
  status: UserStatus;
  isPlatformSuperAdmin: boolean;
  activeOrgId?: string;
  activeOrgRole?: OrgRole;
  activeOrgSlug?: string;
  activeOrgName?: string;
  selfTrackingEnabled?: boolean;
}

export interface SessionPayload {
  userId: string;
  email: string;
  activeOrgId?: string;
  createdAt: number;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters in production.");
  }
  return secret || "default-dev-secret-at-least-32-chars-long-security";
}

export function signJwt(payload: SessionPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", getAuthSecret())
      .update(`${header}.${body}`)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    // Check expiration (7 days)
    if (Date.now() - payload.createdAt > SESSION_MAX_AGE * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyJwt(token);
  if (!payload || !payload.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      platformRole: true,
      memberships: {
        where: { status: "ACTIVE" },
        include: { organization: true },
      },
    },
  });

  if (!user || user.status === "DEACTIVATED" || user.status === "SUSPENDED") {
    return null;
  }

  // Determine active organization
  let activeOrgId = payload.activeOrgId;
  let activeMembership = user.memberships.find((m) => m.organizationId === activeOrgId);

  if (!activeMembership && user.memberships.length > 0) {
    activeMembership = user.memberships[0];
    activeOrgId = activeMembership.organizationId;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    imageUrl: user.imageUrl,
    timezone: user.timezone,
    status: user.status,
    isPlatformSuperAdmin: user.platformRole?.role === PlatformRoleType.SUPER_ADMIN,
    activeOrgId: activeMembership?.organizationId,
    activeOrgRole: activeMembership?.role,
    activeOrgSlug: activeMembership?.organization.slug,
    activeOrgName: activeMembership?.organization.name,
  };
}

export function createSessionCookie(payload: SessionPayload): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
    maxAge: number;
  };
} {
  const token = signJwt(payload);
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  };
}

