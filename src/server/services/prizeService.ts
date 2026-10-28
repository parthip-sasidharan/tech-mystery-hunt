import { connectToDatabase } from "../db";
import { Team, User, PrizeClaim, Checkpoint, AuditLog } from "../models";
import { getGameStatus, getConfig, setConfig } from "./gameService";
import mongoose from "mongoose";
import crypto from "crypto";

export const DEFAULT_BOX_CLUES: Record<number, string> = {
  1: "📦 1ST PLACE HUNT (BOX #1): നിങ്ങൾ നിൽക്കുന്ന ഈ പ്രധാന ഏരിയയിൽ ഒരു നിധി പെട്ടി ഒളിപ്പിച്ചിട്ടുണ്ട്! അത് തപ്പിയെടുത്ത് വേഗം വോളന്റിയറുടെ അടുത്ത് എത്തിക്കുക! (Search this immediate area to locate physical Treasure Box #1 and bring it directly to the Vault Marshall!)",
  2: "🥈 2ND PLACE HUNT (BOX #2): ഒന്നാം സ്ഥാനം നേടി ബോക്സ് 1 എടുത്തു! ഇനി ബോക്സ് 2-നുള്ള ഊഴം. ഈ പരിസരത്ത് ഒളിപ്പിച്ചിട്ടുള്ള 2-ാമത്തെ നിധി പെട്ടി കണ്ടെത്തി വോളന്റിയർക്ക് നൽകുക! (Box #1 has been claimed! Now search for Hidden Box #2 in this area and present it to the Marshall to claim 2nd place!)",
  3: "🥉 3RD PLACE HUNT (BOX #3): അവസാനത്തെ ഗോൾഡൻ ബോക്സ് (3RD PLACE)! 3-ാം ബോക്സ് വേഗം കണ്ടെത്തി വോളന്റിയറുടെ അടുത്ത് എത്തുക! (Final Box #3 is hidden nearby! Locate the 3rd treasure box and claim 3rd place before the hunt concludes!)",
};

/**
 * Retrieves the 3 physical clues for the treasure boxes.
 */
export async function getBoxClues(): Promise<Record<number, string>> {
  const [clue1, clue2, clue3] = await Promise.all([
    getConfig("BOX_1_CLUE", DEFAULT_BOX_CLUES[1]),
    getConfig("BOX_2_CLUE", DEFAULT_BOX_CLUES[2]),
    getConfig("BOX_3_CLUE", DEFAULT_BOX_CLUES[3]),
  ]);
  return { 1: clue1, 2: clue2, 3: clue3 };
}

/**
 * Updates the physical clues in GameConfig.
 */
export async function setBoxClues(clues: { clue1?: string; clue2?: string; clue3?: string }): Promise<void> {
  if (clues.clue1 !== undefined) await setConfig("BOX_1_CLUE", clues.clue1.trim(), "Physical clue for Box #1");
  if (clues.clue2 !== undefined) await setConfig("BOX_2_CLUE", clues.clue2.trim(), "Physical clue for Box #2");
  if (clues.clue3 !== undefined) await setConfig("BOX_3_CLUE", clues.clue3.trim(), "Physical clue for Box #3");
}

/**
 * Retrieves active global broadcast announcement if any.
 */
export async function getActiveBroadcast() {
  const raw = await getConfig("GLOBAL_BROADCAST", "");
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { title: "ANNOUNCEMENT", message: raw, timestamp: new Date().toISOString() };
  }
}

/**
 * Sets a new global announcement broadcast.
 */
export async function setGlobalBroadcast(title: string, message: string, type: string = "INFO") {
  const payload = {
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
  };
  await setConfig("GLOBAL_BROADCAST", JSON.stringify(payload), "Active global announcement alert");
  return payload;
}

/**
 * Clears active broadcast alert.
 */
export async function clearGlobalBroadcast() {
  await setConfig("GLOBAL_BROADCAST", "", "Cleared global announcement alert");
}

/**
 * Returns comprehensive state of the sequential treasure hunt.
 */
