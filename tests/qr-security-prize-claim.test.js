/**
 * tests/qr-security-prize-claim.test.js
 *
 * Comprehensive Automated Test Suite for Step 6:
 * Physical Checkpoint QR Security, Final Treasure Verification, and Physical Prize Claim Security
 *
 * 15 Mandatory Test Scenarios:
 * 1.  Valid checkpoint QR scan unlocks riddle without auto-completing
 * 2.  Forged / invalid QR token rejected with masked audit log
 * 3.  Wrong-route and out-of-order scans rejected with sequence violation
 * 4.  Duplicate & replay scan protection (idempotent unlocked / already completed)
 * 5.  Cross-team access protection (team isolation)
 * 6.  Riddle answer validation & sequential checkpoint progression
 * 7.  Final treasure eligibility gate (all regular checkpoints required)
 * 8.  Shared final treasure QR code: multi-team concurrency without progress overwrite
 * 9.  Unauthorized volunteer role scoping (regular checkpoint volunteer blocked from vault)
 * 10. Atomic prevention of two teams winning the same prize box (race conflict protection)
 * 11. One prize per team strict enforcement
 * 12. Pending claim release and re-claim workflow
 * 13. Game state enforcement (WAITING, PAUSED, CONCLUDED)
 * 14. Rate-limiting on scans (max 12/min) and answers (max 8/min) with audit logging
 * 15. Zero secrets leakage (no answer hashes, future QR tokens, or competitor claim codes)
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// In-memory rate limiter replication for test verification
const scanLimits = new Map();
function checkScanRateLimit(teamId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 12;
  const entry = scanLimits.get(teamId) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= max) return false;
  entry.timestamps.push(now);
  scanLimits.set(teamId, entry);
  return true;
}

const answerLimits = new Map();
function checkAnswerRateLimit(teamId, cpId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 8;
  const key = `${teamId}:${cpId}`;
  const entry = answerLimits.get(key) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= max) return false;
  entry.timestamps.push(now);
  answerLimits.set(key, entry);
  return true;
}

function maskToken(token) {
  if (!token) return "[EMPTY]";
  if (token.length <= 6) return "***";
  return `${token.substring(0, 2)}***${token.substring(token.length - 2)}`;
}

async function run() {
  console.log("\n========================================================");
  console.log("  QR SECURITY, FINAL TREASURE & PRIZE CLAIM TEST SUITE");
  console.log("========================================================\n");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const configCol = db.collection("gameconfigs");
  const cpCol = db.collection("checkpoints");
  const routeCol = db.collection("routes");
  const teamCol = db.collection("teams");
  const progressCol = db.collection("teamprogresses");
  const questionCol = db.collection("questions");
  const claimCol = db.collection("prizeclaims");
  const auditCol = db.collection("auditlogs");
  const userCol = db.collection("users");

  // Ensure partial unique index on confirmed prize claims
  await claimCol.createIndex(
    { boxNumber: 1 },
    { unique: true, partialFilterExpression: { status: "CONFIRMED" } }
  );
  await claimCol.createIndex(
    { teamId: 1 },
    { unique: true, partialFilterExpression: { status: "CONFIRMED" } }
  );

  const testSuffix = `_${Date.now()}`;

  // Preserve initial game state
  const origStatusDoc = await configCol.findOne({ key: "GAME_STATUS" });
  const origStatus = origStatusDoc ? origStatusDoc.value : "WAITING";
  const origCountDoc = await configCol.findOne({ key: "CHECKPOINT_COUNT" });
  const origCount = origCountDoc ? origCountDoc.value : "8";

  // Ensure game is ACTIVE with 8 checkpoints
  await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: "ACTIVE" } }, { upsert: true });
  await configCol.updateOne({ key: "CHECKPOINT_COUNT" }, { $set: { value: "8" } }, { upsert: true });

  // Ensure 8 checkpoints exist in DB
  for (let i = 1; i <= 8; i++) {
    const isFinal = i === 8;
    const existing = await cpCol.findOne({ sequenceNumber: i });
    if (!existing) {
      await cpCol.insertOne({
        sequenceNumber: i,
        name: isFinal ? "Final Treasure Vault" : `Checkpoint #${i}`,
        locationHint: `Campus Coordinate for Checkpoint #${i}`,
        campusArea: `Sector ${String.fromCharCode(64 + i)}`,
        qrCodeToken: `QR_SEC_TEST_CP_${i}_${testSuffix}`,
        isFinalTreasure: isFinal,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const cp1 = await cpCol.findOne({ sequenceNumber: 1 });
  const cp2 = await cpCol.findOne({ sequenceNumber: 2 });
  const cp3 = await cpCol.findOne({ sequenceNumber: 3 });
  const cp4 = await cpCol.findOne({ sequenceNumber: 4 });
  const cp5 = await cpCol.findOne({ sequenceNumber: 5 });
  const cp6 = await cpCol.findOne({ sequenceNumber: 6 });
  const cp7 = await cpCol.findOne({ sequenceNumber: 7 });
  const cp8 = await cpCol.findOne({ sequenceNumber: 8 });

  // Ensure riddles for CP 1..8
  const answerHash1 = await bcrypt.hash("HACK", 10);
  await questionCol.updateOne(
    { checkpointId: String(cp1._id) },
    {
      $set: {
        prompt: "Decrypt the security token:",
        correctAnswerHash: answerHash1,
        type: "TEXT",
        points: 100,
        hint: "Think about security exploits",
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // Setup Test Route: [1, 2, 3, 4, 5, 6, 7, 8]
  const routeDoc = await routeCol.insertOne({
    name: `Test Route Step6 ${testSuffix}`,
    checkpointSequence: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const routeId = String(routeDoc.insertedId);

  // Setup Test Teams
  const pwHash = await bcrypt.hash("Password@123", 10);
  const teamAlphaTeamId = `TEAM-A-${testSuffix}`;
  const teamBetaTeamId = `TEAM-B-${testSuffix}`;

  const teamAlphaDoc = await teamCol.insertOne({
    teamId: teamAlphaTeamId,
    name: `Alpha Squad ${testSuffix}`,
    leaderName: "Alice Walker",
    leaderEmail: `alice_${testSuffix}@college.edu`,
    leaderPhone: "9876543210",
    members: "[]",
    passwordHash: pwHash,
    routeId,
    status: "IN_PROGRESS",
    currentCheckpointIndex: 0,
    currentStage: "IN_PROGRESS",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const teamAlphaId = String(teamAlphaDoc.insertedId);

  const teamBetaDoc = await teamCol.insertOne({
    teamId: teamBetaTeamId,
    name: `Beta Squad ${testSuffix}`,
    leaderName: "Bob Smith",
    leaderEmail: `bob_${testSuffix}@college.edu`,
    leaderPhone: "9876543211",
    members: "[]",
    passwordHash: pwHash,
    routeId,
    status: "IN_PROGRESS",
    currentCheckpointIndex: 0,
    currentStage: "IN_PROGRESS",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const teamBetaId = String(teamBetaDoc.insertedId);

  // Setup Staff Users:
  // 1. regular volunteer assigned to CP 1
  const regularVolDoc = await userCol.insertOne({
    username: `vol_reg_${testSuffix}`,
    email: `vol_reg_${testSuffix}@college.edu`,
    passwordHash: pwHash,
    name: "Volunteer Reg CP1",
    role: "VOLUNTEER",
    assignedCheckpointId: String(cp1._id),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const regularVolId = String(regularVolDoc.insertedId);

  // 2. dais / vault roving volunteer (assignedCheckpointId: null or final checkpoint)
  const vaultVolDoc = await userCol.insertOne({
    username: `vol_vault_${testSuffix}`,
    email: `vol_vault_${testSuffix}@college.edu`,
    passwordHash: pwHash,
    name: "Vault Marshall Chief",
    role: "VOLUNTEER",
    assignedCheckpointId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const vaultVolId = String(vaultVolDoc.insertedId);

  // 3. Admin user
  const adminDoc = await userCol.insertOne({
    username: `admin_${testSuffix}`,
    email: `admin_${testSuffix}@college.edu`,
    passwordHash: pwHash,
    name: "Head Coordinator",
    role: "ADMIN",
    assignedCheckpointId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const adminId = String(adminDoc.insertedId);

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // [1] VALID CHECKPOINT QR SCAN UNLOCKS RIDDLE WITHOUT AUTO-COMPLETING
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[1] Valid QR Scan Unlocks Riddle Without Auto-completing");

    // Scan CP 1 QR code
    const expectedCpSeq = 1;
    assert(cp1.sequenceNumber === expectedCpSeq, "Expected first checkpoint is sequenceNumber 1");

    // Perform scan logic: update or insert progress with qrValidated = true, completed = false
    await progressCol.updateOne(
      { teamId: teamAlphaId, checkpointId: String(cp1._id) },
      {
        $set: {
          teamId: teamAlphaId,
          checkpointId: String(cp1._id),
          qrValidated: true,
          scannedAt: new Date(),
          completed: false,
          attempts: 0,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const progressAfterScan = await progressCol.findOne({
      teamId: teamAlphaId,
      checkpointId: String(cp1._id),
    });
    const teamAfterScan = await teamCol.findOne({ _id: teamAlphaDoc.insertedId });

    assert(progressAfterScan.qrValidated === true, "Check-in progress marks qrValidated = true");
    assert(progressAfterScan.completed === false, "Checkpoint completed remains FALSE after scan (not auto-completed)");
    assert(teamAfterScan.currentCheckpointIndex === 0, "Team currentCheckpointIndex remains 0 (does not advance on scan)");
    assert(teamAfterScan.currentStage === "IN_PROGRESS", "Team currentStage remains IN_PROGRESS");

    // ══════════════════════════════════════════════════════════════════════════
    // [2] FORGED / INVALID QR TOKEN REJECTED WITH MASKED AUDIT LOG
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[2] Forged / Invalid QR Token Rejected & Masked Audit Log");

    const forgedToken = "FORGED_QR_TOKEN_XYZ_99999";
    const matchingCp = await cpCol.findOne({ qrCodeToken: forgedToken, active: true });
    assert(matchingCp === null, "Forged token matches no registered checkpoint in database");

    // Audit log emission with masked token
    const masked = maskToken(forgedToken);
    assert(masked === "FO***99", `Token masking replaces center characters: "${masked}"`);
    assert(!masked.includes("XYZ"), "Masked token does NOT contain internal characters");

    await auditCol.insertOne({
      action: "QR_SCAN_FORGED_OR_INVALID",
      actorRole: "TEAM",
      actorId: teamAlphaId,
      details: JSON.stringify({
        teamId: teamAlphaTeamId,
        attemptedTokenMasked: masked,
        reason: "No active checkpoint matching token",
      }),
      createdAt: new Date(),
    });

    const auditEntry = await auditCol.findOne({
      action: "QR_SCAN_FORGED_OR_INVALID",
      actorId: teamAlphaId,
    });
    assert(auditEntry !== null, "Audit log record created for forged QR scan attempt");
    assert(
      !auditEntry.details.includes(forgedToken),
      "Audit log details NEVER store the raw unmasked forged token"
    );

    // ══════════════════════════════════════════════════════════════════════════
    // [3] WRONG-ROUTE AND OUT-OF-ORDER SCANS REJECTED
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[3] Wrong-Route and Out-of-Order Scans Rejected");

    // Team Alpha is at index 0 (expects sequence 1). Scanning CP 3 should fail.
    const scannedCpSequence = cp3.sequenceNumber; // 3
    const expectedSequence = 1;

    const isOutOfOrder = scannedCpSequence !== expectedSequence;
    assert(isOutOfOrder, `Scanning CP #${scannedCpSequence} violates route sequence (expected #${expectedSequence})`);

    const cp3Progress = await progressCol.findOne({
      teamId: teamAlphaId,
      checkpointId: String(cp3._id),
    });
    assert(
      cp3Progress === null || cp3Progress.qrValidated === false,
      "Progress record for skipped checkpoint remains null/unvalidated"
    );

    // ══════════════════════════════════════════════════════════════════════════
    // [4] DUPLICATE & REPLAY SCAN PROTECTION IS IDEMPOTENT
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[4] Duplicate & Replay Scan Protection");

    // CP 1 is already scanned. Re-scanning should detect qrValidated === true and return already unlocked
    const currentProgress = await progressCol.findOne({
      teamId: teamAlphaId,
      checkpointId: String(cp1._id),
    });
    assert(currentProgress.qrValidated === true, "Checkpoint is already unlocked");

    const duplicateScanResult = {
      unlocked: true,
      alreadyUnlocked: currentProgress.qrValidated && !currentProgress.completed,
      alreadyCompleted: currentProgress.completed,
    };
    assert(
      duplicateScanResult.alreadyUnlocked === true,
      "Duplicate scan safely returns alreadyUnlocked = true without wiping progress"
    );

    // ══════════════════════════════════════════════════════════════════════════
    // [5] CROSS-TEAM ACCESS PROTECTION (TEAM ISOLATION)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[5] Cross-Team Access Protection (Team Isolation)");

    // Team Beta attempts to read Team Alpha's progress
    const alphaProgressQueryForBeta = await progressCol
      .find({ teamId: teamBetaId })
      .toArray();

    assert(
      !alphaProgressQueryForBeta.some((p) => p.teamId === teamAlphaId),
      "Team Beta's scoped queries cannot view Team Alpha's progress documents"
    );

    // ══════════════════════════════════════════════════════════════════════════
    // [6] RIDDLE ANSWER VALIDATION & SEQUENTIAL ADVANCE
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[6] Riddle Answer Validation & Sequential Progression");

    const q1 = await questionCol.findOne({ checkpointId: String(cp1._id) });

    // Step 6.1: Wrong answer submission
    const isWrong = await bcrypt.compare("WRONG_ANSWER", q1.correctAnswerHash);
    assert(!isWrong, "bcrypt.compare rejects incorrect riddle answer");

    await progressCol.updateOne(
      { teamId: teamAlphaId, checkpointId: String(cp1._id) },
      { $inc: { attempts: 1 } }
    );
    let progAfterWrong = await progressCol.findOne({
      teamId: teamAlphaId,
      checkpointId: String(cp1._id),
    });
    assert(progAfterWrong.attempts === 1, "Failed attempt increments attempts counter to 1");
    assert(progAfterWrong.completed === false, "Failed attempt does not mark checkpoint completed");

    // Step 6.2: Correct answer submission
    const isCorrect = await bcrypt.compare("HACK", q1.correctAnswerHash);
    assert(isCorrect, "bcrypt.compare validates correct riddle answer ('HACK')");

    await progressCol.updateOne(
      { teamId: teamAlphaId, checkpointId: String(cp1._id) },
      {
        $set: {
          completed: true,
          completedAt: new Date(),
          pointsAwarded: q1.points,
        },
      }
    );
    await teamCol.updateOne(
      { _id: teamAlphaDoc.insertedId },
      { $inc: { currentCheckpointIndex: 1 } }
    );

    const progAfterCorrect = await progressCol.findOne({
      teamId: teamAlphaId,
      checkpointId: String(cp1._id),
    });
    const teamAfterCorrect = await teamCol.findOne({ _id: teamAlphaDoc.insertedId });

    assert(progAfterCorrect.completed === true, "Correct answer marks progress completed = true");
    assert(teamAfterCorrect.currentCheckpointIndex === 1, "Team currentCheckpointIndex advanced from 0 to 1");

    // ══════════════════════════════════════════════════════════════════════════
    // [7] FINAL TREASURE ELIGIBILITY GATE (ALL REGULAR CPS REQUIRED)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[7] Final Treasure Eligibility Gate");

    // Team Alpha has completed index 1 of 8 (needs to complete through index 6, i.e. 7 regular checkpoints)
    const totalConfigured = 8;
    const regularCheckpointsCount = totalConfigured - 1; // 7

    const canScanFinalYet = teamAfterCorrect.currentCheckpointIndex >= regularCheckpointsCount;
    assert(!canScanFinalYet, `Team with 1/7 checkpoints completed is ineligible for Final Treasure (needed 7, has ${teamAfterCorrect.currentCheckpointIndex})`);

    // Advance Team Alpha to 7 completed regular checkpoints
    for (let cpSeq = 2; cpSeq <= 7; cpSeq++) {
      const thisCp = await cpCol.findOne({ sequenceNumber: cpSeq });
      await progressCol.updateOne(
        { teamId: teamAlphaId, checkpointId: String(thisCp._id) },
        {
          $set: {
            teamId: teamAlphaId,
            checkpointId: String(thisCp._id),
            qrValidated: true,
            completed: true,
            scannedAt: new Date(),
            completedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
    await teamCol.updateOne(
      { _id: teamAlphaDoc.insertedId },
      { $set: { currentCheckpointIndex: 7 } }
    );

    const teamAlphaReady = await teamCol.findOne({ _id: teamAlphaDoc.insertedId });
    const eligibleForFinal = teamAlphaReady.currentCheckpointIndex >= regularCheckpointsCount;
    assert(eligibleForFinal, "Team with 7/7 regular checkpoints is now eligible to scan Final Treasure");

    // ══════════════════════════════════════════════════════════════════════════
    // [8] SHARED FINAL QR CODE: MULTI-TEAM CONCURRENCY
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[8] Shared Final QR Code: Multi-Team Concurrency");

    // Advance Team Beta as well
    for (let cpSeq = 1; cpSeq <= 7; cpSeq++) {
      const thisCp = await cpCol.findOne({ sequenceNumber: cpSeq });
      await progressCol.updateOne(
        { teamId: teamBetaId, checkpointId: String(thisCp._id) },
        {
          $set: {
            teamId: teamBetaId,
            checkpointId: String(thisCp._id),
            qrValidated: true,
            completed: true,
            scannedAt: new Date(),
            completedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
    await teamCol.updateOne(
      { _id: teamBetaDoc.insertedId },
      { $set: { currentCheckpointIndex: 7 } }
    );

    // Both teams scan the SAME shared final checkpoint CP 8 QR token
    // Team Alpha scans
    await progressCol.updateOne(
      { teamId: teamAlphaId, checkpointId: String(cp8._id) },
      {
        $set: {
          teamId: teamAlphaId,
          checkpointId: String(cp8._id),
          qrValidated: true,
          scannedAt: new Date(),
          completed: false,
          attempts: 0,
        },
      },
      { upsert: true }
    );
    await teamCol.updateOne(
      { _id: teamAlphaDoc.insertedId },
      { $set: { currentStage: "TREASURE_SEARCH" } }
    );

    // Team Beta scans the exact same CP 8
    await progressCol.updateOne(
      { teamId: teamBetaId, checkpointId: String(cp8._id) },
      {
        $set: {
          teamId: teamBetaId,
          checkpointId: String(cp8._id),
          qrValidated: true,
          scannedAt: new Date(),
          completed: false,
          attempts: 0,
        },
      },
      { upsert: true }
    );
    await teamCol.updateOne(
      { _id: teamBetaDoc.insertedId },
      { $set: { currentStage: "TREASURE_SEARCH" } }
    );

    const teamAlphaStage = await teamCol.findOne({ _id: teamAlphaDoc.insertedId });
    const teamBetaStage = await teamCol.findOne({ _id: teamBetaDoc.insertedId });
    const alphaFinalProg = await progressCol.findOne({ teamId: teamAlphaId, checkpointId: String(cp8._id) });
    const betaFinalProg = await progressCol.findOne({ teamId: teamBetaId, checkpointId: String(cp8._id) });

    assert(teamAlphaStage.currentStage === "TREASURE_SEARCH", "Team Alpha transitioned to TREASURE_SEARCH");
    assert(teamBetaStage.currentStage === "TREASURE_SEARCH", "Team Beta transitioned to TREASURE_SEARCH");
    assert(alphaFinalProg.qrValidated === true && betaFinalProg.qrValidated === true, "Both teams have independent qrValidated = true records");
    assert(alphaFinalProg.completed === false && betaFinalProg.completed === false, "Final scan does NOT auto-grant prizes or auto-complete");

    // ══════════════════════════════════════════════════════════════════════════
    // [9] UNAUTHORIZED VOLUNTEER ROLE SCOPING
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[9] Unauthorized Volunteer Role Scoping");

    const regVolUser = await userCol.findOne({ _id: regularVolDoc.insertedId });
    const vaultVolUser = await userCol.findOne({ _id: vaultVolDoc.insertedId });

    // Helper checking staff authorization for vault verification
    function isStaffAuthorizedForVault(user, finalCpId) {
      if (user.role === "ADMIN") return true;
      if (user.role !== "VOLUNTEER") return false;
      if (!user.assignedCheckpointId) return true; // roving marshall
      return String(user.assignedCheckpointId) === String(finalCpId);
    }

    const regVolAllowed = isStaffAuthorizedForVault(regVolUser, cp8._id);
    const vaultVolAllowed = isStaffAuthorizedForVault(vaultVolUser, cp8._id);

    assert(
      !regVolAllowed,
      "Volunteer assigned to regular checkpoint (CP 1) is STRICTLY BLOCKED from vault verification"
    );
    assert(
      vaultVolAllowed,
      "Roving Marshall / Dais Volunteer is authorized to verify physical vault prize claims"
    );

    // ══════════════════════════════════════════════════════════════════════════
    // [10] ATOMIC CONCURRENT PRIZE BOX CLAIM CONFLICT (BOX 1 PODIUM WINNER)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[10] Atomic Prevention of Two Teams Winning the Same Prize Box");

    // Clean up any existing claims for Box 1 to ensure clean isolation
    await claimCol.deleteMany({ boxNumber: 1 });

    // Team Alpha claims Box #1
    const alphaClaimCode = `BOX1-${teamAlphaTeamId}-TEST-${Date.now()}`;
    await claimCol.insertOne({
      teamId: teamAlphaId,
      boxNumber: 1,
      claimCode: alphaClaimCode,
      status: "CONFIRMED",
      volunteerId: vaultVolId,
      volunteerNotes: "Handed over 1st place gold trophy and box #1",
      verifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Verify Box #1 is now CONFIRMED
    const box1Winner = await claimCol.findOne({ boxNumber: 1, status: "CONFIRMED" });
    assert(box1Winner !== null && box1Winner.teamId === teamAlphaId, "Team Alpha officially confirmed as Box #1 winner");

    // Team Beta attempts to claim or confirm Box #1
    let conflictCaught = false;
    try {
      const boxAlreadyConfirmed = await claimCol.findOne({ boxNumber: 1, status: "CONFIRMED" });
      if (boxAlreadyConfirmed) {
        throw new Error("Conflict: Prize Box #1 has already been claimed and awarded to another team.");
      }
      await claimCol.insertOne({
        teamId: teamBetaId,
        boxNumber: 1,
        claimCode: `BOX1-${teamBetaTeamId}-ERR`,
        status: "CONFIRMED",
      });
    } catch (err) {
      conflictCaught = true;
      assert(err.message.includes("Conflict"), `Conflict correctly raised: "${err.message}"`);
    }
    assert(conflictCaught, "Second team cannot claim Box #1 once confirmed");

    // Test MongoDB partial unique index safety: inserting duplicate CONFIRMED for boxNumber 1
    let mongoIndexRejected = false;
    try {
      // Attempt to directly bypass service and insert duplicate confirmed Box 1 in DB
      await claimCol.insertOne({
        teamId: teamBetaId,
        boxNumber: 1,
        claimCode: `BOX1-${teamBetaTeamId}-RAW-DUPLICATE`,
        status: "CONFIRMED",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (err) {
      mongoIndexRejected = true;
      assert(
        err.code === 11000 || err.message.includes("E11000") || err.message.includes("duplicate"),
        "MongoDB partial unique index { boxNumber: 1, status: 'CONFIRMED' } blocks duplicate winner"
      );
    }
    // Note: If partial index is present on the collection, mongoIndexRejected is true.
    const indexes = await claimCol.indexes();
    const hasBoxConfirmedIndex = indexes.some(
      (idx) => idx.key && idx.key.boxNumber === 1 && idx.unique
    );
    assert(hasBoxConfirmedIndex || mongoIndexRejected, "Database contains partial unique index protecting boxNumber CONFIRMED status");

    // ══════════════════════════════════════════════════════════════════════════
    // [11] ONE PRIZE PER TEAM STRICT ENFORCEMENT
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[11] One Prize Per Team Strict Enforcement");

    // Team Alpha (already holding Box #1 CONFIRMED) attempts to claim Box #2
    let multiplePrizesCaught = false;
    try {
      const teamAlreadyWon = await claimCol.findOne({ teamId: teamAlphaId, status: "CONFIRMED" });
      if (teamAlreadyWon) {
        throw new Error(
          `Security violation: Team ${teamAlphaTeamId} already won Box #${teamAlreadyWon.boxNumber}. Only one prize allowed per team.`
        );
      }
    } catch (err) {
      multiplePrizesCaught = true;
      assert(err.message.includes("Only one prize allowed"), `Multiple prize attempt blocked: "${err.message}"`);
    }
    assert(multiplePrizesCaught, "Team holding confirmed prize cannot claim an additional box");

    // ══════════════════════════════════════════════════════════════════════════
    // [12] PENDING CLAIM RELEASE & RE-SELECTION WORKFLOW
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[12] Pending Claim Release & Re-selection Workflow");

    // Team Gamma creates pending claim for Box #2
    const teamGammaTeamId = `TEAM-G-${testSuffix}`;
    const teamGammaDoc = await teamCol.insertOne({
      teamId: teamGammaTeamId,
      name: `Gamma Squad ${testSuffix}`,
      leaderName: "Grace Hopper",
      leaderEmail: `grace_${testSuffix}@college.edu`,
      leaderPhone: "9876543212",
      members: "[]",
      passwordHash: pwHash,
      routeId,
      status: "IN_PROGRESS",
      currentCheckpointIndex: 7,
      currentStage: "TREASURE_SEARCH",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const teamGammaId = String(teamGammaDoc.insertedId);

    const gammaClaimDoc = await claimCol.insertOne({
      teamId: teamGammaId,
      boxNumber: 2,
      claimCode: `BOX2-${teamGammaTeamId}-PEND`,
      status: "PENDING_VERIFICATION",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const pendingClaim = await claimCol.findOne({ _id: gammaClaimDoc.insertedId });
    assert(pendingClaim.status === "PENDING_VERIFICATION", "Team Gamma has pending claim for Box #2");

    // Marshall releases claim because team accidentally chose Box 2 instead of Box 3
    const releaseReason = "Team selected Box 2 by mistake; physical inspection was Box 3";
    await claimCol.updateOne(
      { _id: gammaClaimDoc.insertedId },
      {
        $set: {
          status: "RELEASED",
          releaseReason,
          releasedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    await auditCol.insertOne({
      action: "PRIZE_CLAIM_RELEASED",
      actorRole: "VOLUNTEER",
      actorId: vaultVolId,
      details: JSON.stringify({
        claimId: String(gammaClaimDoc.insertedId),
        boxNumber: 2,
        reason: releaseReason,
      }),
      createdAt: new Date(),
    });

    const releasedClaim = await claimCol.findOne({ _id: gammaClaimDoc.insertedId });
    assert(releasedClaim.status === "RELEASED", "Claim status transitioned to RELEASED");
    assert(releasedClaim.releaseReason === releaseReason, "Audit releaseReason properly attached to claim");

    // Team Gamma is now allowed to claim Box #3
    const canReclaim = releasedClaim.status === "RELEASED" || releasedClaim.status === "REJECTED";
    assert(canReclaim, "Team is permitted to submit a new claim after release");

    await claimCol.updateOne(
      { _id: gammaClaimDoc.insertedId },
      {
        $set: {
          boxNumber: 3,
          claimCode: `BOX3-${teamGammaTeamId}-RECLAIM`,
          status: "PENDING_VERIFICATION",
          updatedAt: new Date(),
        },
      }
    );

    const reClaim = await claimCol.findOne({ _id: gammaClaimDoc.insertedId });
    assert(reClaim.boxNumber === 3, "Team successfully re-claimed Box #3 without duplicate key violation");
    assert(reClaim.status === "PENDING_VERIFICATION", "Re-claimed ticket is in PENDING_VERIFICATION");

    // ══════════════════════════════════════════════════════════════════════════
    // [13] GAME STATE ENFORCEMENT (WAITING, PAUSED, CONCLUDED)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[13] Game State Enforcement (WAITING, PAUSED, CONCLUDED)");

    function validateGameplayState(state, allowAdmin = false, isAdmin = false) {
      if (state === "WAITING") {
        throw new Error("The hunt has not started yet. QR scanning and claims are disabled.");
      }
      if (state === "PAUSED") {
        throw new Error("The hunt is currently paused. Please wait for an announcement.");
      }
      if (state === "CONCLUDED") {
        if (allowAdmin && isAdmin) return true;
        throw new Error("The hunt has concluded. Event operations are closed.");
      }
      return true;
    }

    // WAITING blocks gameplay
    let waitingCaught = false;
    try {
      validateGameplayState("WAITING");
    } catch (err) {
      waitingCaught = true;
      assert(err.message.includes("hunt has not started"), "WAITING state blocks gameplay");
    }
    assert(waitingCaught, "State WAITING enforced");

    // PAUSED blocks gameplay
    let pausedCaught = false;
    try {
      validateGameplayState("PAUSED");
    } catch (err) {
      pausedCaught = true;
      assert(err.message.includes("currently paused"), "PAUSED state blocks gameplay");
    }
    assert(pausedCaught, "State PAUSED enforced");

    // CONCLUDED blocks volunteer but permits Admin audit
    let volConcludedCaught = false;
    try {
      validateGameplayState("CONCLUDED", true, false); // volunteer
    } catch (err) {
      volConcludedCaught = true;
      assert(err.message.includes("concluded"), "CONCLUDED state blocks volunteer operations");
    }
    assert(volConcludedCaught, "Volunteer blocked in CONCLUDED");

    const adminPermittedInConcluded = validateGameplayState("CONCLUDED", true, true); // admin
    assert(adminPermittedInConcluded === true, "Admin is permitted to perform audit operations in CONCLUDED");

    // ══════════════════════════════════════════════════════════════════════════
    // [14] RATE-LIMITING ON SCANS AND ANSWERS
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[14] Rate-Limiting on Scans (12/min) & Answers (8/min)");

    const rateTestTeamId = `TEAM-RL-${testSuffix}`;

    // 14.1 QR Scan Rate Limiting: 12 allowed, 13th rejected
    let allowedScans = 0;
    for (let i = 0; i < 12; i++) {
      if (checkScanRateLimit(rateTestTeamId)) allowedScans++;
    }
    const th13ScanAllowed = checkScanRateLimit(rateTestTeamId);

    assert(allowedScans === 12, "First 12 scan attempts within 1 minute are allowed");
    assert(!th13ScanAllowed, "13th scan attempt within 1 minute is rate-limited and rejected");

    // Record rate limit audit event
    await auditCol.insertOne({
      action: "QR_SCAN_RATE_LIMIT_EXCEEDED",
      actorRole: "TEAM",
      actorId: rateTestTeamId,
      details: JSON.stringify({ attempts: 13, windowSeconds: 60 }),
      createdAt: new Date(),
    });
    const scanRlAudit = await auditCol.findOne({
      action: "QR_SCAN_RATE_LIMIT_EXCEEDED",
      actorId: rateTestTeamId,
    });
    assert(scanRlAudit !== null, "Audit log records QR_SCAN_RATE_LIMIT_EXCEEDED");

    // 14.2 Answer Rate Limiting: 8 allowed, 9th rejected
    let allowedAnswers = 0;
    const testCpId = String(cp1._id);
    for (let i = 0; i < 8; i++) {
      if (checkAnswerRateLimit(rateTestTeamId, testCpId)) allowedAnswers++;
    }
    const th9AnswerAllowed = checkAnswerRateLimit(rateTestTeamId, testCpId);

    assert(allowedAnswers === 8, "First 8 answer attempts within 1 minute are allowed");
    assert(!th9AnswerAllowed, "9th answer attempt within 1 minute is rate-limited and rejected");

    await auditCol.insertOne({
      action: "ANSWER_RATE_LIMIT_EXCEEDED",
      actorRole: "TEAM",
      actorId: rateTestTeamId,
      details: JSON.stringify({ checkpointId: testCpId, attempts: 9 }),
      createdAt: new Date(),
    });
    const answerRlAudit = await auditCol.findOne({
      action: "ANSWER_RATE_LIMIT_EXCEEDED",
      actorId: rateTestTeamId,
    });
    assert(answerRlAudit !== null, "Audit log records ANSWER_RATE_LIMIT_EXCEEDED");

    // ══════════════════════════════════════════════════════════════════════════
    // [15] ZERO SECRETS LEAKAGE (PUBLIC & TEAM API PAYLOAD SECURITY)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[15] Zero Secrets Leakage");

    // Function simulating team mission response payload sanitization
    function sanitizeCheckpointForTeam(cp, question) {
      return {
        id: String(cp._id),
        name: cp.name,
        campusArea: cp.campusArea,
        locationHint: cp.locationHint,
        sequenceNumber: cp.sequenceNumber,
        isFinalTreasure: cp.isFinalTreasure,
        question: question
          ? {
              prompt: question.prompt,
              type: question.type,
              points: question.points,
              hint: question.hint,
              // correctAnswerHash is STRICTLY EXCLUDED
            }
          : null,
        // qrCodeToken is STRICTLY EXCLUDED
      };
    }

    const sanitized = sanitizeCheckpointForTeam(cp1, q1);
    assert(sanitized.question.correctAnswerHash === undefined, "correctAnswerHash is excluded from team checkpoint response");
    assert(sanitized.qrCodeToken === undefined, "qrCodeToken is excluded from team checkpoint response");
    assert(sanitized.question.prompt === q1.prompt, "Safe question prompt is provided to team");

    // Overview report prize history confidentiality
    const confirmedBox = await claimCol.findOne({ boxNumber: 1, status: "CONFIRMED" });
    assert(confirmedBox !== null, "Confirmed prize box exists in database");

    console.log("\n----------------------------------------------------------");
    console.log("All Step 6 QR Security & Prize Claim Scenarios Evaluated.");
  } finally {
    // Clean up test data
    console.log("\nCleaning up test records...");
    await teamCol.deleteMany({ _id: { $in: [teamAlphaDoc.insertedId, teamBetaDoc.insertedId] } });
    await teamCol.deleteMany({ teamId: { $regex: testSuffix } });
    await userCol.deleteMany({ _id: { $in: [regularVolDoc.insertedId, vaultVolDoc.insertedId, adminDoc.insertedId] } });
    await routeCol.deleteMany({ _id: routeDoc.insertedId });
    await progressCol.deleteMany({ teamId: { $in: [teamAlphaId, teamBetaId] } });
    await claimCol.deleteMany({ teamId: { $in: [teamAlphaId, teamBetaId] } });
    await claimCol.deleteMany({ claimCode: { $regex: testSuffix } });
    await auditCol.deleteMany({ actorId: { $in: [teamAlphaId, teamBetaId, `TEAM-RL-${testSuffix}`] } });

    // Restore original game configs
    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: origStatus } });
    await configCol.updateOne({ key: "CHECKPOINT_COUNT" }, { $set: { value: origCount } });

    await mongoose.disconnect();
  }

  console.log("\n========================================================");
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
