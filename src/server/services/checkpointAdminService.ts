import { connectToDatabase } from "../db";
import { Checkpoint, Question, TeamProgress, Route, AuditLog, GameConfig } from "../models";
import { getGameStatus, getCheckpointCount } from "./gameService";
import { getCheckpointPenaltyTask } from "./checkpointService";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface CheckpointQuestionInput {
  prompt: string;
  type?: "MULTIPLE_CHOICE" | "NUMERIC" | "TEXT" | "CODE_CIPHER";
  options?: string[] | null;
  acceptedAnswer: string;
  points?: number;
  hint?: string | null;
}

export interface CreateCheckpointInput {
  name: string;
  campusArea?: string;
  locationHint: string;
  isFinalTreasure?: boolean;
  treasureBoxNumber?: number | null;
  question: CheckpointQuestionInput;
}

export interface UpdateCheckpointInput {
  name?: string;
  campusArea?: string;
  locationHint?: string;
  isFinalTreasure?: boolean;
  treasureBoxNumber?: number | null;
  active?: boolean;
  penaltyTask?: string | null;
  question?: Partial<CheckpointQuestionInput>;
}

/**
 * List all checkpoints with associated questions and progress stats for Admin.
 */
export async function listCheckpointsForAdmin() {
  await connectToDatabase();

  const checkpoints = await Checkpoint.find({}).sort({ sequenceNumber: 1 }).lean();
  const totalConfigured = await getCheckpointCount();

  const enriched = await Promise.all(
    checkpoints.map(async (cp) => {
      const cpId = String(cp._id);
      const question = await Question.findOne({ checkpointId: cpId }).lean();

      // Checkpoint completion metrics
      const [teamsScanned, teamsSolved] = await Promise.all([
        TeamProgress.countDocuments({ checkpointId: cpId, qrValidated: true }),
        TeamProgress.countDocuments({ checkpointId: cpId, isAnswerCorrect: true }),
      ]);

      const penaltyTask = await getCheckpointPenaltyTask(cp.sequenceNumber);

      let parsedOptions: string[] = [];
      if (question?.options) {
        try {
          parsedOptions = JSON.parse(question.options);
        } catch {
          parsedOptions = [];
        }
      }

      return {
        id: cpId,
        sequenceNumber: cp.sequenceNumber,
        name: cp.name,
        campusArea: cp.campusArea,
        locationHint: cp.locationHint,
        qrCodeToken: cp.qrCodeToken,
        isFinalTreasure: cp.isFinalTreasure,
        treasureBoxNumber: cp.treasureBoxNumber || null,
        active: cp.active !== false,
        penaltyTask,
        stats: {
          teamsScanned,
          teamsSolved,
        },
        question: question
          ? {
              id: String(question._id),
              prompt: question.prompt,
              type: question.type,
              options: parsedOptions,
              points: question.points,
              hint: question.hint || null,
              hasAnswerSet: Boolean(question.correctAnswerHash),
            }
          : null,
      };
    })
  );

  return {
    totalConfigured,
    totalCheckpoints: checkpoints.length,
    activeCount: checkpoints.filter((c) => c.active !== false).length,
    checkpoints: enriched,
  };
}

/**
 * Creates a new checkpoint and attached question.
 * Guards against modifying structure while a hunt is active.
 */
