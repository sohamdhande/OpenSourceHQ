import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { ProfileUpdateSchema, PasswordChangeSchema } from "@/lib/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      githubAccounts: {
        orderBy: { connectedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 });
  }

  const gh = user.githubAccounts[0] || null;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      hasPassword: Boolean(user.passwordHash),
      githubAccount: gh
        ? {
            id: gh.id,
            providerUserId: gh.providerUserId,
            username: gh.username,
            profileUrl: gh.profileUrl,
            avatarUrl: gh.avatarUrl,
            verifiedEmail: gh.verifiedEmail,
            connectionStatus: gh.connectionStatus,
            lastVerifiedAt: gh.lastVerifiedAt,
            connectedAt: gh.connectedAt,
          }
        : null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const body = await req.json();

  // If password change is requested
  if (body.currentPassword && body.newPassword) {
    const parsedPw = PasswordChangeSchema.safeParse(body);
    if (!parsedPw.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsedPw.error.message } }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: { code: "INVALID_USER", message: "User not found" } }, { status: 400 });
    }

    const validCurrent = await bcrypt.compare(parsedPw.data.currentPassword, user.passwordHash);
    if (!validCurrent) {
      return NextResponse.json({ error: { code: "INVALID_PASSWORD", message: "Current password does not match" } }, { status: 400 });
    }

    const newHash = await bcrypt.hash(parsedPw.data.newPassword, 10);
    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  }

  // Profile details update
  const parsedProfile = ProfileUpdateSchema.safeParse(body);
  if (!parsedProfile.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsedProfile.error.message } }, { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: session.id },
    data: {
      name: parsedProfile.data.name,
      timezone: parsedProfile.data.timezone,
    },
  });

  return NextResponse.json({
    success: true,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      timezone: updatedUser.timezone,
    },
  });
}

