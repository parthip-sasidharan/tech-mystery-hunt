import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { connectToDatabase } from "@/server/db";
import { Team, Registration, TeamProgress, PrizeClaim, AuditLog, TeamIdPool, GameConfig } from "@/server/models";

export async function POST(req: Request) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let mode = "FRESH"; // "FRESH" (clear teams & pool) or "REPLAY" (reset existing teams to waiting)
    try {
      const body = await req.json();
      if (body.mode) mode = body.mode;
    } catch {
      // default mode FRESH
    }

    await connectToDatabase();

    if (mode === "FRESH") {
      // 1. Wipe teams and progress
      await Team.deleteMany({});
      await Registration.deleteMany({});
      await TeamProgress.deleteMany({});
      await PrizeClaim.deleteMany({});
      await AuditLog.deleteMany({});

      // 2. Reset Team ID Pool with 50 fresh sequential IDs (TEAM001 to TEAM050)
      await TeamIdPool.deleteMany({});
      const poolDocs = [];
      for (let i = 1; i <= 50; i++) {
        const seqStr = String(i).padStart(3, "0");
        poolDocs.push({
          teamId: `TEAM${seqStr}`,
          sequenceNumber: i,
          status: "AVAILABLE",
          assignedTeamId: null,
          assignedTeamName: null,
          assignedAt: null,
          batchTag: "INITIAL_FRESH_POOL",
        });
      }
      await TeamIdPool.insertMany(poolDocs);

      // 3. Set Game Status back to WAITING
      await GameConfig.updateOne(
        { key: "GAME_STATUS" },
        { $set: { value: "WAITING", updatedAt: new Date() } },
        { upsert: true }
      );
      await GameConfig.deleteOne({ key: "GLOBAL_BROADCAST" });
      await GameConfig.updateOne(
        { key: "REGISTRATION_OPEN" },
        { $set: { value: "true", updatedAt: new Date() } },
        { upsert: true }
      );
      await GameConfig.deleteOne({ key: "GLOBAL_BROADCAST" });

      await AuditLog.create({
        action: "ADMIN_RESET_GAME_FRESH",
        actorRole: "ADMIN",
        actorId: session!.sub,
        details: JSON.stringify({ mode: "FRESH", timestamp: new Date() }),
      });

      return NextResponse.json({
        success: true,
        mode: "FRESH",
        message: "Complete event reset: All teams cleared, Team ID pool restored (TEAM001-TEAM050), and game status set to WAITING.",
      });
    } else {
      // REPLAY mode: Keep teams but reset their progress back to Checkpoint 1 & WAITING_ROOM
      await TeamProgress.deleteMany({});
      await PrizeClaim.deleteMany({});

      await Team.updateMany(
        {},
        {
          $set: {
            currentStage: "WAITING_ROOM",
            currentCheckpointIndex: 0,
            status: "WAITING",
            startedAt: null,
            completedAt: null,
          },
        }
      );

      await GameConfig.updateOne(
        { key: "GAME_STATUS" },
        { $set: { value: "WAITING", updatedAt: new Date() } },
        { upsert: true }
      );
      await GameConfig.deleteOne({ key: "GLOBAL_BROADCAST" });

      await AuditLog.create({
        action: "ADMIN_RESET_GAME_REPLAY",
        actorRole: "ADMIN",
        actorId: session!.sub,
        details: JSON.stringify({ mode: "REPLAY", timestamp: new Date() }),
      });

      return NextResponse.json({
        success: true,
        mode: "REPLAY",
        message: "Progress reset: Existing teams preserved and moved back to Waiting Room. Game status set to WAITING.",
      });
    }
  } catch (err: unknown) {
    console.error("[RESET-GAME]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reset game." },
      { status: 500 }
    );
  }
}
