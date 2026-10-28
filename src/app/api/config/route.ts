import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import {
  getAllConfigs,
  getConfig,
  setConfig,
  getCheckpointCount,
  getGameStatus,
  isRegistrationOpen,
} from "@/server/services/gameService";
import { getRegistrationWorkflow } from "@/server/services/teamService";
import { checkEventLaunchReadiness } from "@/server/services/readinessService";
import { GameConfigSchema } from "@/server/validators/schemas";
import { connectToDatabase } from "@/server/db";
import { AuditLog, Checkpoint, TeamIdPool } from "@/server/models";

// Public endpoint – returns non-sensitive game state info
export async function GET() {
  try {
    const configs = await getAllConfigs();
    const checkpointCount = await getCheckpointCount();
    const gameStatus = await getGameStatus();
    const registrationOpen = await isRegistrationOpen();
    const registrationWorkflow = await getRegistrationWorkflow();
    const whatsappHelpline = configs["WHATSAPP_HELPLINE_NUMBER"] || "+91 98765 43210";

    return NextResponse.json({
      title:               configs["HUNT_TITLE"] || "Tech Mystery Hunt – The Missing Code",
      checkpointCount,
      gameStatus,
      registrationOpen,
      registrationWorkflow,
      whatsappHelpline,
      totalTreasureBoxes: parseInt(configs["TOTAL_TREASURE_BOXES"] || "3", 10),
    });
  } catch (err: unknown) {
    console.error("[CONFIG GET]", err);
    return NextResponse.json({ error: "Failed to load configuration." }, { status: 500 });
  }
}

// Admin-only mutation
export async function POST(req: Request) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const validated = GameConfigSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Invalid configuration input." }, { status: 400 });
    }

    const { checkpointCount, gameStatus, registrationOpen, registrationWorkflow, hintThreshold, whatsappHelpline } = validated.data;

    // Safety checks before starting hunt: Audit complete event readiness
    if (gameStatus === "ACTIVE") {
      const readiness = await checkEventLaunchReadiness();
      if (!readiness.canStart) {
        const errorDetails = readiness.blockingReasons.join(" | ");
        return NextResponse.json(
          { error: `Cannot start hunt: Event readiness checks failed. (${errorDetails})` },
          { status: 400 }
        );
      }
    }

    if (checkpointCount !== undefined) {
      const countNum = parseInt(String(checkpointCount), 10);
      await setConfig("CHECKPOINT_COUNT", String(countNum), "Configured total checkpoints (including final treasure)");

      await connectToDatabase();
      // Ensure strictly the N-th checkpoint is designated as the ONE and ONLY final treasure vault
      await Checkpoint.updateMany(
        { sequenceNumber: { $ne: countNum } },
        { $set: { isFinalTreasure: false } }
      );
      await Checkpoint.updateOne(
        { sequenceNumber: countNum },
        { $set: { isFinalTreasure: true } }
      );
    }
    if (gameStatus !== undefined) {
      await setConfig("GAME_STATUS", gameStatus, "Current state of the hunt");
      if (gameStatus === "ACTIVE") {
        await connectToDatabase();
        // Automatically disable / cancel all unassigned IDs in the pool so late entries are locked out
        await TeamIdPool.updateMany(
          { status: "AVAILABLE" },
          { $set: { status: "DISABLED" } }
        );
      }
    }
    if (registrationOpen !== undefined) {
      await setConfig("REGISTRATION_OPEN", registrationOpen ? "true" : "false", "Registration toggle");
    }
    if (registrationWorkflow !== undefined) {
      await setConfig("REGISTRATION_WORKFLOW", registrationWorkflow, "Registration approval mode");
    }
    if (hintThreshold !== undefined) {
      await setConfig("HINT_THRESHOLD", String(hintThreshold), "Wrong attempts before hint unlocks");
    }
    if (whatsappHelpline !== undefined) {
      await setConfig("WHATSAPP_HELPLINE_NUMBER", whatsappHelpline, "Helpline for team WhatsApp penalty video verification");
    }

    await connectToDatabase();
    await AuditLog.create({
      action:    "CONFIG_UPDATED",
      actorRole: "ADMIN",
      actorId:   session!.sub,
      details:   JSON.stringify(validated.data),
    });

    return NextResponse.json({
      success:              true,
      checkpointCount:      await getCheckpointCount(),
      gameStatus:           await getGameStatus(),
      registrationOpen:     await isRegistrationOpen(),
      registrationWorkflow: await getRegistrationWorkflow(),
      whatsappHelpline:     await getConfig("WHATSAPP_HELPLINE_NUMBER", "+91 98765 43210"),
    });

  } catch (err: unknown) {
    console.error("[CONFIG POST]", err);
    return NextResponse.json({ error: "Failed to update configuration." }, { status: 500 });
  }
}
