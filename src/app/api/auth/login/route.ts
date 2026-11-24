import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSessionCookie } from "@/server/auth/session";
import { LoginSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid email or password format" } }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { organization: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }, { status: 401 });
    }

    const activeOrg = user.memberships[0];
    const sessionCookie = createSessionCookie({
      userId: user.id,
      email: user.email,
      activeOrgId: activeOrg?.organizationId,
      createdAt: Date.now(),
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        activeOrgSlug: activeOrg?.organization.slug,
        activeOrgRole: activeOrg?.role,
      },
    });

    res.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