export async function getSequentialTreasureStatus(teamObjectId?: string) {
  await connectToDatabase();
  const clues = await getBoxClues();
  const confirmedWinnersDocs = await PrizeClaim.find({ status: "CONFIRMED" }).sort({ boxNumber: 1 }).lean();
  const confirmedBoxNumbers = new Set(confirmedWinnersDocs.map((c) => c.boxNumber));

  const teamIds = confirmedWinnersDocs.map((c) => c.teamId);
  const teams = await Team.find({ _id: { $in: teamIds } }).select("teamId name").lean();
  const teamMap = new Map(teams.map((t) => [String(t._id), t]));

  const confirmedWinners = confirmedWinnersDocs.map((w) => ({
    rank: w.boxNumber,
    boxNumber: w.boxNumber,
    teamId: teamMap.get(String(w.teamId))?.teamId || "UNKNOWN",
    teamName: teamMap.get(String(w.teamId))?.name || "Unknown Team",
    claimCode: w.claimCode,
    confirmedAt: w.verifiedAt,
  }));

  // Sequential order: Box 1 -> Box 2 -> Box 3
  let activeBoxNumber: number | null = 1;
  if (confirmedBoxNumbers.has(1)) activeBoxNumber = 2;
  if (confirmedBoxNumbers.has(2)) activeBoxNumber = 3;
  if (confirmedBoxNumbers.has(3) || confirmedWinnersDocs.length >= 3) activeBoxNumber = null;

  const allBoxesClaimed = confirmedWinnersDocs.length >= 3;
  const activeBoxClue = activeBoxNumber ? clues[activeBoxNumber] : null;
  const broadcast = await getActiveBroadcast();

  let teamClaim = null;
  if (teamObjectId) {
    const existing = await PrizeClaim.findOne({ teamId: String(teamObjectId) }).lean();
    if (existing) {
      teamClaim = {
        id: String(existing._id),
        boxNumber: existing.boxNumber,
        claimCode: existing.claimCode,
        status: existing.status,
        claimedAt: existing.claimedAt,
      };
    }
  }

  return {
    activeBoxNumber,
    activeBoxClue,
    allBoxesClaimed,
    confirmedWinners,
    teamClaim,
    broadcast,
  };
}

/**
 * Automatically creates or synchronizes a team's claim ticket to the active box.
 */
export async function ensureTeamSequentialClaim(teamObjectId: string) {
  await connectToDatabase();
  const team = await Team.findById(teamObjectId);
  if (!team) throw new Error("Team not found");

  const status = await getSequentialTreasureStatus(String(team._id));
  if (status.allBoxesClaimed || !status.activeBoxNumber) {
    return status;
  }

  const activeBox = status.activeBoxNumber;

  // If already confirmed as winner for any box, retain confirmed state
  const myConfirmed = await PrizeClaim.findOne({
    teamId: String(team._id),
    status: "CONFIRMED",
  });
  if (myConfirmed) {
    return status;
  }

  const existingClaim = await PrizeClaim.findOne({ teamId: String(team._id) });
  if (existingClaim) {
    if (existingClaim.status === "PENDING_VERIFICATION") {
      if (existingClaim.boxNumber === activeBox) {
        return status;
      }
      // Prior box was claimed by another team! Rollover seamlessly to new active box.
      const codeSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      existingClaim.boxNumber = activeBox;
      existingClaim.claimCode = `BOX${activeBox}-${team.teamId}-${codeSuffix}`;
      existingClaim.claimedAt = new Date();
      await existingClaim.save();
      return await getSequentialTreasureStatus(String(team._id));
    }

    if (existingClaim.status === "REJECTED") {
      const codeSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      existingClaim.boxNumber = activeBox;
      existingClaim.claimCode = `BOX${activeBox}-${team.teamId}-${codeSuffix}`;
      existingClaim.status = "PENDING_VERIFICATION";
      existingClaim.claimedAt = new Date();
      existingClaim.volunteerNotes = null;
      existingClaim.releaseReason = null;
      await existingClaim.save();
      return await getSequentialTreasureStatus(String(team._id));
    }
  }

  // Create fresh claim for the currently active box
  const codeSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const claimCode = `BOX${activeBox}-${team.teamId}-${codeSuffix}`;

  await PrizeClaim.create({
    teamId: String(team._id),
    boxNumber: activeBox,
    claimCode,
    status: "PENDING_VERIFICATION",
  });

  return await getSequentialTreasureStatus(String(team._id));
}

/**
 * Checks if all 3 boxes are now confirmed. If so, concludes the event and sends global broadcast.
 */
