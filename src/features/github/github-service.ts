import crypto from "crypto";
import prisma from "@/lib/db";
import { GitHubActivityType, WebhookStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";

/**
 * GitHub Integration & Webhook Ingestion Service
 */

export function verifyWebhookSignature(payload: string, signature: string, secret?: string): boolean {
  const webhookSecret = secret || process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;

  const digest = `sha256=${crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex")}`;
  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(digest, "utf8");
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export interface IngestWebhookParams {
  deliveryId: string;
  eventType: string;
  action?: string | null;
  rawPayload: Record<string, unknown>;
}

export async function processWebhookDelivery(params: IngestWebhookParams) {
  // 1. Idempotency check: see if deliveryId already exists
  const existing = await prisma.webhookDelivery.findUnique({
    where: { deliveryId: params.deliveryId },
  });

  if (existing) {
    if (existing.status === WebhookStatus.PROCESSED) {
      return { alreadyProcessed: true, delivery: existing };
    }
  }

  // 2. Persist delivery record
  const delivery = await prisma.webhookDelivery.upsert({
    where: { deliveryId: params.deliveryId },
    create: {
      deliveryId: params.deliveryId,
      eventType: params.eventType,
      action: params.action,
      status: WebhookStatus.PROCESSING,
      attemptCount: 1,
    },
    update: {
      attemptCount: { increment: 1 },
      status: WebhookStatus.PROCESSING,
    },
  });

  try {
    // 3. Normalize supported event into GitHubActivity
    await normalizeAndStoreActivity(params.eventType, params.action, params.rawPayload);

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: WebhookStatus.PROCESSED,
        processedAt: new Date(),
      },
    });

    return { alreadyProcessed: false, delivery };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown webhook processing error";
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: WebhookStatus.FAILED,
        safeErrorCode: errorMsg.substring(0, 200),
      },
    });
    throw err;
  }
}

