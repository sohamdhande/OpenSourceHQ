import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { syncSelectedGitHubRepository } from "@/features/github/public-repository-sync";
import { logAudit } from "@/lib/audit";

export async function POST(_req: NextRequest, { params }: { params: { repositoryId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  const repository = await prisma.repository.findUnique({ where: { id: params.repositoryId } });
  if (!repository) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Repository not found" } }, { status: 404 });
  const membership = session.isPlatformSuperAdmin ? null : await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: repository.organizationId, userId: session.id } } });
  if (!session.isPlatformSuperAdmin && membership?.status !== "ACTIVE") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Active organization membership required" } }, { status: 403 });

  let allowed = session.isPlatformSuperAdmin || membership?.role === "ORG_ADMIN";
  if (!allowed) {
    const ownSelection = await prisma.userRepository.findFirst({ where: { organizationId: repository.organizationId, userId: session.id, repositoryId: repository.id }, select: { id: true } });
    allowed = Boolean(ownSelection);
  }
  if (!allowed && membership?.role === "MENTOR") {
    const assignedCohorts = await prisma.cohortMentor.findMany({ where: { mentorId: session.id, cohort: { organizationId: repository.organizationId, status: "ACTIVE" } }, select: { cohortId: true } });
    const cohortIds = assignedCohorts.map((item) => item.cohortId);
    const cohortLink = await prisma.cohortRepository.findFirst({ where: { repositoryId: repository.id, cohortId: { in: cohortIds } }, select: { id: true } });
    const menteeSelection = await prisma.userRepository.findFirst({
      where: {
        organizationId: repository.organizationId,
        repositoryId: repository.id,
        user: {
          memberships: { some: { organizationId: repository.organizationId, role: "MENTEE", status: "ACTIVE" } },
          cohortEnrollments: { some: { cohortId: { in: cohortIds }, status: "ACTIVE", cohort: { status: "ACTIVE", organizationId: repository.organizationId } } },
        },
      },
      select: { id: true },
    });
    allowed = Boolean(cohortLink || menteeSelection);
  }
  if (!allowed) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You can sync only your repositories or repositories in cohorts you administer or mentor" } }, { status: 403 });
  const now = Date.now();
  const recentlySynced = repository.lastSyncedAt && now - repository.lastSyncedAt.getTime() < 30 * 60 * 1000;
  const recentlyFailed = repository.syncStatus === "ERROR" && now - repository.updatedAt.getTime() < 60 * 60 * 1000;
  if (recentlySynced || recentlyFailed) {
    return NextResponse.json({ error: { code: "SYNC_COOLDOWN", message: recentlyFailed ? "The last sync failed. Automatic retry is scheduled after the retry window; check repository access and try again later." : "This repository is polled every 30 minutes to protect GitHub's public API rate limit." } }, { status: 429 });
  }
  try {
    const result = await syncSelectedGitHubRepository(repository.id, repository.organizationId);
    await logAudit({ organizationId: repository.organizationId, actorId: session.id, action: "GITHUB_REPOSITORY_SYNCED", targetType: "Repository", targetId: repository.id, metadata: { activitiesProcessed: result.activitiesProcessed } });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Repository sync failed";
    return NextResponse.json({ error: { code: "GITHUB_SYNC_FAILED", message } }, { status: message.includes("rate limit") ? 429 : 422 });
  }
}
