import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight health-check endpoint for Kubernetes readiness/liveness probes
 * and Docker HEALTHCHECK. Verifies PostgreSQL connectivity without exposing
 * internal error details or secrets.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}

