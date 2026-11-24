import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getActiveOrganizationMembership, canManageMemberRepositories } from "@/features/repositories/access";
import { connectRepositoryToOrganization, resolveGitHubRepository } from "@/features/repositories/github-repository-service";
import { getFreshGitHubUserAccessToken } from "@/features/github/github-auth-service";
import { GitHubConnectionStatus } from "@prisma/client";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("UNAUTHORIZED", "Sign in required.", 401);
  const organizationId = req.nextUrl.searchParams.get("organizationId") || session.activeOrgId;
  const targetUserId = req.nextUrl.searchParams.get("userId") || req.nextUrl.searchParams.get("menteeId") || session.id;
  if (!organizationId) return jsonError("BAD_REQUEST", "Organization is required.", 400);

  const membership = await getActiveOrganizationMembership(session, organizationId);
  if (!membership && !session.isPlatformSuperAdmin) return jsonError("FORBIDDEN", "Active organization membership required.", 403);
  if (!(await canManageMemberRepositories(session, organizationId, targetUserId))) return jsonError("FORBIDDEN", "You cannot view this member's repositories.", 403);

  const targetMembership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  if (!targetMembership || targetMembership.status !== "ACTIVE") return jsonError("NOT_FOUND", "Active organization member not found.", 404);

  const userRepositories = await prisma.userRepository.findMany({
    where: { organizationId, userId: targetUserId },
    include: { repository: { include: { cohortRepositories: { include: { cohort: true } } } }, assignedBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }],
  });
  return NextResponse.json({ userRepositories, menteeRepositories: userRepositories });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("UNAUTHORIZED", "Sign in required.", 401);

  try {
    const body = await req.json();
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : session.activeOrgId;
    const targetUserId = String(body.userId || body.menteeId || session.id);
    const repositoryId = typeof body.repositoryId === "string" ? body.repositoryId : null;
    const repositoryReference = typeof body.repositoryUrl === "string"
      ? body.repositoryUrl
      : typeof body.repositoryFullName === "string" ? body.repositoryFullName : null;
    if (!organizationId || (!repositoryId && !repositoryReference)) return jsonError("VALIDATION_ERROR", "Organization and a repository URL or ID are required.", 400);

    const actorMembership = await getActiveOrganizationMembership(session, organizationId);
    if (!actorMembership && !session.isPlatformSuperAdmin) return jsonError("FORBIDDEN", "Active organization membership required.", 403);
    if (!(await canManageMemberRepositories(session, organizationId, targetUserId))) return jsonError("FORBIDDEN", "You are not allowed to manage repositories for this member.", 403);

    const targetMembership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: targetUserId } } });
    if (!targetMembership || targetMembership.status !== "ACTIVE") return jsonError("NOT_FOUND", "Target member is not active in this organization.", 404);
    if (targetUserId !== session.id && targetMembership.role !== "MENTEE") return jsonError("VALIDATION_ERROR", "Mentors and administrators may assign repositories to mentees, not other staff members.", 400);

    let repository;
    if (repositoryId) {
      repository = await prisma.repository.findFirst({ where: { id: repositoryId, organizationId } });
      if (!repository) return jsonError("NOT_FOUND", "Repository is not available in this organization.", 404);
    } else {
      // Use the signed-in member's expiring GitHub App user token where possible.
      // This is app authorization, not a personal access token; private access
      // still requires the repository owner's explicit GitHub App installation.
      let accessToken: string | undefined;
      const account = await prisma.gitHubAccount.findFirst({
        where: { userId: session.id, connectionStatus: GitHubConnectionStatus.CONNECTED, tokenCiphertext: { not: null } },
        orderBy: { connectedAt: "desc" }, select: { id: true },
      });
      if (account) {
        try { accessToken = await getFreshGitHubUserAccessToken(account.id); }
        catch { /* Public repository resolution can continue without authentication. */ }
      }
      const remote = await resolveGitHubRepository(organizationId, repositoryReference!, accessToken);
      repository = await connectRepositoryToOrganization(organizationId, remote);
    }

    const assignedById = targetUserId === session.id ? null : session.id;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.userRepository.findUnique({ where: { organizationId_userId_repositoryId: { organizationId, userId: targetUserId, repositoryId: repository.id } } });
      const hasPrimary = await tx.userRepository.findFirst({ where: { organizationId, userId: targetUserId, isPrimary: true }, select: { id: true } });
      const shouldBePrimary = body.isPrimary === true || (!hasPrimary && (!existing || !existing.isPrimary));
      if (shouldBePrimary) {
        await tx.userRepository.updateMany({ where: { organizationId, userId: targetUserId, isPrimary: true }, data: { isPrimary: false } });
      }
      const userRepository = await tx.userRepository.upsert({
        where: { organizationId_userId_repositoryId: { organizationId, userId: targetUserId, repositoryId: repository.id } },
        create: {
          organizationId,
          userId: targetUserId,
          repositoryId: repository.id,
          assignedById,
          isPrimary: shouldBePrimary,
          notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 500) || null : null,
        },
        update: {
          assignedById: assignedById ?? existing?.assignedById ?? null,
          isPrimary: shouldBePrimary || existing?.isPrimary || false,
          notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 500) || null : existing?.notes ?? null,
        },
        include: { repository: true, assignedBy: { select: { id: true, name: true, email: true } } },
      });
      return userRepository;
    }, { isolationLevel: "Serializable" });

    await logAudit({
      organizationId,
      actorId: session.id,
      action: assignedById ? "MENTOR_ASSIGNED_REPOSITORY" : "MEMBER_CHOSE_REPOSITORY",
      targetType: "UserRepository",
      targetId: result.id,
      metadata: { repositoryId: repository.id, repoName: repository.fullName, userId: targetUserId, isPrimary: result.isPrimary },
    });

    return NextResponse.json({ success: true, userRepository: result, menteeRepository: result });
  } catch (error) {
    const dbCode = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : "Unable to add repository.";
    if (dbCode === "P2034" || dbCode === "P2002") {
      return jsonError("REPOSITORY_SELECTION_CONFLICT", "Another repository change happened at the same time. Refresh the list and try again.", 409);
    }
    const status = message.startsWith("Enter a GitHub") || message.startsWith("Archived") ? 400 : message.includes("rate limit") ? 429 : 422;
    return jsonError("REPOSITORY_SELECTION_FAILED", message, status);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("UNAUTHORIZED", "Sign in required.", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return jsonError("VALIDATION_ERROR", "Repository selection ID is required.", 400);

  const existing = await prisma.userRepository.findUnique({ where: { id }, include: { repository: true } });
  if (!existing) return jsonError("NOT_FOUND", "Repository selection not found.", 404);
  if (!(await canManageMemberRepositories(session, existing.organizationId, existing.userId))) return jsonError("FORBIDDEN", "You cannot remove this member's repository.", 403);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userRepository.delete({ where: { id } });
    if (existing.isPrimary) {
      const next = await tx.userRepository.findFirst({ where: { organizationId: existing.organizationId, userId: existing.userId }, orderBy: { assignedAt: "desc" }, select: { id: true } });
        if (next) await tx.userRepository.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2034" || code === "P2002") return jsonError("REPOSITORY_SELECTION_CONFLICT", "The repository list changed at the same time. Refresh and try again.", 409);
    throw error;
  }

  await logAudit({ organizationId: existing.organizationId, actorId: session.id, action: "MEMBER_REMOVED_REPOSITORY", targetType: "UserRepository", targetId: existing.id, metadata: { userId: existing.userId, repository: existing.repository.fullName } });
  return NextResponse.json({ success: true });
}
