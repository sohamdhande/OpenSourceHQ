import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

interface LogAuditParams {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Append-only security audit log recorder
 * Redacts secrets, tokens, passwords, cookies, and sensitive content
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const safeMetadata = params.metadata ? sanitizeMetadata(params.metadata) : undefined;

    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: safeMetadata as Prisma.InputJsonValue | undefined,
        requestId: params.requestId,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "secret",
  "key",
  "cookie",
  "authorization",
  "tokenciphertext",
  "privatekey",
]);

function sanitizeMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      result[key] = sanitizeMetadata(val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }

  return result;
}

