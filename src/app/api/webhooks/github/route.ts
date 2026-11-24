import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, processWebhookDelivery } from "@/features/github/github-service";

/**
 * GitHub Webhook Ingestion Endpoint
 * 1. Read raw body
 * 2. Verify HMAC SHA-256 signature
 * 3. Validate delivery ID and event headers
 * 4. Durable idempotent receipt and normalization
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const deliveryId = req.headers.get("x-github-delivery");
  const eventType = req.headers.get("x-github-event");

  if (!deliveryId || !eventType) {
    return NextResponse.json({ error: { code: "MISSING_HEADERS", message: "Missing required GitHub headers" } }, { status: 400 });
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: { code: "WEBHOOK_NOT_CONFIGURED", message: "GitHub webhook verification is not configured." } }, { status: 503 });
  }

  const rawBody = await req.text();
  if (rawBody.length > 25 * 1024 * 1024) {
    return NextResponse.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Webhook payload exceeds the allowed size." } }, { status: 413 });
  }

  if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "HMAC signature verification failed" } }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: { code: "INVALID_PAYLOAD", message: "Webhook payload must be a JSON object." } }, { status: 400 });
    }
    const action = payload.action ? String(payload.action) : null;

    const result = await processWebhookDelivery({
      deliveryId,
      eventType,
      action,
      rawPayload: payload,
    });

    return NextResponse.json({
      received: true,
      deliveryId,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err: unknown) {
    console.error("GitHub webhook processing failed:", err);
    return NextResponse.json({ error: { code: "WEBHOOK_ERROR", message: "Webhook processing failed." } }, { status: 500 });
  }
}

