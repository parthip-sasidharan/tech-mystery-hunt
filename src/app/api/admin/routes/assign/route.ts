import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import {
  previewAutoAssignUnassignedTeams,
  autoAssignUnassignedTeams,
} from "@/server/services/teamService";

/**
 * POST /api/admin/routes/assign
 * Preview or apply automatic balanced route assignment for unassigned teams.
 * Body: { preview?: boolean }
 */
export async function POST(req: Request) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let body: { preview?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (body.preview) {
      const preview = await previewAutoAssignUnassignedTeams();
      return NextResponse.json(preview);
    }

    const result = await autoAssignUnassignedTeams(session!.sub);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process route assignments.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