function webhookDate(value: unknown): Date {
  if (typeof value !== "string" && typeof value !== "number") return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function normalizeAndStoreActivity(
  eventType: string,
  action: string | undefined | null,
  payload: Record<string, unknown>
) {
  if (eventType === "installation") {
    const installationData = payload.installation as Record<string, unknown> | undefined;
    const installationId = installationData?.id ? String(installationData.id) : "";
    if (!installationId) return;
    const suspended = action === "suspend" || action === "deleted";
    await prisma.gitHubInstallation.updateMany({
      where: { providerInstallationId: installationId },
      data: { suspendedAt: suspended ? new Date() : null },
    });
    return;
  }

  const repoData = payload.repository as Record<string, unknown> | undefined;
  const senderData = payload.sender as Record<string, unknown> | undefined;
  if (!repoData) return;

  const repoFullName = String(repoData.full_name || "");
  const repoProviderId = repoData.id ? String(repoData.id) : "";
  const installationData = payload.installation as Record<string, unknown> | undefined;
  const installationId = installationData?.id ? String(installationData.id) : "";
  if (!installationId) return; // Repository webhooks must be attributable to a known installation.
  const installation = await prisma.gitHubInstallation.findUnique({ where: { providerInstallationId: installationId }, select: { organizationId: true, suspendedAt: true } });
  if (!installation || installation.suspendedAt) return;
  const repository = await prisma.repository.findFirst({
    where: {
      organizationId: installation.organizationId,
      OR: [
        ...(repoFullName ? [{ fullName: repoFullName }] : []),
        ...(repoProviderId ? [{ providerRepositoryId: repoProviderId }] : []),
      ],
    },
  });
  if (!repository) return; // Ignore repositories not tracked in OpenSourceHQ.

  // Prefer the immutable numeric GitHub user ID; legacy seed identifiers remain a migration fallback.
  const senderGithubId = senderData?.id ? String(senderData.id) : null;
  let githubAccount = null;
  if (senderGithubId) {
    const senderLogin = senderData?.login ? String(senderData.login).toLowerCase() : "";
    githubAccount = await prisma.gitHubAccount.findFirst({
      where: {
        OR: [
          { providerUserId: senderGithubId },
          { providerUserId: `gh_${senderGithubId}` },
          ...(senderLogin ? [{ providerUserId: `gh_${senderLogin}` }] : []),
        ],
      },
    });
  }

  const persistActivity = async (input: {
    providerEventId: string;
    activityType: GitHubActivityType;
    title: string;
    summary?: string | null;
    url?: string | null;
    occurredAt?: Date;
    metadata?: Record<string, string | number | boolean | null>;
  }) => {
    await prisma.gitHubActivity.upsert({
      where: { organizationId_providerEventId: { organizationId: repository.organizationId, providerEventId: input.providerEventId } },
      create: {
        organizationId: repository.organizationId,
        repositoryId: repository.id,
        githubAccountId: githubAccount?.id,
        providerEventId: input.providerEventId,
        activityType: input.activityType,
        title: input.title.slice(0, 240),
        summary: input.summary?.slice(0, 1000) ?? null,
        url: input.url || null,
        occurredAt: input.occurredAt || new Date(),
        isFixture: false,
        metadata: input.metadata || undefined,
      },
      update: {},
    });
  };

  if (eventType === "push") {
    const commits = Array.isArray(payload.commits) ? payload.commits as Array<Record<string, unknown>> : [];
    for (const commit of commits) {
      const commitSha = String(commit.id || "");
      if (!commitSha) continue;
      const message = String(commit.message || "");
      await persistActivity({
        providerEventId: `commit_${commitSha}`,
        activityType: GitHubActivityType.COMMIT,
        title: `Commit: ${message.split("\n")[0] || commitSha.slice(0, 8)}`,
        summary: message,
        url: typeof commit.url === "string" ? commit.url : null,
        occurredAt: webhookDate(commit.timestamp),
      });
    }
    return;
  }

  if (eventType === "pull_request") {
    if (action !== "opened" && action !== "closed" && action !== "reopened") return;
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    if (!pr || pr.number === undefined) return;

    let activityType: GitHubActivityType = GitHubActivityType.PULL_REQUEST_OPENED;
    if (action === "closed" && pr.merged === true) activityType = GitHubActivityType.PULL_REQUEST_MERGED;
    else if (action === "closed") activityType = GitHubActivityType.PULL_REQUEST_CLOSED;

    const number = String(pr.number);
    const verb = action === "reopened" ? "reopened" : action;
    await persistActivity({
      providerEventId: `pr_${repository.id}_${number}_${action}`,
      activityType,
      title: `PR #${number} ${verb}: ${String(pr.title || "")}`,
      summary: String(pr.body || ""),
      url: typeof pr.html_url === "string" ? pr.html_url : null,
      occurredAt: webhookDate(action === "closed" ? pr.closed_at : action === "reopened" ? pr.updated_at : pr.created_at),
      metadata: { number: Number(pr.number), action: action || "" },
    });
    return;
  }

  if (eventType === "issues") {
    if (action !== "opened" && action !== "closed" && action !== "reopened") return;
    const issue = payload.issue as Record<string, unknown> | undefined;
    if (!issue || issue.number === undefined) return;
    const activityType = action === "closed" ? GitHubActivityType.ISSUE_CLOSED : GitHubActivityType.ISSUE_OPENED;
    const number = String(issue.number);
    await persistActivity({
      providerEventId: `issue_${repository.id}_${number}_${action}`,
      activityType,
      title: `Issue #${number} ${action}: ${String(issue.title || "")}`,
      summary: String(issue.body || ""),
      url: typeof issue.html_url === "string" ? issue.html_url : null,
      occurredAt: webhookDate(action === "closed" ? issue.closed_at : action === "reopened" ? issue.updated_at : issue.created_at),
      metadata: { number: Number(issue.number), action: action || "" },
    });
    return;
  }

  if (eventType === "pull_request_review" && action === "submitted") {
    const review = payload.review as Record<string, unknown> | undefined;
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    if (!review?.id) return;
    const number = pr?.number === undefined ? "unknown" : String(pr.number);
    await persistActivity({
      providerEventId: `review_${String(review.id)}`,
      activityType: GitHubActivityType.REVIEW_SUBMITTED,
      title: `Review submitted on PR #${number}`,
      summary: String(review.body || review.state || ""),
      url: typeof review.html_url === "string" ? review.html_url : (typeof pr?.html_url === "string" ? pr.html_url : null),
      occurredAt: webhookDate(review.submitted_at),
      metadata: { pullRequestNumber: number, state: String(review.state || "") },
    });
    return;
  }

  if (eventType === "issue_comment" && action === "created") {
    const comment = payload.comment as Record<string, unknown> | undefined;
    const issue = payload.issue as Record<string, unknown> | undefined;
    if (!comment?.id) return;
    const number = issue?.number === undefined ? "unknown" : String(issue.number);
    await persistActivity({
      providerEventId: `comment_${String(comment.id)}`,
      activityType: GitHubActivityType.COMMENT_CREATED,
      title: `Comment on #${number}`,
      summary: String(comment.body || ""),
      url: typeof comment.html_url === "string" ? comment.html_url : (typeof issue?.html_url === "string" ? issue.html_url : null),
      occurredAt: webhookDate(comment.created_at),
      metadata: { issueNumber: number },
    });
    return;
  }

  if (eventType === "release" && action === "published") {
    const release = payload.release as Record<string, unknown> | undefined;
    if (!release?.id) return;
    await persistActivity({
      providerEventId: `release_${String(release.id)}`,
      activityType: GitHubActivityType.RELEASE_PUBLISHED,
      title: `Release published: ${String(release.name || release.tag_name || "")}`,
      summary: String(release.body || ""),
      url: typeof release.html_url === "string" ? release.html_url : null,
      occurredAt: webhookDate(release.published_at),
      metadata: { tagName: String(release.tag_name || "") },
    });
  }
}

export function isGitHubConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_WEBHOOK_SECRET);
}
