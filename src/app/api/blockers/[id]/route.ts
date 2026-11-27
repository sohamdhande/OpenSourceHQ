import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { resolveBlocker, reopenBlocker } from "@/features/blockers/blockers-service";
import { BlockerResolveSchema } from "@/lib/schemas";
import prisma from "@/lib/db";

import { canUseSelfTracking } from "@/server/authorization/policies";

async function canViewBlocker(user: NonNullable<Awaited<ReturnType<typeof getSession>>>, blocker: { organizationId: string; menteeId: string; cohortId: string | null; mentorId: string | null; isSelfTracked?: boolean }) {
  if (blocker.isSelfTracked) {
    return blocker.menteeId === user.id && (await canUseSelfTracking(user, blocker.organizationId));
  }
  if (user.isPlatformSuperAdmin) return true;
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: blocker.organizationId, userId: user.id } } });
  if (membership?.status !== "ACTIVE") return false;
  if (membership.role === "ORG_ADMIN") return true;
  if (membership.role === "OBSERVER") return false;
  if (membership.role === "MENTEE") return blocker.menteeId === user.id;
  if (membership.role === "MENTOR") {
    if (!blocker.cohortId) return false;
    return Boolean(await prisma.cohortMentor.findFirst({
      where: { cohortId: blocker.cohortId, mentorId: user.id, cohort: { organizationId: blocker.organizationId, status: "ACTIVE", enrollments: { some: { menteeId: blocker.menteeId, status: "ACTIVE" } } }, mentor: { memberships: { some: { organizationId: blocker.organizationId, role: "MENTOR", status: "ACTIVE" } } } },
    }));
  }
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  const blocker = await prisma.blocker.findUnique({ where: { id: params.id }, include: {
    cohort: true, mentee: { select: { id: true, name: true, email: true, imageUrl: true } }, mentor: { select: { id: true, name: true, email: true } },
  } });
  if (!blocker) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Blocker not found" } }, { status: 404 });
  if (!(await canViewBlocker(session, blocker))) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You cannot view this blocker" } }, { status: 403 });
  return NextResponse.json({ blocker });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "REOPEN") {
      const reopened = await reopenBlocker(session, params.id, typeof body.reason === "string" ? body.reason : undefined);
      return NextResponse.json({ success: true, blocker: reopened });
    }
    const parsed = BlockerResolveSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    const resolved = await resolveBlocker(session, params.id, parsed.data.response, parsed.data.status);
    return NextResponse.json({ success: true, blocker: resolved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update blocker";
    return NextResponse.json({ error: { code: "UPDATE_FAILED", message: msg } }, { status: 403 });
  }
}
