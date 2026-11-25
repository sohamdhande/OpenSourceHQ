import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import { canManageOrganization } from "@/server/authorization/policies";
import {
  verifyOAuthState,
  exchangeGoogleCodeForTokens,
  saveGmailIntegration,
} from "@/features/integrations/gmail-service";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login?error=auth_required", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error("Google OAuth error callback:", error);
    return NextResponse.redirect(
      new URL(`/platform?error=google_oauth_denied&details=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/platform?error=invalid_oauth_response", req.url)
    );
  }

  let statePayload;
  try {
    // 1. Verify HMAC state and user identity to prevent CSRF
    statePayload = verifyOAuthState(state, session.id);
  } catch (stateErr) {
    const msg = stateErr instanceof Error ? stateErr.message : "Invalid OAuth state";
    console.error("Google OAuth state verification failed:", msg);
    return NextResponse.redirect(
      new URL(`/platform?error=csrf_state_invalid&details=${encodeURIComponent(msg)}`, req.url)
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: statePayload.orgId },
    select: { id: true, slug: true },
  });

  if (!org) {
    return NextResponse.redirect(
      new URL("/platform?error=organization_not_found", req.url)
    );
  }

  // 2. Authenticated Admin check
  const isAllowed = await canManageOrganization(session, org.id);
  if (!isAllowed) {
    return NextResponse.redirect(
      new URL(`/org/${org.slug}/admin?error=unauthorized_admin_required`, req.url)
    );
  }

  try {
    // 3. Exchange authorization code for tokens
    const tokens = await exchangeGoogleCodeForTokens(code);

    // 4. Encrypt refresh token and save to organization settings
    await saveGmailIntegration({
      orgId: org.id,
      actorId: session.id,
      email: tokens.email,
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
    });

    return NextResponse.redirect(
      new URL(`/org/${org.slug}/admin/integrations/gmail?status=connected`, req.url)
    );
  } catch (exchangeErr) {
    const msg = exchangeErr instanceof Error ? exchangeErr.message : "Failed to connect Gmail";
    console.error("Failed to complete Google OAuth integration:", exchangeErr);
    return NextResponse.redirect(
      new URL(`/org/${org.slug}/admin/integrations/gmail?status=error&message=${encodeURIComponent(msg)}`, req.url)
    );
  }
}