export async function createCheckpoint(input: CreateCheckpointInput, adminId: string) {
  await connectToDatabase();

  const gameStatus = await getGameStatus();
  if (gameStatus === "ACTIVE" || gameStatus === "PAUSED") {
    throw new Error("Cannot add checkpoints while a game is currently in progress or paused.");
  }

  // Determine next sequence number
  const highest = await Checkpoint.findOne({}).sort({ sequenceNumber: -1 }).select("sequenceNumber").lean();
  const nextSeq = highest ? highest.sequenceNumber + 1 : 1;

  // Generate cryptographic unique QR token
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const qrCodeToken = `QR_TOKEN_CP${String(nextSeq).padStart(2, "0")}_${randomSuffix}`;

  const checkpoint = await Checkpoint.create({
    sequenceNumber: nextSeq,
    name: input.name.trim(),
    campusArea: (input.campusArea || input.name).trim(),
    locationHint: input.locationHint.trim(),
    qrCodeToken,
    isFinalTreasure: Boolean(input.isFinalTreasure),
    treasureBoxNumber: input.treasureBoxNumber || null,
    active: true,
  });

  const cpId = String(checkpoint._id);

  // Hash accepted answer with bcrypt
  const answerHash = await bcrypt.hash(input.question.acceptedAnswer.trim().toUpperCase(), 10);

  const question = await Question.create({
    checkpointId: cpId,
    prompt: input.question.prompt.trim(),
    type: input.question.type || "MULTIPLE_CHOICE",
    options: input.question.options ? JSON.stringify(input.question.options) : null,
    correctAnswerHash: answerHash,
    points: input.question.points || 100,
    hint: input.question.hint?.trim() || null,
  });

  await AuditLog.create({
    action: "CHECKPOINT_CREATED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({
      checkpointId: cpId,
      sequenceNumber: nextSeq,
      name: checkpoint.name,
      isFinalTreasure: checkpoint.isFinalTreasure,
    }),
  });

  return {
    success: true,
    checkpoint: {
      id: cpId,
      sequenceNumber: checkpoint.sequenceNumber,
      name: checkpoint.name,
      campusArea: checkpoint.campusArea,
      locationHint: checkpoint.locationHint,
      qrCodeToken: checkpoint.qrCodeToken,
      isFinalTreasure: checkpoint.isFinalTreasure,
      active: checkpoint.active,
    },
    question: {
      id: String(question._id),
      prompt: question.prompt,
      points: question.points,
    },
  };
}

/**
 * Updates an existing checkpoint and its attached question.
 */
export async function updateCheckpoint(
  checkpointId: string,
  input: UpdateCheckpointInput,
  adminId: string
) {
  await connectToDatabase();

  const checkpoint = await Checkpoint.findById(checkpointId);
  if (!checkpoint) throw new Error("Checkpoint not found.");

  const gameStatus = await getGameStatus();

  // If attempting to deactivate while game is active, prevent it
  if (input.active === false && (gameStatus === "ACTIVE" || gameStatus === "PAUSED")) {
    const activeProgress = await TeamProgress.countDocuments({
      checkpointId,
      qrValidated: true,
    });
    if (activeProgress > 0) {
      throw new Error("Cannot deactivate a checkpoint that active teams have already visited in a running hunt.");
    }
  }

  if (input.name !== undefined) checkpoint.name = input.name.trim();
  if (input.campusArea !== undefined) checkpoint.campusArea = input.campusArea.trim();
  if (input.locationHint !== undefined) checkpoint.locationHint = input.locationHint.trim();
  if (input.isFinalTreasure !== undefined) {
    checkpoint.isFinalTreasure = input.isFinalTreasure;
    if (input.isFinalTreasure) {
      // Strictly enforce that ONLY this checkpoint is the Final Treasure Vault
      await Checkpoint.updateMany(
        { _id: { $ne: checkpoint._id } },
        { $set: { isFinalTreasure: false } }
      );
    }
  }
  if (input.treasureBoxNumber !== undefined) checkpoint.treasureBoxNumber = input.treasureBoxNumber;
  if (input.active !== undefined) checkpoint.active = input.active;

  await checkpoint.save();

  // Update penalty task if provided
  if (input.penaltyTask !== undefined) {
    if (input.penaltyTask && input.penaltyTask.trim().length > 0) {
      await GameConfig.updateOne(
        { key: `PENALTY_TASK_CP_${checkpoint.sequenceNumber}` },
        { $set: { value: input.penaltyTask.trim(), updatedAt: new Date() } },
        { upsert: true }
      );
    } else {
      await GameConfig.deleteOne({ key: `PENALTY_TASK_CP_${checkpoint.sequenceNumber}` });
    }
  }

  // Update question if provided
  if (input.question) {
    let question = await Question.findOne({ checkpointId });
    if (!question) {
      question = new Question({ checkpointId });
    }

    if (input.question.prompt !== undefined) question.prompt = input.question.prompt.trim();
    if (input.question.type !== undefined) question.type = input.question.type;
    if (input.question.options !== undefined) {
      question.options = input.question.options ? JSON.stringify(input.question.options) : null;
    }
    if (input.question.points !== undefined) question.points = input.question.points;
    if (input.question.hint !== undefined) question.hint = input.question.hint?.trim() || null;

    if (input.question.acceptedAnswer && input.question.acceptedAnswer.trim().length > 0) {
      question.correctAnswerHash = await bcrypt.hash(
        input.question.acceptedAnswer.trim().toUpperCase(),
        10
      );
    }

    await question.save();
  }

  await AuditLog.create({
    action: "CHECKPOINT_UPDATED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({
      checkpointId,
      sequenceNumber: checkpoint.sequenceNumber,
      name: checkpoint.name,
      active: checkpoint.active,
    }),
  });

  return {
    success: true,
    message: `Checkpoint #${checkpoint.sequenceNumber} "${checkpoint.name}" updated successfully.`,
    checkpoint: {
      id: String(checkpoint._id),
      sequenceNumber: checkpoint.sequenceNumber,
      name: checkpoint.name,
      active: checkpoint.active,
    },
  };
}

