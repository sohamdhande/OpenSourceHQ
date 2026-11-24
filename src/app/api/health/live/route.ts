import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Process-level liveness probe for Kubernetes and Docker HEALTHCHECK.
 * Confirms the Node.js HTTP server is responsive without depending on PostgreSQL.
 */
export async function GET() {
  return NextResponse.json({ status: "alive" }, { status: 200 });
}

