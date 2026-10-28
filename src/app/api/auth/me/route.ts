import { NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getTeamProfile } from "@/server/services/teamService";
import { connectToDatabase } from "@/server/db";
import { User } from "@/server/models";

export async function GET() {
  try {
    const { session, error } = requireAuth();
    if (error) return error;

    if (session!.role === "TEAM") {
      const team = await getTeamProfile(session!.sub);
      if (!team) {
        return NextResponse.json({ authenticated: false, user: null });
      }
      return NextResponse.json({
        authenticated: true,
        role: "TEAM",
        user: {
          id: team.id,
          teamId: team.teamId,
          name: team.name,
          leaderName: team.leaderName,
          members: team.members,
          status: team.status,
          currentStage: team.currentStage,
          routeName: team.routeName,
          routeId: team.routeId,
          completedCheckpointsCount: team.completedCheckpointsCount,
          totalConfiguredCheckpoints: team.totalConfiguredCheckpoints,
          prizeClaim: team.prizeClaim,
        },
      });
    }

    // Admin or Volunteer
    await connectToDatabase();
    const user = await User.findById(session!.sub).select("username name email role active").lean();

    if (!user || !user.active) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      role: user.role,
      user: {
        id: String(user._id),
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    console.error("[ME]", err);
    return NextResponse.json(
      { error: "Session check failed. Please reload and sign in again." },
      { status: 500 }
    );
  }
}
