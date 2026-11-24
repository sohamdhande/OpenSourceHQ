import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import prisma from "@/lib/db";
import { RepositoryAddSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { connectRepositoryToOrganization, resolveGitHubRepository } from "@/features/repositories/github-repository-service";

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  if (!(await canManageOrganization(session, params.orgId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = RepositoryAddSchema.safeParse({
      ...(body && typeof body === "object" ? body : {}),
      organizationId: params.orgId,
    });
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });

    const { ownerLogin, name, cohortIds = [] } = parsed.data;
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(ownerLogin) || !/^[A-Za-z0-9_.-]{1,100}$/.test(name)) {
      return NextResponse.json({ error: { code: "INVALID_REPOSITORY", message: "Enter a valid GitHub owner and repository name." } }, { status: 400 });
    }

    const uniqueCohortIds = [...new Set(cohortIds)];
    if (uniqueCohortIds.length) {
      const matchingCohorts = await prisma.cohort.findMany({
        where: { organizationId: params.orgId, id: { in: uniqueCohortIds }, status: "ACTIVE" },
        select: { id: true },
      });
      if (matchingCohorts.length !== uniqueCohortIds.length) {
        return NextResponse.json({ error: { code: "INVALID_COHORT", message: "Every selected cohort must be active and belong to this organization." } }, { status: 400 });
      }
    }

    // Resolve from GitHub using public read access first. Private repositories
    // are accepted only if the repository owner's GitHub App installation has access.
    const remote = await resolveGitHubRepository(params.orgId, `${ownerLogin}/${name}`);
    const repository = await connectRepositoryToOrganization(params.orgId, remote);
    if (uniqueCohortIds.length) {
      await prisma.$transaction(uniqueCohortIds.map((cohortId) => prisma.cohortRepository.upsert({
        where: { cohortId_repositoryId: { cohortId, repositoryId: repository.id } },
        create: { cohortId, repositoryId: repository.id, addedById: session.id, trackingEnabled: true },
        update: { trackingEnabled: true },
      })));
    }

    await logAudit({
      organizationId: params.orgId,
      actorId: session.id,
      action: "REPOSITORY_ADDED",
      targetType: "Repository",
      targetId: repository.id,
      metadata: { fullName: repository.fullName, providerRepositoryId: repository.providerRepositoryId, cohortIds: uniqueCohortIds },
    });

    return NextResponse.json({ success: true, repository });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Repository connection failed.";
    if (message.includes("not found") || message.includes("not accessible")) {
      return NextResponse.json({ error: { code: "GITHUB_REPOSITORY_NOT_FOUND", message } }, { status: 404 });
    }
    if (message.includes("rate limit")) return NextResponse.json({ error: { code: "GITHUB_RATE_LIMIT", message } }, { status: 429 });
    return NextResponse.json({ error: { code: "REPO_ADD_FAILED", message } }, { status: 422 });
  }
}
