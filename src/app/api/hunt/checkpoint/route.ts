import { NextResponse } from "next/server";
import { requireRole } from "@/server/middleware/auth";
import { getTeamCurrentCheckpointState } from "@/server/services/checkpointService";

export async function GET() {
  const { session, error } = requireRole(["TEAM"]);
  if (error) return error;

  try {
    // getTeamCurrentCheckpointState already strips correctAnswerHash from all responses
    const checkpointState = await getTeamCurrentCheckpointState(session!.sub);
    return NextResponse.json(checkpointState);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load checkpoint.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
