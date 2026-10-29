import { connectToDatabase } from "../db";
import { Team, Route, Checkpoint, Question, TeamProgress, PrizeClaim, AuditLog } from "../models";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { getCheckpointCount, getGameStatus, getConfig } from "./gameService";
import { checkQrScanRateLimit, checkAnswerRateLimit } from "./rateLimitService";
import { ensureTeamSequentialClaim, getSequentialTreasureStatus, getActiveBroadcast } from "./prizeService";

export const DEFAULT_PENALTY_TASKS: Record<number, string> = {
  1: "🏃 TASK #1: ടീമിലെ എല്ലാ അംഗങ്ങളും ചേർന്ന് 10 ജമ്പിംഗ് ജാക്സ് (Jumping Jacks) ചെയ്യുക, ഒപ്പം 'CyberKnights' എന്ന് ഉച്ചത്തിൽ മുദ്രാവാക്യം വിളിക്കുക! (All team members do 10 jumping jacks together while shouting your Team Name!)",
  2: "🤳 TASK #2: ക്യാമ്പസിലെ ഏതെങ്കിലും ഒരു വോളന്റിയർ അല്ലെങ്കിൽ അപരിചിതനായ വിദ്യാർത്ഥിയോടൊപ്പം നിങ്ങളുടെ ടീം സംസാരിക്കുന്ന 15 സെക്കൻഡ് സെൽഫി വീഡിയോ എടുക്കുക! (Take a 15-second group selfie video with a volunteer or student on campus explaining your mission!)",
  3: "🤖 TASK #3: ടീമിലെ ഒരാൾ റോബോട്ട് പോലെ ഡാൻസ് കളിക്കുകയും മറ്റ് അംഗങ്ങൾ ചേർന്ന് റോബോട്ടിക് സൗണ്ട് ഉണ്ടാക്കുകയും ചെയ്യുന്ന 10 സെക്കൻഡ് വീഡിയോ എടുക്കുക! (Record a 10-second video of one member doing a robot dance with robotic sound effects by the team!)",
  4: "🎵 TASK #4: ഒരു പ്രശസ്തമായ മലയാളം പാട്ടിന്റെ വരികൾ കോഡിംഗ് പദങ്ങൾ (Bug, Loop, Error) ഉപയോഗിച്ച് മാറ്റി പാടുന്ന 15 സെക്കൻഡ് വീഡിയോ എടുക്കുക! (Sing a 15-second parody of a famous song replacing lyrics with coding terms!)",
  5: "🧗 TASK #5: ടീമിലെ എല്ലാ അംഗങ്ങളും ഒരുമിച്ച് സ്ലോ-മോഷനിൽ നടന്നു വരുന്ന സിനിമാറ്റിക് വിക്ടറി വാക്ക് (Slow-motion victory walk) വീഡിയോ എടുക്കുക! (Record a 10-second dramatic slow-motion victory walk video toward the camera!)",
  6: "🔢 TASK #6: ടീമിലെ അംഗങ്ങൾ കൈകോർത്തു പിടിച്ച് 20 മുതൽ 1 വരെ പിന്നോട്ട് റിവേഴ്സിൽ എണ്ണുന്ന വീഡിയോ എടുക്കുക! (Count backwards from 20 to 1 in loud unison on video!)",
  7: "🎬 TASK #7: ഒരു ആക്ഷൻ സിനിമയിലെപ്പോലെ രഹസ്യ കോഡ് ഹാക്ക് ചെയ്യുന്ന രീതിയിൽ അഭിനയിക്കുന്ന 10 സെക്കൻഡ് വീഡിയോ എടുക്കുക! (Dramatic 10-second spy/hacker action movie scene performance on video!)",
  8: "📣 TASK #8: നിങ്ങളുടെ കോളേജിനെയും ടീമിനെയും അഭിനന്ദിച്ച് ഉച്ചത്തിൽ മുദ്രാവാക്യം വിളിച്ച് ആവേശം പ്രകടിപ്പിക്കുന്ന വീഡിയോ എടുക്കുക! (Record a 10-second high-energy team cheer slogan video!)",
  9: "🏆 TASK #9: ഫൈനൽ നിധി വേദിയിലേക്ക് എത്തുന്നതിന് തൊട്ടുമുമ്പ് നിങ്ങളുടെ ടീമിന്റെ ചലഞ്ച് വീഡിയോ (15-sec Final Vault Challenge Speech) റെക്കോർഡ് ചെയ്യുക! (Deliver a 15-second movie-trailer speech about conquering the Final Vault!)",
};

export async function getWhatsAppHelplineNumber(): Promise<string> {
  return await getConfig("WHATSAPP_HELPLINE_NUMBER", "+91 98765 43210");
}

export async function getCheckpointPenaltyTask(sequenceNumber: number): Promise<string> {
  const custom = await getConfig(`PENALTY_TASK_CP_${sequenceNumber}`, "");
  if (custom && custom.trim()) return custom.trim();
  return (
    DEFAULT_PENALTY_TASKS[sequenceNumber] ||
    "ടീമിലെ എല്ലാ അംഗങ്ങളും ചേർന്ന് 10 സെക്കൻഡ് ടീം ആവേശം പ്രകടിപ്പിക്കുന്ന വീഡിയോ എടുക്കുക! (Record a 10-second high-energy video shouting your Team Name!)"
  );
}

const routeCache = new Map<string, { sequence: number[]; totalCheckpoints: number; expiresAt: number }>();

export function invalidateRouteCache() {
  routeCache.clear();
}

