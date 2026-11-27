import crypto from "crypto";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { encryptToken, decryptToken } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";

export interface GmailSettings {
  connected: boolean;
  email?: string;
  refreshTokenCiphertext?: string;
  scope?: string;
  connectedAt?: string;
  connectedByUserId?: string;
}

export function getGoogleOAuthClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

  return { clientId, clientSecret, redirectUri };
}

function getSecretKey(): string {
  const secret =
    process.env.APP_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.APP_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("APP_SECRET, AUTH_SECRET, or APP_ENCRYPTION_KEY (32+ chars) must be configured in production.");
  }
  return secret || "development-oauth-state-signing-key-minimum-32-chars";
}

export interface GoogleOAuthState {
  orgId: string;
  userId: string;
  timestamp: number;
  nonce: string;
}

/**
 * Generates an HMAC-signed state parameter to prevent CSRF during Google OAuth.
 */
export function signOAuthState(payload: GoogleOAuthState): string {
  const serialized = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", getSecretKey());
  hmac.update(serialized);
  const signature = hmac.digest("base64url");
  const data = Buffer.from(serialized).toString("base64url");
  return `${data}.${signature}`;
}

/**
 * Validates and decodes the HMAC-signed state parameter.
 * Enforces 10-minute expiry and matching user id.
 */
export function verifyOAuthState(state: string, currentUserId: string): GoogleOAuthState {
  if (!state || !state.includes(".")) {
    throw new Error("INVALID_STATE_FORMAT");
  }

  const [dataPart, signaturePart] = state.split(".");
  const serialized = Buffer.from(dataPart, "base64url").toString("utf8");

  const hmac = crypto.createHmac("sha256", getSecretKey());
  hmac.update(serialized);
  const expectedSignature = hmac.digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signaturePart), Buffer.from(expectedSignature))) {
    throw new Error("STATE_SIGNATURE_MISMATCH");
  }

  const payload: GoogleOAuthState = JSON.parse(serialized);

  // Enforce 10-minute TTL
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  if (Date.now() - payload.timestamp > TEN_MINUTES_MS) {
    throw new Error("STATE_EXPIRED");
  }

  // Enforce that the user initiating the OAuth flow is the one completing it
  if (payload.userId !== currentUserId) {
    throw new Error("STATE_USER_MISMATCH");
  }

  return payload;
}

/**
 * Builds the Google OAuth 2.0 authorization URL with requested scopes and offline access.
 */
export function generateGoogleOAuthUrl({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}): { url: string; state: string } {
  const { clientId, redirectUri } = getGoogleOAuthClientConfig();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is missing.");
  }

  const statePayload: GoogleOAuthState = {
    orgId,
    userId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const state = signOAuthState(statePayload);

  // Scopes: openid, userinfo.email, and gmail.send
  const scopes = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.send",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline", // Required to receive a refresh token
    prompt: "consent", // Forces consent screen to ensure refresh token is returned
    include_granted_scopes: "true",
    state,
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  };
}

/**
 * Exchanges Google authorization code for access and refresh tokens.
 */
export async function exchangeGoogleCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthClientConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) not configured.");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text();
    console.error("Google token exchange error:", errorBody);
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token as string;
  const refreshToken = tokenData.refresh_token as string | undefined;
  const scope = tokenData.scope as string;

  // Retrieve user email to know which Gmail address was connected
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let email = "unknown@gmail.com";
  if (userRes.ok) {
    const userData = await userRes.json();
    email = userData.email || email;
  }

  return {
    accessToken,
    refreshToken,
    scope,
    email,
  };
}

/**
 * Stores the connected Gmail configuration in the organization settings with encrypted refresh token.
 */
