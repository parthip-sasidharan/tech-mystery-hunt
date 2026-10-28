import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { toggleTeamIdStatus } from "@/server/services/teamIdService";
import { ToggleTeamIdStatusSchema } from "@/server/validators/schemas";

/**
 * PATCH /api/admin/team-ids/[id]
 * Changes status of an unassigned Team ID (e.g. enable or disable).
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    const teamIdParam = params.id;
    if (!teamIdParam) {
      return NextResponse.json({ error: "Team ID parameter is required." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const validated = ToggleTeamIdStatusSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }

    const result = await toggleTeamIdStatus(teamIdParam, validated.data.status, session!.sub);

    return NextResponse.json({
      success: true,
      message: `Team ID ${result.teamId} status changed from ${result.oldStatus} to ${result.newStatus}.`,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update Team ID status.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
