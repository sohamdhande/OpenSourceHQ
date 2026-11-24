import prisma from "@/lib/db";
import { SessionUser } from "@/server/auth/session";
import { logAudit } from "@/lib/audit";

export async function listDiscussions(organizationId: string, cohortId?: string | null, allowedCohortIds?: string[] | null) {
  const where: any = { organizationId, isModerated: false };
  if (cohortId) where.cohortId = cohortId;
  else if (allowedCohortIds) where.OR = [{ cohortId: null }, { cohortId: { in: allowedCohortIds } }];
  return prisma.discussionPost.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, imageUrl: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });
}

export async function getDiscussion(postId: string) {
  return prisma.discussionPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, imageUrl: true } },
      cohort: { select: { id: true, name: true } },
      comments: {
        where: { isModerated: false },
        include: {
          author: { select: { id: true, name: true, imageUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createDiscussionPost(
  user: SessionUser,
  organizationId: string,
  title: string,
  content: string,
  cohortId?: string | null
) {
  const post = await prisma.discussionPost.create({
    data: {
      organizationId,
      cohortId,
      authorId: user.id,
      title,
      content,
    },
  });

  await logAudit({
    organizationId,
    actorId: user.id,
    action: "DISCUSSION_POST_CREATED",
    targetType: "DiscussionPost",
    targetId: post.id,
    metadata: { title },
  });

  return post;
}

export async function addDiscussionComment(user: SessionUser, postId: string, content: string, parentId?: string | null) {
  const post = await prisma.discussionPost.findUnique({ where: { id: postId } });
  if (!post || post.isModerated) throw new Error("Discussion post not found.");
  if (post.isLocked) throw new Error("This discussion is locked.");
  const membership = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: post.organizationId, userId: user.id } } });
  if (!user.isPlatformSuperAdmin && membership?.status !== "ACTIVE") throw new Error("Active organization membership is required.");
  if (membership?.role === "OBSERVER") throw new Error("Observers have read-only community access.");
  if (post.cohortId) {
    const cohort = await prisma.cohort.findFirst({ where: { id: post.cohortId, organizationId: post.organizationId, status: "ACTIVE" }, select: { id: true } });
    if (!cohort) throw new Error("This cohort discussion is archived.");
  }
  if (post.cohortId && membership?.role === "MENTEE") {
    const enrollment = await prisma.cohortEnrollment.findUnique({ where: { cohortId_menteeId: { cohortId: post.cohortId, menteeId: user.id } } });
    if (enrollment?.status !== "ACTIVE") throw new Error("You are not enrolled in this cohort.");
  }
  if (post.cohortId && membership?.role === "MENTOR") {
    const assignment = await prisma.cohortMentor.findUnique({ where: { cohortId_mentorId: { cohortId: post.cohortId, mentorId: user.id } } });
    if (!assignment) throw new Error("You are not assigned to this cohort.");
  }
  if (parentId) {
    const parent = await prisma.discussionComment.findUnique({ where: { id: parentId }, select: { postId: true, isModerated: true } });
    if (!parent || parent.postId !== postId || parent.isModerated) throw new Error("Reply target is invalid.");
  }
  const comment = await prisma.discussionComment.create({
    data: {
      postId,
      parentId: parentId || null,
      authorId: user.id,
      content,
    },
    include: {
      author: { select: { id: true, name: true, imageUrl: true } },
    },
  });

  return comment;
}

