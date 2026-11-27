import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { deleteSelfTrackedTask, updateSelfTrackedTaskStatus } from "@/features/tasks/tasks-service";

const UpdateSelfTaskSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const parsed = UpdateSelfTaskSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    }
    const assignment = await updateSelfTrackedTaskStatus(session, params.taskId, parsed.data.status);
    return NextResponse.json({ success: true, assignment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update task";
    const status = msg.includes("not found") ? 404 : 403;
    return NextResponse.json({ error: { code: "TASK_UPDATE_FAILED", message: msg } }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    await deleteSelfTrackedTask(session, params.taskId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete task";
    const status = msg.includes("not found") ? 404 : 403;
    return NextResponse.json({ error: { code: "TASK_DELETE_FAILED", message: msg } }, { status });
  }
}