async function checkAndTriggerHuntOver(staffRole: string = "VOLUNTEER", staffUserId: string = "SYSTEM") {
  const confirmedCount = await PrizeClaim.countDocuments({ status: "CONFIRMED" });
  if (confirmedCount >= 3) {
    await setConfig("GAME_STATUS", "CONCLUDED", "Treasure hunt concluded: all 3 prize boxes confirmed.");
    const allWinners = await PrizeClaim.find({ status: "CONFIRMED" }).sort({ boxNumber: 1 }).lean();
    const winningTeams = await Team.find({
      _id: { $in: allWinners.map((w) => w.teamId) },
    }).select("teamId name").lean();
    const wMap = new Map(winningTeams.map((t) => [String(t._id), t]));

    const broadcastPayload = {
      type: "HUNT_OVER",
      title: "🚨 THE TREASURE HUNT IS OFFICIALLY OVER!",
      message: "All 3 physical treasure boxes have been successfully found and verified! The winners have been determined.",
      winners: allWinners.map((w) => ({
        rank: w.boxNumber,
        boxNumber: w.boxNumber,
        teamId: wMap.get(String(w.teamId))?.teamId || "UNKNOWN",
        teamName: wMap.get(String(w.teamId))?.name || "Unknown Team",
        claimCode: w.claimCode,
      })),
      timestamp: new Date().toISOString(),
    };

    await setConfig("GLOBAL_BROADCAST", JSON.stringify(broadcastPayload), "Active global announcement alert");

    await AuditLog.create({
      action: "EVENT_CONCLUDED_ALL_BOXES_CLAIMED",
      actorRole: staffRole,
      actorId: staffUserId,
      details: JSON.stringify(broadcastPayload),
    });

    return broadcastPayload;
  }
  return null;
}

/**
 * Initiates or re-confirms a treasure box claim for backwards compatibility.
 */
export async function claimTreasureBox(teamId: string, boxNumber: number) {
  await connectToDatabase();

  const gameStatus = await getGameStatus();
  if (gameStatus !== "ACTIVE") {
    throw new Error(
      gameStatus === "WAITING"
        ? "The hunt has not started yet. Prize claims are disabled."
        : gameStatus === "PAUSED"
        ? "The hunt is currently paused. Prize claims cannot be submitted."
        : "The hunt has concluded. Prize claims are closed."
    );
  }

  const team = await Team.findById(teamId);
  if (!team) throw new Error("Team not found");

  if (team.currentStage !== "TREASURE_SEARCH" && team.currentStage !== "FINISHED") {
    throw new Error("Security violation: Team has not unlocked the final treasure vault stage.");
  }

  const status = await ensureTeamSequentialClaim(String(team._id));
  if (!status.teamClaim) {
    throw new Error("Failed to allocate prize claim ticket.");
  }

  return {
    success: true,
    claim: status.teamClaim,
    treasureStatus: status,
  };
}

/**
 * Validates staff member permissions for prize vault verification actions.
 */
async function authorizeVaultStaff(staffUserId: string): Promise<{
  user: { _id: unknown; username: string; name: string; role: string };
  isAdmin: boolean;
}> {
  const staff = await User.findById(staffUserId).lean();
  if (!staff || !staff.active) {
    throw new Error("Unauthorized: Staff user not found or inactive.");
  }

  if (staff.role !== "ADMIN" && staff.role !== "VOLUNTEER") {
    throw new Error("Unauthorized: Insufficient permissions for prize box operations.");
  }

  if (staff.role === "VOLUNTEER" && staff.assignedCheckpointId) {
    const cp = await Checkpoint.findById(staff.assignedCheckpointId).lean();
    if (cp && !cp.isFinalTreasure) {
      throw new Error(
        `Unauthorized: Volunteer is assigned to Checkpoint #${cp.sequenceNumber} ("${cp.name}"). Only Final Vault Marshalls or Admins are authorized to verify physical treasure box claims.`
      );
    }
  }

  return {
    user: staff,
    isAdmin: staff.role === "ADMIN",
  };
}

/**
 * Confirms or rejects a pending prize claim with atomic protection.
 */
