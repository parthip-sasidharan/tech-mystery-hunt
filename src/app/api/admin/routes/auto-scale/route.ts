import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { autoScaleTwoTeamsPerRoute } from "@/server/services/routeAdminService";

/**
 * POST /api/admin/routes/auto-scale
 * Dynamically generates N/2 distinct routes (e.g. 20 routes for 40 teams)
 * so that at most 2 teams ever share the exact same sequence.
 * All routes end with Checkpoint 9, then Checkpoint 10.
 */
export async function POST() {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    const result = await autoScaleTwoTeamsPerRoute(session!.sub);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to auto-scale routes.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