export async function saveGmailIntegration({
  orgId,
  actorId,
  email,
  refreshToken,
  scope,
}: {
  orgId: string;
  actorId: string;
  email: string;
  refreshToken?: string;
  scope?: string;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, settings: true },
  });

  if (!org) throw new Error("Organization not found.");

  const currentSettings = (org.settings as Record<string, unknown>) || {};
  const currentGmail = (currentSettings.gmail as GmailSettings) || {};

  // If Google did not return a new refresh token (e.g. re-auth), retain the previous encrypted one
  let refreshTokenCiphertext = currentGmail.refreshTokenCiphertext;
  if (refreshToken) {
    refreshTokenCiphertext = encryptToken(refreshToken);
  }

  if (!refreshTokenCiphertext) {
    throw new Error("No refresh token received from Google. Disconnect and re-authorize with consent prompt.");
  }

  const updatedGmail: GmailSettings = {
    connected: true,
    email,
    refreshTokenCiphertext,
    scope: scope || currentGmail.scope || "openid email https://www.googleapis.com/auth/gmail.send",
    connectedAt: new Date().toISOString(),
    connectedByUserId: actorId,
  };

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      settings: {
        ...currentSettings,
        gmail: updatedGmail as unknown as Prisma.InputJsonValue,
      } as Prisma.InputJsonObject,
    },
  });

  await logAudit({
    organizationId: orgId,
    actorId,
    action: "GMAIL_INTEGRATION_CONNECTED",
    targetType: "Organization",
    targetId: orgId,
    metadata: { email, scope },
  });

  return updatedGmail;
}

/**
 * Disconnects the Gmail integration for an organization.
 */
export async function disconnectGmail(orgId: string, actorId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, settings: true },
  });

  if (!org) throw new Error("Organization not found.");

  const currentSettings = (org.settings as Record<string, unknown>) || {};
  const { gmail, ...remainingSettings } = currentSettings;

  await prisma.organization.update({
    where: { id: orgId },
    data: { settings: remainingSettings as unknown as Prisma.InputJsonValue },
  });

  await logAudit({
    organizationId: orgId,
    actorId,
    action: "GMAIL_INTEGRATION_DISCONNECTED",
    targetType: "Organization",
    targetId: orgId,
  });

  return { success: true };
}

/**
 * Fetches a valid access token using the encrypted refresh token.
 */
export async function getGmailAccessToken(orgId: string): Promise<{ accessToken: string; fromEmail: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  const settings = (org?.settings as Record<string, unknown>) || {};
  const gmail = settings.gmail as GmailSettings | undefined;

  if (!gmail?.connected || !gmail.refreshTokenCiphertext) {
    throw new Error("GMAIL_NOT_CONNECTED");
  }

  const refreshToken = decryptToken(gmail.refreshTokenCiphertext);
  if (!refreshToken) {
    throw new Error("GMAIL_REFRESH_TOKEN_DECRYPTION_FAILED");
  }

  const { clientId, clientSecret } = getGoogleOAuthClientConfig();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("Failed to refresh Gmail access token:", err);
    throw new Error("GMAIL_TOKEN_REFRESH_FAILED");
  }

  const tokenData = await tokenRes.json();
  return {
    accessToken: tokenData.access_token as string,
    fromEmail: gmail.email || "notifications@opensourcehq.local",
  };
}

/**
 * Encodes an email into RFC 2822 format and sends it via Gmail API users.messages.send.
 */
export async function sendGmailMessage({
  orgId,
  to,
  subject,
  html,
  text,
}: {
  orgId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ id: string }> {
  const { accessToken, fromEmail } = await getGmailAccessToken(orgId);

  const boundary = `__boundary_${crypto.randomBytes(12).toString("hex")}__`;
  const plainTextBody = text || html.replace(/<[^>]+>/g, " ").trim();

  // Construct standard MIME multipart/alternative RFC 2822 email
  const messageParts = [
    `From: OpenSourceHQ <${fromEmail}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(plainTextBody).toString("base64"),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html).toString("base64"),
    ``,
    `--${boundary}--`,
  ];

  const rawMessage = messageParts.join("\r\n");
  const encodedMessage = Buffer.from(rawMessage).toString("base64url");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!sendRes.ok) {
    const errorBody = await sendRes.text();
    console.error("Gmail API users.messages.send failed:", errorBody);
    throw new Error(`Gmail API send failed: ${sendRes.status}`);
  }

  const result = await sendRes.json();
  return { id: result.id };
}

/**
 * Returns the current Gmail integration status for an organization (safe for client inspection).
 */
export async function getGmailIntegrationStatus(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  const settings = (org?.settings as Record<string, unknown>) || {};
  const gmail = (settings.gmail as GmailSettings) || null;

  const { clientId, clientSecret, redirectUri } = getGoogleOAuthClientConfig();
  const configured = Boolean(clientId && clientSecret);

  if (!gmail?.connected) {
    return {
      configured,
      connected: false,
      redirectUri,
    };
  }

  return {
    configured,
    connected: true,
    email: gmail.email,
    connectedAt: gmail.connectedAt,
    scope: gmail.scope,
    redirectUri,
  };
}
