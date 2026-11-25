import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { canManageOrganization } from "@/server/authorization/policies";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const RepositoryUpdateSchema = z.object({
  description: z.string().max(500).optional().nullable(),
  syncStatus: z.enum(["ACTIVE", "PAUSED", "PENDING", "ERROR"]).optional(),
  cohortIds: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string; repositoryId: string } }
) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);
  if (!(await canManageOrganization(session, params.orgId))) {
    return apiError("FORBIDDEN", "Admin access required", 403);
  }

  const repository = await prisma.repository.findFirst({
    where: { id: params.repositoryId, organizationId: params.orgId },
    include: {
      cohortRepositories: { include: { cohort: true } },
      _count: { select: { activities: true, tasks: true } },
    },
  });

  if (!repository) return apiError("NOT_FOUND", "Repository not found", 404);
  return NextResponse.json({ repository });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgId: string; repositoryId: string } }
) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);
  if (!(await canManageOrganization(session, params.orgId))) {
    return apiError("FORBIDDEN", "Admin access required", 403);
  }

  const existing = await prisma.repository.findFirst({
    where: { id: params.repositoryId, organizationId: params.orgId },
  });
  if (!existing) return apiError("NOT_FOUND", "Repository not found", 404);

  try {
    const body: unknown = await req.json();
    const parsed = RepositoryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.message, 400);
    }

    const { description, syncStatus, cohortIds } = parsed.data;

    // Validate cohortIds belong to this organization if provided
    let uniqueCohortIds: string[] | undefined = undefined;
    if (cohortIds !== undefined) {
      uniqueCohortIds = [...new Set(cohortIds)];
      if (uniqueCohortIds.length > 0) {
        const validCohorts = await prisma.cohort.findMany({
          where: { organizationId: params.orgId, id: { in: uniqueCohortIds } },
          select: { id: true },
        });
        if (validCohorts.length !== uniqueCohortIds.length) {
          return apiError("INVALID_COHORTS", "One or more selected cohorts do not belong to this organization", 400);
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update basic repository fields
      await tx.repository.update({
        where: { id: params.repositoryId },
        data: {
          ...(description !== undefined ? { description: description?.trim() || null } : {}),
          ...(syncStatus !== undefined ? { syncStatus } : {}),
        },
      });

      // 2. Sync associated cohorts if provided
      if (uniqueCohortIds !== undefined) {
        // Delete associations not in the new list
        await tx.cohortRepository.deleteMany({
          where: {
            repositoryId: params.repositoryId,
            cohortId: { notIn: uniqueCohortIds },
          },
        });

        // Upsert associations in the list
        for (const cId of uniqueCohortIds) {
          await tx.cohortRepository.upsert({
            where: {
              cohortId_repositoryId: {
                cohortId: cId,
                repositoryId: params.repositoryId,
              },
            },
            create: {
              cohortId: cId,
              repositoryId: params.repositoryId,
              addedById: session.id,
              trackingEnabled: syncStatus ? syncStatus === "ACTIVE" : true,
            },
            update: {
              trackingEnabled: syncStatus ? syncStatus === "ACTIVE" : undefined,
            },
          });
        }
      } else if (syncStatus !== undefined) {
        // If only syncStatus was changed, update trackingEnabled on cohort links
        await tx.cohortRepository.updateMany({
          where: { repositoryId: params.repositoryId },
          data: { trackingEnabled: syncStatus === "ACTIVE" },
        });
      }

      return tx.repository.findUnique({
        where: { id: params.repositoryId },
        include: {
          cohortRepositories: { include: { cohort: { select: { id: true, name: true } } } },
          _count: { select: { activities: true, tasks: true } },
        },
      });
    });

    await logAudit({
      organizationId: params.orgId,
      actorId: session.id,
      action: "REPOSITORY_UPDATED",
      targetType: "Repository",
      targetId: params.repositoryId,
      metadata: {
        fullName: existing.fullName,
        syncStatus,
        cohortCount: uniqueCohortIds?.length,
      },
    });

    return NextResponse.json({ success: true, repository: updated });
  } catch (err: unknown) {
    console.error("Failed to update repository:", err);
    return apiError("INTERNAL_ERROR", "Failed to update repository", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { orgId: string; repositoryId: string } }
) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required", 401);
  if (!(await canManageOrganization(session, params.orgId))) {
    return apiError("FORBIDDEN", "Admin access required", 403);
  }

  const existing = await prisma.repository.findFirst({
    where: { id: params.repositoryId, organizationId: params.orgId },
  });
  if (!existing) return apiError("NOT_FOUND", "Repository not found", 404);

  try {
    await prisma.repository.delete({
      where: { id: params.repositoryId },
    });

    await logAudit({
      organizationId: params.orgId,
      actorId: session.id,
      action: "REPOSITORY_REMOVED",
      targetType: "Repository",
      targetId: params.repositoryId,
      metadata: { fullName: existing.fullName },
    });

    return NextResponse.json({ success: true, message: "Repository untracked and removed." });
  } catch (err: unknown) {
    console.error("Failed to delete repository:", err);
    return apiError("INTERNAL_ERROR", "Failed to delete repository", 500);
  }
}