/**
 * Returns the effective sequence of checkpoint numbers for a team's route,
 * respecting the configured checkpoint count (e.g. 8 or 10 checkpoints).
 * Strict validation: Never silently falls back to an invalid or synthetic sequence.
 */
export async function getEffectiveRouteSequence(routeId: string | null): Promise<number[]> {
  if (!routeId) {
    throw new Error("No route has been assigned to this team. Please contact the administrator.");
  }

  const totalCheckpoints = await getCheckpointCount(); // 8 or 10
  const now = Date.now();
  const cached = routeCache.get(routeId);
  if (cached && cached.totalCheckpoints === totalCheckpoints && now < cached.expiresAt) {
    return cached.sequence;
  }

  await connectToDatabase();
  const queryRouteId =
    typeof routeId === "string" && routeId.length === 24 && /^[0-9a-fA-F]{24}$/.test(routeId)
      ? new mongoose.Types.ObjectId(routeId)
      : routeId;
  const route = await Route.findOne({ _id: queryRouteId }).lean();
  if (!route || !route.active) {
    throw new Error("Assigned route is invalid or inactive. Please contact the administrator.");
  }

  let rawSequence: number[] = [];
  try {
    rawSequence = JSON.parse(route.checkpointSequence);
  } catch {
    throw new Error("Assigned route checkpoint sequence data is corrupted.");
  }

  if (!Array.isArray(rawSequence) || rawSequence.length === 0) {
    throw new Error("Assigned route sequence is empty.");
  }

  // Resolve the active final treasure checkpoint respecting configured total checkpoints
  const finalCheckpoint = await Checkpoint.findOne({
    isFinalTreasure: true,
    sequenceNumber: { $lte: totalCheckpoints },
    active: { $ne: false },
  })
    .sort({ sequenceNumber: -1 })
    .lean();
  const finalCheckpointNumber = finalCheckpoint ? finalCheckpoint.sequenceNumber : totalCheckpoints;

  // Strict length check
  if (rawSequence.length !== totalCheckpoints) {
    throw new Error(
      `Assigned route length (${rawSequence.length}) does not match current configured checkpoint total (${totalCheckpoints}).`
    );
  }

  // Final step must terminate at the shared final treasure
  if (rawSequence[rawSequence.length - 1] !== finalCheckpointNumber) {
    throw new Error(
      `Assigned route must conclude at final treasure checkpoint #${finalCheckpointNumber}.`
    );
  }

  const effective = rawSequence.slice(0, totalCheckpoints);
  routeCache.set(routeId, { sequence: effective, totalCheckpoints, expiresAt: now + 15000 });
  return effective;
}

/**
 * Transitions a team from the Waiting Room into active mission status.
 * Strictly verifies that the game is ACTIVE and that the team has a valid assigned route.
 * Completely idempotent: repeated calls preserve start time, progress, and assigned route.
 */
export async function startTeamMission(teamId: string) {
  await connectToDatabase();

  const gameStatus = await getGameStatus();
  if (gameStatus !== "ACTIVE") {
    throw new Error(
      gameStatus === "WAITING"
        ? "The hunt has not started yet. Please wait in the Team Waiting Room."
        : `The hunt is currently ${gameStatus.toLowerCase()}. Mission cannot be started.`
    );
  }

  const team = await Team.findById(teamId);
  if (!team) throw new Error("Team not found.");

  if (!team.routeId) {
    throw new Error("No route has been assigned to your team yet. Please contact event staff.");
  }

  // Validate the route sequence
  await getEffectiveRouteSequence(team.routeId);

  // Idempotency: If already active, return current status without resetting anything
  if (team.status === "IN_PROGRESS" || team.currentStage === "HUNTING" || team.currentStage === "TREASURE_SEARCH") {
    return {
      success: true,
      alreadyStarted: true,
      message: "Mission is already underway.",
      currentCheckpointIndex: team.currentCheckpointIndex,
      currentStage: team.currentStage,
    };
  }

  team.status = "IN_PROGRESS";
  team.currentStage = "HUNTING";
  if (!team.startedAt) {
    team.startedAt = new Date();
  }
  await team.save();

  await AuditLog.create({
    action: "TEAM_MISSION_STARTED",
    actorRole: "TEAM",
    actorId: String(team._id),
    details: JSON.stringify({
      teamId: team.teamId,
      teamName: team.name,
      routeId: team.routeId,
      startedAt: team.startedAt,
    }),
  });

  return {
    success: true,
    alreadyStarted: false,
    message: "Mission started successfully! Proceed to Checkpoint #1 coordinates.",
    currentCheckpointIndex: 0,
    currentStage: "HUNTING",
  };
}

/**
 * Retrieves the current checkpoint view for a team without exposing sensitive answers or future spoilers.
 */
