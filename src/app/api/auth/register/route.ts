import { NextResponse } from "next/server";
import { RegisterTeamSchema } from "@/server/validators/schemas";
import { registerTeam } from "@/server/services/teamService";
import { isRegistrationOpen } from "@/server/services/gameService";
import { signToken, createAuthCookie } from "@/server/auth";

export async function POST(req: Request) {
  try {
    const registrationAllowed = await isRegistrationOpen();
    if (!registrationAllowed) {
      return NextResponse.json(
        { error: "Team registration is currently closed by the organizers." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const validated = RegisterTeamSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Validation failed. Please check your inputs.", field: firstErr?.path?.[0] },
        { status: 400 }
      );
    }

    const result = await registerTeam(validated.data);

    // If pending approval workflow:
    if (result.pendingApproval) {
      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: result.message,
        registration: {
          id: result.registrationId,
          teamName: result.teamName,
          leaderName: result.leaderName,
          leaderEmail: result.leaderEmail,
        },
      });
    }

    // Auto-login on successful auto-approved registration
    const token = signToken({
      sub: result.id!,
      role: "TEAM",
      usernameOrTeamId: result.teamId!,
      name: result.name!,
    });

    const response = NextResponse.json({
      success: true,
      pendingApproval: false,
      message: `Team registered! Your Team ID is ${result.teamId}. Keep it safe.`,
      team: {
        id: result.id,
        teamId: result.teamId,
        name: result.name,
        leaderName: result.leaderName,
        routeName: result.routeName,
        leaderEmail: result.leaderEmail,
      },
    });

    const cookie = createAuthCookie(token);
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
