import { NextResponse } from "next/server";
import { requireRole } from "@/server/middleware/auth";
import { startTeamMission } from "@/server/services/checkpointService";

/**
 * POST /api/hunt/start
 * Idempotently transitions an authenticated team into active hunt status.
 * Rejects with clear message if game is WAITING, PAUSED, CONCLUDED, or if no route assigned.
 */
export async function POST() {
  const { session, error } = requireRole(["TEAM"]);
  if (error) return error;

  try {
    const result = await startTeamMission(session!.sub);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start mission.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
