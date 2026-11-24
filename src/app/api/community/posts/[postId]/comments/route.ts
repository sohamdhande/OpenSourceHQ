import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { addDiscussionComment } from "@/features/community/community-service";
import { DiscussionCommentCreateSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { postId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  try {
    const parsed = DiscussionCommentCreateSchema.safeParse({ ...(await req.json()), postId: params.postId });
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    const comment = await addDiscussionComment(session, params.postId, parsed.data.content, parsed.data.parentId);
    return NextResponse.json({ success: true, comment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Comment creation failed";
    const status = msg.includes("not found") ? 404 : msg.includes("required") || msg.includes("not enrolled") || msg.includes("not assigned") || msg.includes("Observers") || msg.includes("locked") ? 403 : 400;
    return NextResponse.json({ error: { code: "COMMENT_FAILED", message: msg } }, { status });
  }
}
