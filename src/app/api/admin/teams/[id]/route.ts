import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { connectToDatabase } from "@/server/db";
import { Team, TeamProgress, PrizeClaim, TeamIdPool, AuditLog } from "@/server/models";

/**
 * DELETE /api/admin/teams/[id]
 * Deletes a team that quit or was removed, cleaning up their progress and prize claims.
 * Has zero effect on remaining competing teams.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    await connectToDatabase();
    const team = await Team.findById(params.id);
    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const teamIdStr = team.teamId;
    const teamName = team.name;

    // 1. Delete all progress records for this team
    await TeamProgress.deleteMany({ teamId: String(team._id) });

    // 2. Delete any prize claims by this team
    await PrizeClaim.deleteMany({ teamId: String(team._id) });

    // 3. Reset Team ID pool record if it exists
    await TeamIdPool.updateOne(
      { teamId: teamIdStr },
      { $set: { status: "AVAILABLE", assignedTeamId: null } }
    );

    // 4. Delete the team itself
    await Team.findByIdAndDelete(params.id);

    // 5. Audit Log
    await AuditLog.create({
      action: "TEAM_DELETED",
      actorRole: "ADMIN",
      actorId: session!.sub,
      details: JSON.stringify({
        teamId: teamIdStr,
        name: teamName,
        reason: "Admin removed dropped-out team",
      }),
    });

    return NextResponse.json({
      success: true,
      message: `Team ${teamIdStr} (${teamName}) successfully removed. Remaining teams are completely unaffected.`,
    });
  } catch (err: unknown) {
    console.error("[DELETE TEAM]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete team." },
      { status: 500 }
    );
  }
}