export async function verifyPrizeClaim(
  staffUserId: string,
  claimId: string,
  status: "CONFIRMED" | "REJECTED",
  volunteerNotes?: string
) {
  await connectToDatabase();

  const { isAdmin, user: staff } = await authorizeVaultStaff(staffUserId);

  const gameStatus = await getGameStatus();
  if (gameStatus === "WAITING") {
    throw new Error("The hunt has not started yet. Prize claims cannot be verified.");
  }
  if (gameStatus === "PAUSED") {
    throw new Error("The hunt is currently paused. Prize verifications are temporarily blocked.");
  }
  if (gameStatus === "CONCLUDED" && !isAdmin) {
    throw new Error("The hunt has concluded. Only Administrators can perform post-event audit verifications.");
  }

  const claim = await PrizeClaim.findById(claimId);
  if (!claim) throw new Error("Prize claim record not found.");

  if (claim.status === "CONFIRMED") {
    throw new Error("This prize claim has already been confirmed and handed over.");
  }

  if (status === "REJECTED") {
    claim.status = "REJECTED";
    claim.volunteerId = staffUserId;
    claim.volunteerNotes = volunteerNotes || "Claim rejected by Marshall.";
    claim.verifiedAt = new Date();
    await claim.save();

    await AuditLog.create({
      action: "PRIZE_CLAIM_REJECTED",
      actorRole: isAdmin ? "ADMIN" : "VOLUNTEER",
      actorId: staffUserId,
      details: JSON.stringify({
        claimId,
        teamId: claim.teamId,
        boxNumber: claim.boxNumber,
        notes: volunteerNotes,
      }),
    });

    return {
      id: String(claim._id),
      boxNumber: claim.boxNumber,
      claimCode: claim.claimCode,
      status: claim.status,
      team: null,
      volunteer: null,
    };
  }

  // Attempting CONFIRMED status
  const existingWinner = await PrizeClaim.findOne({
    boxNumber: claim.boxNumber,
    status: "CONFIRMED",
    _id: { $ne: claim._id },
  });

  if (existingWinner) {
    throw new Error(
      `Conflict: Prize Box #${claim.boxNumber} has already been verified and awarded to another team.`
    );
  }

  const teamAlreadyWon = await PrizeClaim.findOne({
    teamId: claim.teamId,
    status: "CONFIRMED",
    _id: { $ne: claim._id },
  });

  if (teamAlreadyWon) {
    throw new Error(
      `Conflict: This team has already been awarded Box #${teamAlreadyWon.boxNumber}. Only one prize box is allowed per team.`
    );
  }

  let transactionSupported = true;
  let committed = false;
  let dbSession: mongoose.ClientSession | null = null;

  try {
    dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    claim.status = "CONFIRMED";
    claim.volunteerId = staffUserId;
    claim.volunteerNotes = volunteerNotes || null;
    claim.verifiedAt = new Date();

    await claim.save({ session: dbSession });
    await Team.findByIdAndUpdate(
      claim.teamId,
      {
        $set: {
          status: "COMPLETED",
          currentStage: "FINISHED",
          completedAt: new Date(),
        },
      },
      { session: dbSession }
    );
    await dbSession.commitTransaction();
    committed = true;
  } catch {
    if (dbSession) {
      try {
        await dbSession.abortTransaction();
      } catch {}
    }
    transactionSupported = false;
  } finally {
    if (dbSession) {
      try {
        await dbSession.endSession();
      } catch {}
    }
  }

  // Standalone fallback without transactions
  if (!committed) {
    claim.status = "CONFIRMED";
    claim.volunteerId = staffUserId;
    claim.volunteerNotes = volunteerNotes || null;
    claim.verifiedAt = new Date();
    await claim.save();
    await Team.findByIdAndUpdate(claim.teamId, {
      $set: {
        status: "COMPLETED",
        currentStage: "FINISHED",
        completedAt: new Date(),
      },
    });
  }

  const team = await Team.findById(claim.teamId).select("teamId name").lean();

  await AuditLog.create({
    action: "PRIZE_CLAIM_CONFIRMED",
    actorRole: staff.role || "VOLUNTEER",
    actorId: staffUserId,
    details: JSON.stringify({
      claimId,
      teamId: team?.teamId,
      boxNumber: claim.boxNumber,
      notes: volunteerNotes,
      transactionSupported,
    }),
  });

  // Check if all 3 prize boxes are now confirmed -> triggers broadcast and conclusion
  await checkAndTriggerHuntOver(staff.role || "VOLUNTEER", staffUserId);

  return {
    id: String(claim._id),
    boxNumber: claim.boxNumber,
    claimCode: claim.claimCode,
    status: claim.status,
    team: team ? { teamId: team.teamId, name: team.name } : null,
    volunteer: { username: staff.username, name: staff.name },
  };
}

/**
 * Direct physical verification of a box by an authorized Marshall or Administrator.
 * Can be used when a team physically presents a box at the vault desk.
 */
