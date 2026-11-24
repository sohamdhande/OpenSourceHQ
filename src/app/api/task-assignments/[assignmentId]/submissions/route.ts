import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { startTaskAssignment, submitTaskAssignment } from "@/features/tasks/tasks-service";
import { TaskSubmissionSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { assignmentId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = TaskSubmissionSchema.safeParse({
      ...body,
      taskAssignmentId: params.assignmentId,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 400 });
    }

    const result = await submitTaskAssignment(
      session,
      params.assignmentId,
      parsed.data.notes,
      parsed.data.evidenceUrl
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Task submission failed";
    return NextResponse.json({ error: { code: "SUBMISSION_FAILED", message: msg } }, { status: 400 });
  }
}


export async function PATCH(_req: NextRequest, { params }: { params: { assignmentId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }
  try {
    const assignment = await startTaskAssignment(session, params.assignmentId);
    return NextResponse.json({ success: true, assignment });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Task could not be started.";
    const status = message.includes("Only the assigned") || message.includes("Active mentee") ? 403 : 409;
    return NextResponse.json({ error: { code: "TASK_START_FAILED", message } }, { status });
  }
}
