import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { assignRouteToTeam } from "@/server/services/teamService";

/**
 * POST /api/admin/teams/[id]/route
 * Assigns or reassigns a route to a specific team.
 * Reassigning a team that has already started its mission strictly requires a recoveryReason.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let body: { routeId?: string; recoveryReason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!body.routeId) {
      return NextResponse.json({ error: "routeId is required." }, { status: 400 });
    }

    const result = await assignRouteToTeam(
      params.id,
      body.routeId,
      session!.sub,
      body.recoveryReason
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to assign route.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