export async function directVerifyPrizeClaim(
  staffUserId: string,
  input: {
    teamObjectId: string;
    boxNumber: number;
    volunteerNotes?: string;
  }
) {
  await connectToDatabase();

  const { isAdmin, user: staff } = await authorizeVaultStaff(staffUserId);

  const gameStatus = await getGameStatus();
  if (gameStatus === "WAITING") {
    throw new Error("The hunt has not started yet. Prize claims cannot be verified.");
  }
  if (gameStatus === "PAUSED") {
    throw new Error("The hunt is currently paused. Prize verifications are temporarily blocked.");
  }
  if (gameStatus === "CONCLUDED" && !isAdmin) {
    throw new Error("The hunt has concluded. Only Administrators can perform post-event audit verifications.");
  }

  if (![1, 2, 3].includes(input.boxNumber)) {
    throw new Error("Invalid box selection. Choose Box 1, Box 2, or Box 3.");
  }

  const team = await Team.findById(input.teamObjectId);
  if (!team) throw new Error("Team not found.");

  if (team.currentStage !== "TREASURE_SEARCH" && team.currentStage !== "FINISHED") {
    throw new Error("Security violation: Team is not eligible for final treasure verification.");
  }

  // Verify Box is not already won
  const existingWinner = await PrizeClaim.findOne({
    boxNumber: input.boxNumber,
    status: "CONFIRMED",
  });
  if (existingWinner) {
    throw new Error(`Conflict: Prize Box #${input.boxNumber} has already been awarded to another team.`);
  }

  // Verify Team has not already won
  const teamAlreadyWon = await PrizeClaim.findOne({
    teamId: String(team._id),
    status: "CONFIRMED",
  });
  if (teamAlreadyWon) {
    throw new Error(`Conflict: Team ${team.name} has already won Box #${teamAlreadyWon.boxNumber}.`);
  }

  // Create or update claim document
  const codeSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const claimCode = `BOX${input.boxNumber}-${team.teamId}-DIR-${codeSuffix}`;

  let claim = await PrizeClaim.findOne({ teamId: String(team._id) });
  if (claim) {
    claim.boxNumber = input.boxNumber;
    claim.claimCode = claimCode;
    claim.status = "CONFIRMED";
    claim.volunteerId = staffUserId;
    claim.volunteerNotes = input.volunteerNotes || "Direct Marshall physical verification";
    claim.verifiedAt = new Date();
    await claim.save();
  } else {
    claim = await PrizeClaim.create({
      teamId: String(team._id),
      boxNumber: input.boxNumber,
      claimCode,
      status: "CONFIRMED",
      volunteerId: staffUserId,
      volunteerNotes: input.volunteerNotes || "Direct Marshall physical verification",
      verifiedAt: new Date(),
    });
  }

  team.status = "COMPLETED";
  team.currentStage = "FINISHED";
  team.completedAt = new Date();
  await team.save();

  await AuditLog.create({
    action: "PRIZE_CLAIM_DIRECT_CONFIRMED",
    actorRole: isAdmin ? "ADMIN" : "VOLUNTEER",
    actorId: staffUserId,
    details: JSON.stringify({
      teamId: team.teamId,
      teamName: team.name,
      boxNumber: input.boxNumber,
      claimCode,
    }),
  });

  // Check if all 3 prize boxes are now confirmed
  await checkAndTriggerHuntOver(isAdmin ? "ADMIN" : "VOLUNTEER", staffUserId);

  return {
    success: true,
    boxNumber: input.boxNumber,
    claimCode,
    teamId: team.teamId,
    teamName: team.name,
    message: `Physical Box #${input.boxNumber} successfully verified for Team ${team.teamId} (${team.name})!`,
  };
}

/**
 * Releases or rejects a pending claim with an explicit audit note, allowing re-submission.
 */