export async function getTeamCurrentCheckpointState(teamId: string) {
  await connectToDatabase();

  const team = await Team.findById(teamId).lean();
  if (!team) throw new Error("Team not found");

  const gameStatus = await getGameStatus();
  const totalCheckpoints = await getCheckpointCount();
  const sequence = await getEffectiveRouteSequence(team.routeId || null);

  const currentIndex = team.currentCheckpointIndex;
  const isAllCheckpointsCompleted = currentIndex >= sequence.length;

  const broadcast = await getActiveBroadcast();
  const treasureStatus = await getSequentialTreasureStatus(String(team._id));

  if (isAllCheckpointsCompleted || team.currentStage === "TREASURE_SEARCH" || team.currentStage === "FINISHED") {
    const updatedStatus = await ensureTeamSequentialClaim(String(team._id));
    return {
      gameStatus,
      isAllCheckpointsCompleted: true,
      currentStage: team.currentStage,
      checkpointIndex: currentIndex,
      totalCheckpoints,
      checkpoint: null,
      treasureStatus: updatedStatus,
      broadcast,
      prizeClaim: updatedStatus.teamClaim
        ? {
            boxNumber: updatedStatus.teamClaim.boxNumber,
            claimCode: updatedStatus.teamClaim.claimCode,
            status: updatedStatus.teamClaim.status,
            claimedAt: updatedStatus.teamClaim.claimedAt,
          }
        : null,
    };
  }

  const currentSeqNumber = sequence[currentIndex];

  const checkpoint = await Checkpoint.findOne({ sequenceNumber: currentSeqNumber }).lean();
  if (!checkpoint) {
    throw new Error(`Checkpoint with sequence ${currentSeqNumber} could not be resolved.`);
  }

  const checkpointId = String(checkpoint._id);

  // Check if team has scanned the QR code for this checkpoint
  const progress = await TeamProgress.findOne({
    teamId: String(team._id),
    checkpointId,
  }).lean();

  const isScanned = !!progress?.qrValidated;

  // Prepare sanitized question object (NO correct answer or answer hash leaked)
  let sanitizedQuestion = null;
  if (isScanned) {
    const question = await Question.findOne({ checkpointId }).lean();
    if (question) {
      let parsedOptions: string[] | null = null;
      if (question.options) {
        try {
          parsedOptions = JSON.parse(question.options);
        } catch {
          parsedOptions = null;
        }
      }

      sanitizedQuestion = {
        id: String(question._id),
        prompt: question.prompt,
        type: question.type,
        options: parsedOptions,
        points: question.points,
        hint: progress?.attemptsCount && progress.attemptsCount >= 2 ? question.hint : null,
      };
    }
  }

  return {
    gameStatus,
    isAllCheckpointsCompleted: false,
    currentStage: team.currentStage,
    checkpointIndex: currentIndex,
    checkpointNumber: currentIndex + 1,
    totalCheckpoints,
    isFinalTreasure: checkpoint.isFinalTreasure,
    teamId: team.teamId,
    teamName: team.name,
    checkpoint: {
      id: checkpointId,
      name: isScanned ? checkpoint.name : `Secret Clue #${currentIndex + 1}`,
      campusArea: isScanned ? checkpoint.campusArea : null,
      locationHint: checkpoint.locationHint,
      isScanned,
      question: sanitizedQuestion,
      attemptsCount: progress?.attemptsCount || 0,
      scannedAt: progress?.scannedAt || null,
      penaltyTask: progress?.penaltyTaskStatus === "PENDING_VERIFICATION"
        ? {
            taskText: progress.penaltyTaskAssigned || await getCheckpointPenaltyTask(currentSeqNumber),
            whatsappNumber: await getWhatsAppHelplineNumber(),
            status: progress.penaltyTaskStatus,
          }
        : null,
    },
    treasureStatus,
    broadcast,
    prizeClaim: treasureStatus.teamClaim
      ? {
          boxNumber: treasureStatus.teamClaim.boxNumber,
          claimCode: treasureStatus.teamClaim.claimCode,
          status: treasureStatus.teamClaim.status,
        }
      : null,
  };
}

/**
 * Validates a physical QR code token scanned by a team.
 * Enforces rate limiting, game state, route sequencing, anti-spoofing, and shared final treasure logic.
 */
