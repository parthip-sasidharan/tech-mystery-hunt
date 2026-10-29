import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/server/middleware/auth";
import { getTeamProfile } from "@/server/services/teamService";
import { connectToDatabase } from "@/server/db";
import { User, Team } from "@/server/models";

export async function GET() {
  try {
    const { session, error } = requireAuth();
    if (error) return error;

    if (session!.role === "TEAM") {
      let team = await getTeamProfile(session!.sub);
      if (!team && session!.usernameOrTeamId) {
        const rawTeam = await Team.findOne({ teamId: session!.usernameOrTeamId.toUpperCase() }).lean();
        if (rawTeam) {
          team = await getTeamProfile(String(rawTeam._id));
        }
      }
      if (!team) {
        const unauthRes = NextResponse.json({ authenticated: false, user: null });
        unauthRes.cookies.delete("techhunt_token");
        return unauthRes;
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
    let user = null;
    try {
      if (mongoose.isValidObjectId(session!.sub)) {
        user = await User.findById(session!.sub).select("username name email role active").lean();
      }
    } catch {
      // fallback to query
    }

    if (!user) {
      user = await User.findOne({
        $or: [
          ...(mongoose.isValidObjectId(session!.sub) ? [{ _id: new mongoose.Types.ObjectId(session!.sub) }] : []),
          { _id: session!.sub },
          { username: session!.usernameOrTeamId?.toLowerCase() },
          { email: session!.usernameOrTeamId?.toLowerCase() },
        ],
      }).select("username name email role active").lean();
    }

    if (!user || !user.active) {
      const unauthRes = NextResponse.json({ authenticated: false, user: null });
      unauthRes.cookies.delete("techhunt_token");
      return unauthRes;
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