export async function releasePendingClaim(
  staffUserId: string,
  claimId: string,
  reason: string
) {
  await connectToDatabase();
  const { user: staff } = await authorizeVaultStaff(staffUserId);

  const claim = await PrizeClaim.findById(claimId);
  if (!claim) throw new Error("Prize claim record not found.");

  if (claim.status !== "PENDING_VERIFICATION") {
    throw new Error(`Cannot release claim with status "${claim.status}". Only pending claims can be released.`);
  }

  const cleanReason = reason.trim();
  if (cleanReason.length < 3) {
    throw new Error("Please provide a valid release reason.");
  }

  claim.status = "REJECTED";
  claim.releaseReason = cleanReason;
  claim.volunteerNotes = `Released by Marshall: ${cleanReason}`;
  claim.volunteerId = staffUserId;
  claim.verifiedAt = new Date();
  await claim.save();

  await AuditLog.create({
    action: "PRIZE_CLAIM_RELEASED",
    actorRole: "VOLUNTEER",
    actorId: staffUserId,
    details: JSON.stringify({
      claimId,
      teamId: claim.teamId,
      boxNumber: claim.boxNumber,
      reason: cleanReason,
    }),
  });

  await checkAndTriggerHuntOver(staff.role || "VOLUNTEER", staffUserId);

  return {
    success: true,
    message: `Claim for Box #${claim.boxNumber} successfully released. Team can re-submit if eligible.`,
  };
}

/**
 * Lists all claims for the Volunteer / Marshall Console with team and staff details.
 */
export async function listAllClaimsForVolunteer() {
  await connectToDatabase();

  const [claims, teams, users] = await Promise.all([
    PrizeClaim.find({}).sort({ claimedAt: 1 }).lean(),
    Team.find({}).select("teamId name leaderName leaderPhone currentStage status").lean(),
    User.find({}).select("username name role").lean(),
  ]);

  const teamMap = new Map<string, typeof teams[0]>();
  for (const t of teams) {
    teamMap.set(String(t._id), t);
  }

  const userMap = new Map<string, typeof users[0]>();
  for (const u of users) {
    userMap.set(String(u._id), u);
  }

  const eligibleTeams = teams
    .filter((t) => t.currentStage === "TREASURE_SEARCH" && !claims.some((c) => String(c.teamId) === String(t._id) && c.status === "CONFIRMED"))
    .map((t) => ({
      id: String(t._id),
      teamId: t.teamId,
      name: t.name,
      leaderName: t.leaderName,
      leaderPhone: t.leaderPhone,
    }));

  const enrichedClaims = claims.map((c) => {
    const t = teamMap.get(c.teamId);
    const u = c.volunteerId ? userMap.get(c.volunteerId) : null;

    return {
      id: String(c._id),
      boxNumber: c.boxNumber,
      claimCode: c.claimCode,
      status: c.status,
      claimedAt: c.claimedAt,
      volunteerNotes: c.volunteerNotes || null,
      releaseReason: c.releaseReason || null,
      team: t
        ? {
            id: String(t._id),
            teamId: t.teamId,
            name: t.name,
            leaderName: t.leaderName,
            leaderPhone: t.leaderPhone,
          }
        : {
            id: "",
            teamId: "UNKNOWN",
            name: "Unknown Team",
            leaderName: "",
            leaderPhone: "",
          },
      volunteer: u
        ? {
            username: u.username,
            name: u.name,
            role: u.role,
          }
        : null,
    };
  });

  const confirmedBoxNumbers = new Set(
    claims.filter((c) => c.status === "CONFIRMED").map((c) => c.boxNumber)
  );

  const boxesStatus = [1, 2, 3].map((boxNumber) => {
    const winnerClaim = claims.find((c) => c.boxNumber === boxNumber && c.status === "CONFIRMED");
    const winningTeam = winnerClaim ? teamMap.get(winnerClaim.teamId) : null;
    const pendingClaim = claims.find((c) => c.boxNumber === boxNumber && c.status === "PENDING_VERIFICATION");
    const pendingTeam = pendingClaim ? teamMap.get(pendingClaim.teamId) : null;

    return {
      boxNumber,
      isAvailable: !confirmedBoxNumbers.has(boxNumber),
      status: winnerClaim ? "CONFIRMED" : pendingClaim ? "PENDING_VERIFICATION" : "AVAILABLE",
      winningTeam: winningTeam ? { teamId: winningTeam.teamId, name: winningTeam.name } : null,
      pendingTeam: pendingTeam ? { teamId: pendingTeam.teamId, name: pendingTeam.name } : null,
    };
  });

  let activeBoxNumber: number | null = 1;
  if (confirmedBoxNumbers.has(1)) activeBoxNumber = 2;
  if (confirmedBoxNumbers.has(2)) activeBoxNumber = 3;
  if (confirmedBoxNumbers.has(3) || confirmedBoxNumbers.size >= 3) activeBoxNumber = null;

  return {
    claims: enrichedClaims,
    eligibleTeams,
    boxesStatus,
    activeBoxNumber,
    allBoxesClaimed: confirmedBoxNumbers.size >= 3,
  };
}
