import { NextResponse } from "next/server";
import { requireVolunteerOrAdmin } from "@/server/middleware/auth";
import { listAllTeamsForAdmin } from "@/server/services/teamService";
import { connectToDatabase } from "@/server/db";
import { Route, Team } from "@/server/models";

export async function GET() {
  const { error } = requireVolunteerOrAdmin();
  if (error) return error;

  try {
    await connectToDatabase();
    const teams = await listAllTeamsForAdmin();

    const stats = {
      totalTeams:     teams.length,
      waiting:        teams.filter((t) => t.status === "WAITING" || t.status === "REGISTERED").length,
      inProgress:     teams.filter((t) => t.status === "IN_PROGRESS").length,
      treasureSearch: teams.filter((t) => t.currentStage === "TREASURE_SEARCH").length,
      completed:      teams.filter((t) => t.status === "COMPLETED" || t.currentStage === "FINISHED").length,
    };

    const routes = await Route.find({}).lean();
    const routesWithCount = await Promise.all(
      routes.map(async (r) => {
        const teamCount = await Team.countDocuments({ routeId: String(r._id) });
        return {
          id: String(r._id),
          name: r.name,
          description: r.description,
          teamCount,
          active: r.active,
        };
      })
    );

    return NextResponse.json({
      teams,
      stats,
      routes: routesWithCount,
    });

  } catch (err: unknown) {
    console.error("[TEAMS GET]", err);
    return NextResponse.json({ error: "Failed to fetch teams." }, { status: 500 });
  }
}
