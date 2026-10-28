import { NextResponse } from "next/server";
import { requireVolunteerOrAdmin } from "@/server/middleware/auth";
import { TaskVerificationSchema } from "@/server/validators/schemas";
import { connectToDatabase } from "@/server/db";
import { Checkpoint, Team, User, TaskVerification, AuditLog } from "@/server/models";
import { approveTeamPenaltyTask, listPendingPenaltyTasks } from "@/server/services/checkpointService";

/**
 * POST /api/volunteer/verify-task
 * Volunteer confirms physical presence of a team at a checkpoint, approves WhatsApp penalty tasks, etc.
 * Restricted to VOLUNTEER and ADMIN roles only.
 */
export async function POST(req: Request) {
  const { session, error } = requireVolunteerOrAdmin();
  if (error) return error;

  try {
    await connectToDatabase();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // Direct approve penalty task shortcut
    if (body.approvePenalty) {
      if (!body.teamObjectId) {
        return NextResponse.json({ error: "teamObjectId is required." }, { status: 400 });
      }
      const result = await approveTeamPenaltyTask(
        session!.sub,
        String(body.teamObjectId),
        body.checkpointId,
        body.notes || "WhatsApp Video verified by Marshall"
      );
      return NextResponse.json(result);
    }

    const validated = TaskVerificationSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid task verification payload." },
        { status: 400 }
      );
    }

    const { checkpointId, teamId, action, notes } = validated.data;

    // Verify checkpoint and team both exist
    const [checkpoint, team] = await Promise.all([
      Checkpoint.findById(checkpointId).select("sequenceNumber name").lean(),
      Team.findById(teamId).select("teamId name").lean(),
    ]);

    if (!checkpoint) {
      return NextResponse.json({ error: "Checkpoint not found." }, { status: 404 });
    }
    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    if (action === "APPROVE_PENALTY_TASK") {
      const res = await approveTeamPenaltyTask(
        session!.sub,
        String(team._id),
        String(checkpoint._id),
        notes || "WhatsApp video task verified by Marshall"
      );
      return NextResponse.json(res);
    }

    const verification = await TaskVerification.create({
      checkpointId: String(checkpoint._id),
      volunteerId: session!.sub,
      teamId: String(team._id),
      action,
      notes: notes ?? null,
    });

    const volunteer = await User.findById(session!.sub).select("username name").lean();

    await AuditLog.create({
      action: `TASK_${action}`,
      actorRole: "VOLUNTEER",
      actorId: session!.sub,
      details: JSON.stringify({ checkpointId, teamId: String(team._id), action, notes }),
    });

    return NextResponse.json({
      success: true,
      message: `Task verification recorded: ${action}`,
      verification: {
        id: String(verification._id),
        checkpoint: checkpoint.name,
        verifiedBy: volunteer?.name || "Volunteer",
        teamId: team.teamId,
        action: verification.action,
        notes: verification.notes,
        verifiedAt: verification.verifiedAt,
      },
    });

  } catch (err: unknown) {
    console.error("[TASK VERIFY]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Task verification failed." }, { status: 500 });
  }
}

/**
 * GET /api/volunteer/verify-task
 * Returns task verification history and currently active pending penalty tasks.
 */
export async function GET() {
  const { error } = requireVolunteerOrAdmin();
  if (error) return error;

  try {
    await connectToDatabase();
    const [verifications, pendingPenaltyTasks] = await Promise.all([
      TaskVerification.find({}).sort({ verifiedAt: -1 }).limit(200).lean(),
      listPendingPenaltyTasks(),
    ]);

    const formatted = await Promise.all(
      verifications.map(async (v) => {
        const cp = await Checkpoint.findById(v.checkpointId).select("sequenceNumber name campusArea").lean();
        const vol = await User.findById(v.volunteerId).select("username name").lean();
        const tm = await Team.findById(v.teamId).select("teamId").lean();

        return {
          id: String(v._id),
          checkpoint: cp ? `#${cp.sequenceNumber} – ${cp.name}` : "Checkpoint",
          area: cp?.campusArea || "",
          volunteer: vol?.name || "Volunteer",
          teamId: tm?.teamId || v.teamId,
          action: v.action,
          notes: v.notes,
          verifiedAt: v.verifiedAt,
        };
      })
    );

    return NextResponse.json({ verifications: formatted, pendingPenaltyTasks });

  } catch (err: unknown) {
    console.error("[TASK VERIFY GET]", err);
    return NextResponse.json({ error: "Failed to load task verifications." }, { status: 500 });
  }
}