/**
 * Reorders checkpoints by their sequence numbers.
 * Disallowed once a hunt is running to preserve team progress pointers.
 */
export async function reorderCheckpoints(orderedIds: string[], adminId: string) {
  await connectToDatabase();

  const gameStatus = await getGameStatus();
  if (gameStatus === "ACTIVE" || gameStatus === "PAUSED") {
    throw new Error("Cannot reorder checkpoints while a game is currently in progress or paused.");
  }

  // Check if any progress exists
  const progressCount = await TeamProgress.countDocuments({ qrValidated: true });
  if (progressCount > 0) {
    throw new Error("Cannot reorder checkpoints: Team progress records exist. Reset or finish current game first.");
  }

  // Verify all checkpoints exist
  const existing = await Checkpoint.find({ _id: { $in: orderedIds } }).lean();
  if (existing.length !== orderedIds.length) {
    throw new Error("Invalid checkpoint IDs provided in reorder list.");
  }

  // Apply new sequence numbers sequentially
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    await Checkpoint.findByIdAndUpdate(id, { $set: { sequenceNumber: i + 1 } });
  }

  await AuditLog.create({
    action: "CHECKPOINTS_REORDERED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({ orderedIds, count: orderedIds.length }),
  });

  return {
    success: true,
    message: `Successfully reordered ${orderedIds.length} checkpoints.`,
  };
}

/**
 * Deactivates or removes a checkpoint.
 * Disallowed if referenced in active routes or if teams have progress.
 */
export async function deleteCheckpoint(checkpointId: string, adminId: string) {
  await connectToDatabase();

  const gameStatus = await getGameStatus();
  if (gameStatus === "ACTIVE" || gameStatus === "PAUSED") {
    throw new Error("Cannot delete checkpoints while a hunt is in progress.");
  }

  const checkpoint = await Checkpoint.findById(checkpointId);
  if (!checkpoint) throw new Error("Checkpoint not found.");

  // Check if teams have progress records
  const progressCount = await TeamProgress.countDocuments({ checkpointId });
  if (progressCount > 0) {
    throw new Error("Cannot delete checkpoint: Progress records exist. Deactivate it instead.");
  }

  // Check if active routes include this sequence number
  const activeRoutes = await Route.find({ active: true }).lean();
  const seqNum = checkpoint.sequenceNumber;
  for (const r of activeRoutes) {
    try {
      const seq: number[] = JSON.parse(r.checkpointSequence);
      if (seq.includes(seqNum)) {
        throw new Error(
          `Cannot delete checkpoint #${seqNum}: It is currently part of active route "${r.name}". Remove it from routes first.`
        );
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("part of active route")) throw e;
    }
  }

  await Question.deleteMany({ checkpointId });
  await Checkpoint.findByIdAndDelete(checkpointId);

  await AuditLog.create({
    action: "CHECKPOINT_DELETED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({ checkpointId, sequenceNumber: seqNum, name: checkpoint.name }),
  });

  return {
    success: true,
    message: `Checkpoint #${seqNum} "${checkpoint.name}" deleted.`,
  };
}