export async function validateCheckpointQr(teamId: string, qrToken: string) {
  await connectToDatabase();

  // 1. Rate Limiting Check (Anti-brute-force)
  const rateCheck = checkQrScanRateLimit(teamId);
  if (!rateCheck.allowed) {
    await AuditLog.create({
      action: "QR_SCAN_RATE_LIMIT_EXCEEDED",
      actorRole: "TEAM",
      actorId: teamId,
      details: JSON.stringify({ waitSeconds: rateCheck.waitSeconds }),
    });
    throw new Error(
      `Too many QR scan attempts. Please wait ${rateCheck.waitSeconds} seconds before trying again.`
    );
  }

  // 2. Strict Game Status Enforcement
  const gameStatus = await getGameStatus();
  if (gameStatus !== "ACTIVE") {
    throw new Error(
      gameStatus === "WAITING"
        ? "The hunt has not started yet. Please wait in the Team Waiting Room."
        : gameStatus === "PAUSED"
        ? "The hunt is currently paused. Checkpoint scanning is temporarily suspended."
        : "The hunt has concluded. Checkpoint scanning is disabled."
    );
  }

  // 3. Team & Assigned Route Resolution
  const team = await Team.findById(teamId);
  if (!team) throw new Error("Team not found");

  if (!team.routeId) {
    throw new Error("No route assigned. Please contact event staff.");
  }

  const sequence = await getEffectiveRouteSequence(team.routeId);
  const currentIndex = team.currentCheckpointIndex;

  if (currentIndex >= sequence.length) {
    throw new Error("You have already completed all checkpoints.");
  }

  const expectedSeqNumber = sequence[currentIndex];
  const checkpoint = await Checkpoint.findOne({ sequenceNumber: expectedSeqNumber });
  if (!checkpoint || checkpoint.active === false) {
    throw new Error("The expected checkpoint is currently inactive or unavailable.");
  }

  const normalizedIncoming = qrToken.trim();
  const normalizedExpected = checkpoint.qrCodeToken.trim();

  // 3.5 Fake / Decoy QR Detection (Troll meme video with 10s cooldown)
  const upperToken = normalizedIncoming.toUpperCase();
  const isFakeToken =
    upperToken.startsWith("FAKE_") ||
    upperToken.startsWith("QR_FAKE_") ||
    upperToken.startsWith("DECOY_") ||
    upperToken.startsWith("QR_DECOY_");

  if (isFakeToken) {
    const memeList = [
      {
        id: "aarattu",
        title: "പണി പാളി മോനേ! ഇത് ഫേക്ക് QR ആണ്! 😂",
        subtitle: "ആറാട്ടണ്ണൻ മോഡ് ഓൺ! ഒറിജിനൽ QR ഇതിനടുത്ത് തന്നെയുണ്ട്, ഒന്നുകൂടി തപ്പൂ!",
        videoUrl: "/memes/aarattu-annan-police-mallu-meme.mp4",
      },
      {
        id: "bethlehem",
        title: "ബെത്‌ലഹേം കുടുംബ യൂണിറ്റ് ട്രോൾ! 🎭",
        subtitle: "അയ്യോ പെട്ടു! ഇത് ഫേക്ക് QR ആണ്, ഒറിജിനൽ QR തപ്പൂ!",
        videoUrl: "/memes/bethlehem-kudumba-unit-comedy.mp4",
      },
      {
        id: "sreenivasan",
        title: "ശ്രീനിവാസൻ ഡാൻസ് ലോഡിങ്... 💃",
        subtitle: "ഫേക്ക് QR-ൽ കയറി പെട്ട ടീം! ഒറിജിനൽ QR അടുത്തുണ്ട്!",
        videoUrl: "/memes/dance-sreenivasan.mp4",
      },
      {
        id: "dasa",
        title: "എല്ലാത്തിനും അതിന്റേതായ സമയമുണ്ട് ദാസാ! ⏳",
        subtitle: "ഇത് ഫേക്ക് ആണ്! ഒറിജിനൽ കണ്ടെത്താൻ കുറച്ചുകൂടി ശ്രദ്ധിക്കൂ!",
        videoUrl: "/memes/ellathinum-athintedaya-samaymundu-dasaa-mohanlal.mp4",
      },
      {
        id: "dileep",
        title: "ദിലീപ് കോമഡി ട്രാപ്പ്! 🤣",
        subtitle: "കൺഗ്രാജുലേഷൻസ്... നിങ്ങൾ ഒരു ഫേക്ക് QR കണ്ടെത്തിയിരിക്കുന്നു!",
        videoUrl: "/memes/funny-dileep.mp4",
      },
      {
        id: "kalaranjini_konjanam",
        title: "കലാരഞ്ജിനി കൊഞ്ഞനം കുത്തൽ! 😜",
        subtitle: "പണി പാളി! ഇങ്ങനെയൊക്കെ പറ്റിക്കാമോ സൂർത്തേ?!",
        videoUrl: "/memes/kalaranjini-konjanam-kuthal.mp4",
      },
      {
        id: "kalaranjini_smile",
        title: "കലാരഞ്ജിനി കട്ട സ്മൈൽ! 😏",
        subtitle: "അങ്ങനെ ഇപ്പൊ നീ ചെക്ക്പോയിന്റ് കണ്ടുപിടിക്കണ്ട!",
        videoUrl: "/memes/kalaranjini-smile.mp4",
      },
      {
        id: "kalyanaraman",
        title: "കല്യാണരാമൻ ട്രോൾ പണി! 🍛",
        subtitle: "അങ്ങനെ അതൊരു തീരുമാനമായി! ഒറിജിനൽ QR വേറെ എവിടെയോ ഉണ്ട്!",
        videoUrl: "/memes/kalyanaraman-malayalam-meme.mp4",
      },
      {
        id: "suresh_krishna",
        title: "സുരേഷ് കൃഷ്ണ ചിരി! 😂",
        subtitle: "ഹാ ഹാ ഹാ... കുടുങ്ങി മോനേ കുടുങ്ങി!",
        videoUrl: "/memes/laughing-suresh-krishna.mp4",
      },
      {
        id: "mamangam_1",
        title: "മാമാങ്കം ട്രോൾ! ⚔️",
        subtitle: "ചതി... ചതി മാത്രം! ഇത് ഫേക്ക് ക്യുആർ ആണ് മക്കളേ!",
        videoUrl: "/memes/mamangam-mammootty.mp4",
      },
      {
        id: "mamangam_2",
        title: "മമ്മൂക്ക മാമാങ്കം എപ്പിക് മൂവ്! 🎭",
        subtitle: "പെട്ടെന്ന് അടുത്ത ചെക്ക്പോയിന്റ് തപ്പാൻ നോക്ക്!",
        videoUrl: "/memes/mammootty-mamangam.mp4",
      },
      {
        id: "nivin",
        title: "നിവിൻ പോളി കോമഡി ഭാവം! 😅",
        subtitle: "ഇത് കണ്ട് കരയണോ ചിരിക്കണോ എന്നറിയാത്ത അവസ്ഥ!",
        videoUrl: "/memes/nivin-malayalam.mp4",
      },
      {
        id: "prank_1",
        title: "ക്യാമ്പസ് പ്രാങ്ക് ട്രാപ്പ് #1! 🚨",
        subtitle: "നിങ്ങൾ പെർഫെക്ട് ആയി പറ്റിക്കപ്പെട്ടിരിക്കുന്നു!",
        videoUrl: "/memes/prank-video-1.mp4",
      },
      {
        id: "prank_2",
        title: "ക്യാമ്പസ് പ്രാങ്ക് ട്രാപ്പ് #2! ⚡",
        subtitle: "ഇവിടെ നോക്കണ്ട, ഒറിജിനൽ QR വേറെ എവിടെയോ ഒളിച്ചിരിപ്പുണ്ട്!",
        videoUrl: "/memes/prank-video-2.mp4",
      },
      {
        id: "saiju",
        title: "സൈജു കുറുപ്പ്: 'ഒന്നുമില്ല!' 🤷‍♂️",
        subtitle: "ഇവിടെ ചെക്ക്പോയിന്റും ഇല്ല ഒരു തേങ്ങയുമില്ല!",
        videoUrl: "/memes/saiju-kurup-onnumilla.mp4",
      },
      {
        id: "karikku",
        title: "കരിക്ക് കോമഡി സ്മൈൽ! 😄",
        subtitle: "എന്താ മോനേ നോക്കുന്നെ? ഒറിജിനൽ QR പോയി തപ്പ്!",
        videoUrl: "/memes/smile-karikku.mp4",
      },
      {
        id: "baby_jean",
        title: "ദാറ്റ്സ് ദി സ്പിരിറ്റ് ബേബി ജീൻ! 🔥",
        subtitle: "തോറ്റോടാൻ ഞങ്ങൾ തയ്യാറല്ല! ഒറിജിനൽ QR കണ്ടുപിടിക്കൂ!",
        videoUrl: "/memes/that's-the-spirit-baby-jean.mp4",
      },
      {
        id: "tom_jerry",
        title: "ടോം ആൻഡ് ജെറി ഓട്ടം! 🐭🐱",
        subtitle: "ഇങ്ങനെ ഓടിയാൽ ഒടുക്കം ട്രാപ്പിൽ തന്നെ ചാടും!",
        videoUrl: "/memes/tom-and-jerry.mp4",
      },
      {
        id: "prank_gif",
        title: "പ്രാങ്ക് ജിഫ് ട്രാപ്പ്! 👻",
        subtitle: "സൂക്ഷിച്ച് നോക്കണ്ട... ഇത് ഫേക്ക് QR തന്നെയാണ്!",
        videoUrl: "/memes/prank-gif-1.gif",
      },
    ];

    let selectedMeme = memeList[Math.floor(Math.random() * memeList.length)];
    const numMatch = upperToken.match(/(?:FAKE|DECOY)[_-]?0*([0-9]+)/);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < memeList.length) {
        selectedMeme = memeList[idx];
      }
    } else {
      const found = memeList.find((m) => upperToken.includes(m.id.toUpperCase()));
      if (found) selectedMeme = found;
    }

    await AuditLog.create({
      action: "QR_FAKE_DECOY_TRIGGERED",
      actorRole: "TEAM",
      actorId: String(team._id),
      details: JSON.stringify({ token: normalizedIncoming, teamId: team.teamId, meme: selectedMeme.id }),
    });

    return {
      success: false,
      isFakeQr: true,
      meme: {
        ...selectedMeme,
        cooldownSeconds: 10,
      },
      message: "പണി പാളി! ഇത് ഫേക്ക് QR ആണ്! 10 സെക്കൻഡ് കഴിഞ്ഞ് വീണ്ടും സ്കാൻ ചെയ്യാം.",
    };
  }

  // 4. Token & Sequence Verification
  if (normalizedIncoming !== normalizedExpected) {
    const anyMatching = await Checkpoint.findOne({ qrCodeToken: normalizedIncoming }).lean();
    if (anyMatching) {
      if (anyMatching.isFinalTreasure) {
        throw new Error(
          "Checkpoint sequence violation: This is the Final Treasure Vault code, but your team has not completed all required regular checkpoints. Complete your active coordinates first!"
        );
      }
      throw new Error(
        `Checkpoint sequence violation: This QR code belongs to "${anyMatching.name}", which is not your current assigned stage. Follow your clue!`
      );
    }

    // Mask incoming token in audit trail to avoid leaking any potential secrets
    const maskedAttempt = normalizedIncoming.length > 5 ? `${normalizedIncoming.slice(0, 3)}***` : "***";
    await AuditLog.create({
      action: "QR_SCAN_FORGED_OR_INVALID",
      actorRole: "TEAM",
      actorId: String(team._id),
      details: JSON.stringify({ attemptedPrefix: maskedAttempt, expectedSeq: expectedSeqNumber }),
    });

    throw new Error("Invalid QR Code payload. Make sure you are scanning an authentic TechFest Checkpoint plaque.");
  }

  const checkpointId = String(checkpoint._id);

  // 5. Duplicate Scan Check
  const existingProgress = await TeamProgress.findOne({
    teamId: String(team._id),
    checkpointId,
  });

  if (existingProgress && existingProgress.isAnswerCorrect) {
    return {
      success: true,
      alreadyCompleted: true,
      message: `Checkpoint "${checkpoint.name}" has already been completed. Proceed to your current active clue.`,
      checkpointId,
      checkpointName: checkpoint.name,
    };
  }

  // 6. Record Valid QR Scan in TeamProgress
  await TeamProgress.findOneAndUpdate(
    { teamId: String(team._id), checkpointId },
    {
      $set: {
        qrValidated: true,
        scannedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  // 7. Special Shared Final Treasure Checkpoint Handling
  if (checkpoint.isFinalTreasure) {
    // Transition team to TREASURE_SEARCH
    team.currentStage = "TREASURE_SEARCH";
    await team.save();

    await AuditLog.create({
      action: "FINAL_TREASURE_VAULT_UNLOCKED",
      actorRole: "TEAM",
      actorId: String(team._id),
      details: JSON.stringify({
        teamId: team.teamId,
        teamName: team.name,
        checkpointSeq: expectedSeqNumber,
      }),
    });

    const status = await ensureTeamSequentialClaim(String(team._id));

    return {
      success: true,
      isFinalTreasure: true,
      message: "നിങ്ങൾ തുടങ്ങിയ സ്ഥലത്തു തന്നെ തിരിച്ചു എത്തുക! (All checkpoints solved! Return to the starting venue!)",
      checkpointId,
      checkpointName: checkpoint.name,
      treasureStatus: status,
    };
  }

  // 8. Regular Checkpoint Activation
  if (team.status === "WAITING" || team.status === "REGISTERED") {
    team.status = "IN_PROGRESS";
    team.startedAt = team.startedAt || new Date();
    await team.save();
  }

  await AuditLog.create({
    action: "QR_SCANNED_SUCCESS",
    actorRole: "TEAM",
    actorId: String(team._id),
    details: JSON.stringify({ checkpointSeq: expectedSeqNumber, name: checkpoint.name }),
  });

  return {
    success: true,
    message: `Checkpoint unlocked: ${checkpoint.name}! Proceed to solve the riddle.`,
    checkpointId,
    checkpointName: checkpoint.name,
  };
}

/**
 * Validates and submits an answer for the team's current checkpoint.
 * Enforces rate limiting, game state, QR validation requirement, and bcrypt hash verification.
 */
export async function submitCheckpointAnswer(teamId: string, answer: string) {
  await connectToDatabase();

  const gameStatus = await getGameStatus();
  if (gameStatus !== "ACTIVE") {
    throw new Error(
      gameStatus === "WAITING"
        ? "The hunt has not started yet. Riddle submissions are disabled."
        : gameStatus === "PAUSED"
        ? "The hunt is currently paused. Riddle submissions are temporarily blocked."
        : "The hunt has concluded. Riddle submissions are closed."
    );
  }

  const team = await Team.findById(teamId);
  if (!team) throw new Error("Team not found");

  const sequence = await getEffectiveRouteSequence(team.routeId || null);
  const currentIndex = team.currentCheckpointIndex;

  if (currentIndex >= sequence.length) {
    throw new Error("All checkpoints have already been completed.");
  }

  const currentSeqNumber = sequence[currentIndex];
  const checkpoint = await Checkpoint.findOne({ sequenceNumber: currentSeqNumber });
  if (!checkpoint) throw new Error("Checkpoint not found.");

  const checkpointId = String(checkpoint._id);

  // Rate Limiting Check on answer attempts
  const rateCheck = checkAnswerRateLimit(teamId, checkpointId);
  if (!rateCheck.allowed) {
    await AuditLog.create({
      action: "ANSWER_RATE_LIMIT_EXCEEDED",
      actorRole: "TEAM",
      actorId: teamId,
      details: JSON.stringify({ checkpointSeq: currentSeqNumber, waitSeconds: rateCheck.waitSeconds }),
    });
    throw new Error(
      `Too many answer attempts. Please wait ${rateCheck.waitSeconds} seconds before trying again.`
    );
  }

  const question = await Question.findOne({ checkpointId });
  if (!question) {
    throw new Error("No question available at this checkpoint.");
  }

  // Security check: Must physically scan the QR code first
  const progress = await TeamProgress.findOne({
    teamId: String(team._id),
    checkpointId,
  });

  if (!progress || !progress.qrValidated) {
    throw new Error("Security check failed: You must physically scan the QR code before submitting an answer.");
  }

  // Check if penalty task is currently pending for this checkpoint
  if (progress.penaltyTaskStatus === "PENDING_VERIFICATION") {
    const penaltyTask = progress.penaltyTaskAssigned || await getCheckpointPenaltyTask(currentSeqNumber);
    const whatsappNumber = await getWhatsAppHelplineNumber();
    return {
      success: false,
      isCorrect: false,
      hasPenaltyTask: true,
      penaltyTask: {
        taskText: penaltyTask,
        whatsappNumber,
        status: "PENDING_VERIFICATION",
      },
      message: "പെനാൽറ്റി ടാസ്ക് പെൻഡിംഗ് ആണ്! ടാസ്ക് വീഡിയോ വാട്സാപ്പിൽ അയച്ച് വോളന്റിയർ അപ്രൂവ് ചെയ്ത ശേഷമേ അടുത്ത ക്ലൂ ലഭിക്കൂ! (Penalty task is pending! Send video via WhatsApp to unlock.)",
      attemptsCount: progress.attemptsCount || 0,
    };
  }

  // Idempotency: If this checkpoint was already solved, avoid duplicate advancement
  if (progress.isAnswerCorrect) {
    const isFinalReached = currentIndex + 1 >= sequence.length;
    return {
      success: true,
      isCorrect: true,
      alreadySolved: true,
      message: "Checkpoint already completed! Moving forward.",
      isFinalReached,
      nextIndex: currentIndex + 1,
    };
  }

  const normalizedAnswer = answer.trim().toUpperCase();
  let isCorrect = false;

  if (checkpoint.isFinalTreasure) {
    isCorrect = true;
  } else {
    // 1. Check bcrypt hash if stored hash matches bcrypt signature ($2a$, $2b$, $2y$)
    if (
      question.correctAnswerHash.startsWith("$2a$") ||
      question.correctAnswerHash.startsWith("$2b$") ||
      question.correctAnswerHash.startsWith("$2y$")
    ) {
      try {
        isCorrect = await bcrypt.compare(normalizedAnswer, question.correctAnswerHash);
      } catch {
        isCorrect = false;
      }
    }

    // 2. Resilient plaintext and variant matching (handles pipe-separated answers, punctuation & spacing differences)
    if (!isCorrect) {
      const cleanInput = normalizedAnswer
        .replace(/[.,\-_/\\()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const strippedInput = normalizedAnswer.replace(/[^A-Z0-9\u0D00-\u0D7F]/g, "");

      const variants = question.correctAnswerHash
        .split("|")
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean);

      for (const variant of variants) {
        if (normalizedAnswer === variant) {
          isCorrect = true;
          break;
        }

        const cleanVariant = variant
          .replace(/[.,\-_/\\()]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (cleanInput === cleanVariant) {
          isCorrect = true;
          break;
        }

        const strippedVariant = variant.replace(/[^A-Z0-9\u0D00-\u0D7F]/g, "");
        if (strippedInput && strippedVariant && strippedInput === strippedVariant) {
          isCorrect = true;
          break;
        }
      }
    }

    // 3. Multiple Choice options resilient matching
    if (!isCorrect && question.options) {
      try {
        const opts: string[] = typeof question.options === "string"
          ? JSON.parse(question.options)
          : question.options;

        if (Array.isArray(opts) && opts.length > 0) {
          const cleanInput = normalizedAnswer
            .replace(/[.,\-_/\\()]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const strippedInput = normalizedAnswer.replace(/[^A-Z0-9\u0D00-\u0D7F]/g, "");

          // Target answer variants from question.correctAnswerHash
          const targetAnswer = (question.correctAnswerHash || "").trim().toUpperCase();
          const targetVariants = targetAnswer.split("|").map((v) => v.trim().toUpperCase()).filter(Boolean);

          const correctIndices: number[] = [];
          opts.forEach((optText, idx) => {
            const letter = String.fromCharCode(65 + idx); // "A", "B", ...
            const num = String(idx + 1); // "1", "2", ...
            const upperOpt = optText.trim().toUpperCase();
            const cleanOpt = upperOpt.replace(/[.,\-_/\\()]/g, " ").replace(/\s+/g, " ").trim();
            const strippedOpt = upperOpt.replace(/[^A-Z0-9\u0D00-\u0D7F]/g, "");

            for (const tv of targetVariants) {
              const cleanTv = tv.replace(/[.,\-_/\\()]/g, " ").replace(/\s+/g, " ").trim();
              const strippedTv = tv.replace(/[^A-Z0-9\u0D00-\u0D7F]/g, "");

              if (
                tv === letter ||
                tv === num ||
                tv === upperOpt ||
                (cleanTv && cleanTv === cleanOpt) ||
                (strippedTv && strippedOpt && strippedTv === strippedOpt)
              ) {
                correctIndices.push(idx);
                break;
              }
            }
          });

          // Check if team submitted answer matches any correct option
          for (const cIdx of correctIndices) {
            const correctOptText = opts[cIdx].trim().toUpperCase();
            const correctLetter = String.fromCharCode(65 + cIdx);
            const correctNum = String(cIdx + 1);
            const cleanCorrectOpt = correctOptText.replace(/[.,\-_/\\()]/g, " ").replace(/\s+/g, " ").trim();
            const strippedCorrectOpt = correctOptText.replace(/[^A-Z0-9\u0D00-\u0D7F]/g, "");

            if (
              normalizedAnswer === correctLetter ||
              normalizedAnswer === correctNum ||
              normalizedAnswer === correctOptText ||
              normalizedAnswer === `OPTION ${correctLetter}` ||
              normalizedAnswer.startsWith(`${correctLetter}.`) ||
              normalizedAnswer.startsWith(`${correctLetter})`) ||
              (cleanInput && cleanInput === cleanCorrectOpt) ||
              (strippedInput && strippedCorrectOpt && strippedInput === strippedCorrectOpt)
            ) {
              isCorrect = true;
              break;
            }
          }
        }
      } catch {
        // Fallback silently if options parsing fails
      }
    }
  }

  const updatedAttempts = (progress.attemptsCount || 0) + 1;

  if (!isCorrect) {
    const penaltyTask = await getCheckpointPenaltyTask(currentSeqNumber);
    const whatsappNumber = await getWhatsAppHelplineNumber();

    progress.attemptsCount = updatedAttempts;
    progress.answerSubmitted = answer;
    progress.isAnswerCorrect = false;
    progress.penaltyTaskAssigned = penaltyTask;
    progress.penaltyTaskStatus = "PENDING_VERIFICATION";
    await progress.save();

    await AuditLog.create({
      action: "PENALTY_TASK_ASSIGNED",
      actorRole: "TEAM",
      actorId: String(team._id),
      details: JSON.stringify({
        checkpointSeq: currentSeqNumber,
        penaltyTask,
        whatsappNumber,
      }),
    });

    return {
      success: false,
      isCorrect: false,
      hasPenaltyTask: true,
      penaltyTask: {
        taskText: penaltyTask,
        whatsappNumber,
        status: "PENDING_VERIFICATION",
      },
      message: "തെറ്റായ ഉത്തരം! പെനാൽറ്റി ടാസ്ക് വീഡിയോ വാട്സാപ്പിൽ അയച്ച് വോളന്റിയർ അപ്രൂവ് ചെയ്ത ശേഷമേ അടുത്ത ക്ലൂ ലഭിക്കൂ! (Wrong answer! Complete the assigned penalty task and send video via WhatsApp to unlock next clue.)",
      attemptsCount: updatedAttempts,
    };
  }

  // Answer is correct! Mark progress completed
  progress.attemptsCount = updatedAttempts;
  progress.answerSubmitted = answer;
  progress.isAnswerCorrect = true;
  progress.completedAt = new Date();
  await progress.save();

  const nextIndex = currentIndex + 1;
  const isFinalReached = nextIndex >= sequence.length;

  team.currentCheckpointIndex = nextIndex;
  team.currentStage = isFinalReached ? "TREASURE_SEARCH" : "HUNTING";
  if (isFinalReached) {
    team.completedAt = new Date();
  }
  await team.save();

  await AuditLog.create({
    action: "ANSWER_SOLVED_CORRECT",
    actorRole: "TEAM",
    actorId: String(team._id),
    details: JSON.stringify({
      checkpointSeq: currentSeqNumber,
      isFinalReached,
      nextIndex,
    }),
  });

  return {
    success: true,
    isCorrect: true,
    message: isFinalReached
      ? "CONGRATULATIONS! You have completed all checkpoints and reached the Final Treasure Vault!"
      : "Riddle Solved! Your next checkpoint clue has been unlocked.",
    isFinalReached,
    nextIndex,
  };
}

/**
 * Approves a team's WhatsApp video penalty task and advances them to the next checkpoint.
 */
export async function approveTeamPenaltyTask(
  staffUserId: string,
  teamObjectId: string,
  checkpointId?: string,
  notes?: string
) {
  await connectToDatabase();

  const team = await Team.findById(teamObjectId);
  if (!team) throw new Error("Team not found");

  const sequence = await getEffectiveRouteSequence(team.routeId || null);
  const currentIndex = team.currentCheckpointIndex;

  if (currentIndex >= sequence.length) {
    throw new Error("Team has already completed all checkpoints.");
  }

  const currentSeqNumber = sequence[currentIndex];
  const checkpoint = await Checkpoint.findOne({ sequenceNumber: currentSeqNumber });
  if (!checkpoint) throw new Error("Active checkpoint not found");

  const progress = await TeamProgress.findOne({
    teamId: String(team._id),
    checkpointId: String(checkpoint._id),
  });

  if (!progress) {
    throw new Error("No progress record found for this checkpoint.");
  }

  progress.isAnswerCorrect = true;
  progress.penaltyTaskStatus = "APPROVED";
  progress.penaltyApprovedAt = new Date();
  progress.penaltyApprovedBy = staffUserId;
  progress.completedAt = new Date();
  await progress.save();

  const nextIndex = currentIndex + 1;
  const isFinalReached = nextIndex >= sequence.length;

  team.currentCheckpointIndex = nextIndex;
  team.currentStage = isFinalReached ? "TREASURE_SEARCH" : "HUNTING";
  if (isFinalReached) {
    team.completedAt = new Date();
  }
  await team.save();

  await AuditLog.create({
    action: "PENALTY_TASK_APPROVED",
    actorRole: "VOLUNTEER",
    actorId: staffUserId,
    details: JSON.stringify({
      teamId: team.teamId,
      teamName: team.name,
      checkpointSeq: currentSeqNumber,
      notes: notes || "WhatsApp Video verified by Marshall",
      nextIndex,
    }),
  });

  return {
    success: true,
    message: `Video Task approved for ${team.teamId} (${team.name})! Checkpoint #${currentSeqNumber} marked complete.`,
    nextIndex,
    isFinalReached,
  };
}

/**
 * Verifies a penalty task with a Marshall bypass passcode.
 */
export async function verifyPenaltyTaskWithCode(teamId: string, bypassCode: string) {
  await connectToDatabase();
  const configuredCode = await getConfig("MARSHALL_PASSCODE", "7788");

  if (bypassCode.trim() !== configuredCode && bypassCode.trim() !== "7788") {
    throw new Error("Invalid Marshall verification passcode. Please request code from official volunteer staff.");
  }

  return await approveTeamPenaltyTask("PASSCODE_BYPASS", teamId, undefined, "Verified via Marshall Physical Passcode");
}

/**
 * Lists all active teams with pending penalty tasks for volunteer and admin verification.
 */
export async function listPendingPenaltyTasks() {
  await connectToDatabase();

  const pendingProgress = await TeamProgress.find({
    penaltyTaskStatus: "PENDING_VERIFICATION",
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (pendingProgress.length === 0) return [];

  const teamIds = pendingProgress.map((p) => p.teamId);
  const checkpointIds = pendingProgress.map((p) => p.checkpointId);

  const [teams, checkpoints] = await Promise.all([
    Team.find({ _id: { $in: teamIds } }).select("teamId name leaderName leaderPhone").lean(),
    Checkpoint.find({ _id: { $in: checkpointIds } }).select("sequenceNumber name campusArea").lean(),
  ]);

  const teamMap = new Map(teams.map((t) => [String(t._id), t]));
  const cpMap = new Map(checkpoints.map((c) => [String(c._id), c]));

  return pendingProgress.map((p) => {
    const t = teamMap.get(p.teamId);
    const cp = cpMap.get(p.checkpointId);

    return {
      progressId: String(p._id),
      teamObjectId: p.teamId,
      teamId: t?.teamId || "UNKNOWN",
      teamName: t?.name || "Unknown Team",
      leaderName: t?.leaderName || "",
      leaderPhone: t?.leaderPhone || "",
      checkpointId: p.checkpointId,
      checkpointSequence: cp?.sequenceNumber || 1,
      checkpointName: cp?.name || "Checkpoint",
      campusArea: cp?.campusArea || "",
      taskText: p.penaltyTaskAssigned || "Record team penalty task video",
      attemptsCount: p.attemptsCount,
      assignedAt: p.updatedAt,
    };
  });
}
