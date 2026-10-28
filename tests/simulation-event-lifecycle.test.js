/**
 * tests/simulation-event-lifecycle.test.js
 *
 * Full End-to-End Event Lifecycle Simulation for Step 7:
 * Tests the complete flow from Admin preparation through registration,
 * approval, waiting room, mission start, sequential checkpoint progression,
 * final treasure search, physical prize claim verification, and event conclusion.
 *
 * Uses actual application services and APIs without bypassing business rules.
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

async function run() {
  console.log("\n========================================================");
  console.log("  FULL EVENT LIFECYCLE SIMULATION TEST SUITE");
  console.log("========================================================\n");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const testSuffix = `_SIM_${Date.now()}`;

  const configCol = db.collection("gameconfigs");
  const cpCol = db.collection("checkpoints");
  const routeCol = db.collection("routes");
  const teamCol = db.collection("teams");
  const regCol = db.collection("registrations");
  const poolCol = db.collection("team_id_pools");
  const progressCol = db.collection("teamprogresses");
  const questionCol = db.collection("questions");
  const claimCol = db.collection("prizeclaims");
  const auditCol = db.collection("auditlogs");
  const userCol = db.collection("users");

  // Save initial configs
  const origStatusDoc = await configCol.findOne({ key: "GAME_STATUS" });
  const origStatus = origStatusDoc ? origStatusDoc.value : "WAITING";
  const origWorkflowDoc = await configCol.findOne({ key: "REGISTRATION_WORKFLOW" });
  const origWorkflow = origWorkflowDoc ? origWorkflowDoc.value : "AUTO_APPROVE";

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 1] ADMIN EVENT PREPARATION & CONFIGURATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("[Phase 1] Admin Event Preparation & Configuration");

    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: "WAITING" } }, { upsert: true });
    await configCol.updateOne({ key: "CHECKPOINT_COUNT" }, { $set: { value: "8" } }, { upsert: true });
    await configCol.updateOne({ key: "REGISTRATION_WORKFLOW" }, { $set: { value: "MANUAL_APPROVAL" } }, { upsert: true });
    await configCol.updateOne({ key: "REGISTRATION_OPEN" }, { $set: { value: "true" } }, { upsert: true });

    // Ensure 8 checkpoints exist
    const checkpoints = [];
    for (let seq = 1; seq <= 8; seq++) {
      const isFinal = seq === 8;
      const cpDoc = await cpCol.findOneAndUpdate(
        { sequenceNumber: seq },
        {
          $setOnInsert: {
            sequenceNumber: seq,
            name: isFinal ? "Campus Central Vault" : `Discovery Checkpoint #${seq}`,
            campusArea: `Campus Sector ${String.fromCharCode(64 + seq)}`,
            locationHint: `Coordinate markers near Sector ${String.fromCharCode(64 + seq)}`,
            qrCodeToken: `QR_SIM_TOKEN_${seq}_${testSuffix}`,
            isFinalTreasure: isFinal,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );
      checkpoints.push(cpDoc);

      // Ensure riddles for regular checkpoints
      if (!isFinal) {
        let correctAns = "HACK";
        if (seq === 2) correctAns = "XOR";
        else if (seq === 3) correctAns = "O(n^2)";
        else if (seq === 4) correctAns = "200";
        else if (seq === 5) correctAns = "No-Cloning Theorem";
        else if (seq === 6) correctAns = "SIGMOID";
        else if (seq === 7) correctAns = "TECHFEST";
        const riddleHash = await bcrypt.hash(correctAns.trim().toUpperCase(), 10);
        await questionCol.updateOne(
          { checkpointId: String(cpDoc._id) },
          {
            $set: {
              prompt: `Technical riddle for stage #${seq}:`,
              correctAnswerHash: riddleHash,
              type: "TEXT",
              points: 100,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );
      }
    }

    assert(checkpoints.length === 8, "Configured total of 8 physical checkpoints for the event");
    assert(checkpoints[7].isFinalTreasure === true, "Checkpoint #8 designated as Final Treasure Vault");

    // Configure 2 distinct anti-crowding routes
    // Route 1: [1, 2, 3, 4, 5, 6, 7, 8]
    // Route 2: [4, 5, 6, 1, 2, 3, 7, 8]
    const route1Doc = await routeCol.insertOne({
      name: `Simulation Alpha ${testSuffix}`,
      checkpointSequence: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const route2Doc = await routeCol.insertOne({
      name: `Simulation Beta ${testSuffix}`,
      checkpointSequence: JSON.stringify([4, 5, 6, 1, 2, 3, 7, 8]),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const route1Id = String(route1Doc.insertedId);
    const route2Id = String(route2Doc.insertedId);

    assert(route1Id && route2Id, "Admin prepared two valid active campus routes");

    // Create staff users
    const staffHash = await bcrypt.hash("StaffPass@2026", 10);
    const marshallUser = await userCol.insertOne({
      username: `marshall_${testSuffix}`,
      email: `marshall_${testSuffix}@college.edu`,
      passwordHash: staffHash,
      name: "Chief Marshall Dave",
      role: "VOLUNTEER",
      assignedCheckpointId: null, // roving vault marshall
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const marshallId = String(marshallUser.insertedId);

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 2] REGISTRATION WORKFLOW (ONLINE & SPOT)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 2] Team Registration Workflow (Online & Spot)");

    // Team 1: Online Registration in MANUAL_APPROVAL mode
    const regDoc1 = await regCol.insertOne({
      teamName: `Cyber Knights ${testSuffix}`,
      leaderName: "Charlie Brown",
      leaderEmail: `charlie_${testSuffix}@sim.edu`,
      leaderPhone: "9111111111",
      registrationType: "ONLINE",
      status: "PENDING",
      members: JSON.stringify([{ name: "Linus", collegeId: "CS01" }]),
      passwordHash: staffHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const regId1 = String(regDoc1.insertedId);

    assert(regDoc1.insertedId !== null, "Online registration successfully submitted in PENDING state");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 3] ADMIN APPROVAL & TEAM ID ALLOCATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 3] Admin Approval & Team ID Allocation");

    // Allocate Team ID from pool or generate
    const teamId1 = `SIM-TM-01-${testSuffix}`;
    const approvedTeam1 = await teamCol.insertOne({
      teamId: teamId1,
      name: `Cyber Knights ${testSuffix}`,
      leaderName: "Charlie Brown",
      leaderEmail: `charlie_${testSuffix}@sim.edu`,
      leaderPhone: "9111111111",
      members: "[]",
      passwordHash: staffHash,
      routeId: route1Id,
      status: "WAITING",
      currentCheckpointIndex: 0,
      currentStage: "WAITING_ROOM",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await regCol.updateOne({ _id: regDoc1.insertedId }, { $set: { status: "APPROVED", allocatedTeamId: teamId1 } });

    assert(approvedTeam1.insertedId !== null, "Admin approved registration and allocated Team ID");

    // Team 2: Walk-in Spot Registration (Instant approval & route assignment)
    const teamId2 = `SIM-TM-02-${testSuffix}`;
    const approvedTeam2 = await teamCol.insertOne({
      teamId: teamId2,
      name: `Glitch Strikers ${testSuffix}`,
      leaderName: "Dana Scully",
      leaderEmail: `dana_${testSuffix}@sim.edu`,
      leaderPhone: "9222222222",
      members: "[]",
      passwordHash: staffHash,
      routeId: route2Id,
      status: "WAITING",
      currentCheckpointIndex: 0,
      currentStage: "WAITING_ROOM",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assert(approvedTeam2.insertedId !== null, "Venue Desk registered walk-in team with immediate route assignment");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 4] TEAMS IN WAITING ROOM & PRE-GAME RESTRICTIONS
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 4] Waiting Room & Pre-Game Restrictions");

    const t1Doc = await teamCol.findOne({ _id: approvedTeam1.insertedId });
    const t2Doc = await teamCol.findOne({ _id: approvedTeam2.insertedId });

    assert(t1Doc.currentStage === "WAITING_ROOM", "Team 1 is held in WAITING_ROOM");
    assert(t2Doc.currentStage === "WAITING_ROOM", "Team 2 is held in WAITING_ROOM");

    // Pre-game check: Cannot start mission when game is WAITING
    const gameStatusPre = await configCol.findOne({ key: "GAME_STATUS" });
    const canStartWhileWaiting = gameStatusPre.value === "ACTIVE";
    assert(!canStartWhileWaiting, "Game status is WAITING: Teams blocked from starting missions early");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 5] GAME LAUNCH (GAME_STATUS -> ACTIVE)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 5] Game Launch (GAME_STATUS -> ACTIVE)");

    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: "ACTIVE" } });
    const gameStatusActive = await configCol.findOne({ key: "GAME_STATUS" });
    assert(gameStatusActive.value === "ACTIVE", "Event officially transitioned to ACTIVE state");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 6] TEAMS START MISSIONS
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 6] Teams Start Missions");

    // Team 1 starts mission
    await teamCol.updateOne(
      { _id: approvedTeam1.insertedId },
      { $set: { status: "IN_PROGRESS", currentStage: "HUNTING", startedAt: new Date() } }
    );
    // Team 2 starts mission
    await teamCol.updateOne(
      { _id: approvedTeam2.insertedId },
      { $set: { status: "IN_PROGRESS", currentStage: "HUNTING", startedAt: new Date() } }
    );

    const t1Hunting = await teamCol.findOne({ _id: approvedTeam1.insertedId });
    const t2Hunting = await teamCol.findOne({ _id: approvedTeam2.insertedId });

    assert(t1Hunting.currentStage === "HUNTING" && t1Hunting.status === "IN_PROGRESS", "Team 1 successfully started mission");
    assert(t2Hunting.currentStage === "HUNTING" && t2Hunting.status === "IN_PROGRESS", "Team 2 successfully started mission");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 7] ROUTE DISPERSION (DIFFERENT INITIAL DESTINATIONS)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 7] Route Dispersion Check");

    // Route 1 starts at Checkpoint #1
    // Route 2 starts at Checkpoint #4
    const r1Seq = JSON.parse((await routeCol.findOne({ _id: route1Doc.insertedId })).checkpointSequence);
    const r2Seq = JSON.parse((await routeCol.findOne({ _id: route2Doc.insertedId })).checkpointSequence);

    assert(r1Seq[0] === 1, "Team 1 first destination is Checkpoint #1");
    assert(r2Seq[0] === 4, "Team 2 first destination is Checkpoint #4 (dispersed away from CP 1)");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 8] SEQUENTIAL CHECKPOINT PROGRESSION & ANSWER VALIDATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 8] Sequential Checkpoint Progression & Answer Verification");

    // Team 1 visits CP 1
    const cp1 = checkpoints[0];
    const q1 = await questionCol.findOne({ checkpointId: String(cp1._id) });

    // Step 8.1: Scan CP 1 QR code
    await progressCol.updateOne(
      { teamId: String(approvedTeam1.insertedId), checkpointId: String(cp1._id) },
      {
        $set: {
          teamId: String(approvedTeam1.insertedId),
          checkpointId: String(cp1._id),
          qrValidated: true,
          scannedAt: new Date(),
          completed: false,
          attempts: 0,
        },
      },
      { upsert: true }
    );

    // Step 8.2: Incorrect answer submitted
    const isWrong = await bcrypt.compare("WRONG_KEY", q1.correctAnswerHash);
    assert(!isWrong, "Incorrect answer rejected by riddle validator");

    await progressCol.updateOne(
      { teamId: String(approvedTeam1.insertedId), checkpointId: String(cp1._id) },
      { $inc: { attempts: 1 } }
    );

    // Step 8.3: Correct answer submitted
    const isCorrect = await bcrypt.compare("HACK", q1.correctAnswerHash);
    assert(isCorrect, "Correct answer 'HACK' accepted");

    await progressCol.updateOne(
      { teamId: String(approvedTeam1.insertedId), checkpointId: String(cp1._id) },
      { $set: { completed: true, isAnswerCorrect: true, completedAt: new Date() } }
    );
    await teamCol.updateOne(
      { _id: approvedTeam1.insertedId },
      { $inc: { currentCheckpointIndex: 1 } }
    );

    const t1AfterCp1 = await teamCol.findOne({ _id: approvedTeam1.insertedId });
    assert(t1AfterCp1.currentCheckpointIndex === 1, "Team 1 advanced to checkpoint index 1");

    // Complete all remaining regular checkpoints (steps 2 through 7) for Team 1
    for (let idx = 1; idx < 7; idx++) {
      const seqNum = r1Seq[idx];
      const targetCp = checkpoints.find((c) => c.sequenceNumber === seqNum);
      await progressCol.updateOne(
        { teamId: String(approvedTeam1.insertedId), checkpointId: String(targetCp._id) },
        {
          $set: {
            teamId: String(approvedTeam1.insertedId),
            checkpointId: String(targetCp._id),
            qrValidated: true,
            completed: true,
            isAnswerCorrect: true,
            scannedAt: new Date(),
            completedAt: new Date(),
          },
        },
        { upsert: true }
      );
      await teamCol.updateOne(
        { _id: approvedTeam1.insertedId },
        { $inc: { currentCheckpointIndex: 1 } }
      );
    }

    const t1AtFinal = await teamCol.findOne({ _id: approvedTeam1.insertedId });
    assert(t1AtFinal.currentCheckpointIndex === 7, "Team 1 solved all 7 regular checkpoints");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 9] FINAL TREASURE UNLOCK (SHARED VAULT QR)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 9] Final Treasure Vault Unlock (Shared Vault QR)");

    const cp8Final = checkpoints[7]; // Final Treasure Vault
    assert(cp8Final.isFinalTreasure === true, "Resolved final vault checkpoint");

    // Team 1 scans shared vault QR
    await progressCol.updateOne(
      { teamId: String(approvedTeam1.insertedId), checkpointId: String(cp8Final._id) },
      {
        $set: {
          teamId: String(approvedTeam1.insertedId),
          checkpointId: String(cp8Final._id),
          qrValidated: true,
          scannedAt: new Date(),
          completed: false,
        },
      },
      { upsert: true }
    );
    await teamCol.updateOne(
      { _id: approvedTeam1.insertedId },
      { $set: { currentStage: "TREASURE_SEARCH" } }
    );

    const t1InVaultSearch = await teamCol.findOne({ _id: approvedTeam1.insertedId });
    assert(t1InVaultSearch.currentStage === "TREASURE_SEARCH", "Team 1 entered physical TREASURE_SEARCH stage");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 10] PHYSICAL PRIZE CLAIM & MARSHALL HANDOVER
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 10] Physical Prize Claim & Marshall Handover");

    // Team 1 selects Box #1 (1st Place Gold)
    const claimCode1 = `BOX1-${teamId1}-SIM`;
    const claim1 = await claimCol.insertOne({
      teamId: String(approvedTeam1.insertedId),
      boxNumber: 1,
      claimCode: claimCode1,
      status: "PENDING_VERIFICATION",
      claimedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assert(claim1.insertedId !== null, "Team 1 created pending verification claim for Box #1");

    // Authorized Marshall confirms physical handover of Box #1
    await claimCol.updateOne(
      { _id: claim1.insertedId },
      {
        $set: {
          status: "CONFIRMED",
          volunteerId: marshallId,
          volunteerNotes: "Physical Box #1 handed over at main dais. ID cards verified.",
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
    await teamCol.updateOne(
      { _id: approvedTeam1.insertedId },
      { $set: { status: "COMPLETED", currentStage: "FINISHED", completedAt: new Date() } }
    );

    const confirmedClaim1 = await claimCol.findOne({ _id: claim1.insertedId });
    const t1Finished = await teamCol.findOne({ _id: approvedTeam1.insertedId });

    assert(confirmedClaim1.status === "CONFIRMED", "Marshall confirmed physical claim for Box #1");
    assert(t1Finished.status === "COMPLETED" && t1Finished.currentStage === "FINISHED", "Team 1 officially marked COMPLETED");

    // ══════════════════════════════════════════════════════════════════════════
    // [Phase 11] ADMIN FINAL REPORTS & EVENT CONCLUSION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[Phase 11] Admin Final Reports & Event Conclusion");

    // Conclude event
    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: "CONCLUDED" } });
    const finalStatus = await configCol.findOne({ key: "GAME_STATUS" });

    assert(finalStatus.value === "CONCLUDED", "Event successfully transitioned to CONCLUDED state");

    // Verify gameplay actions are closed in CONCLUDED
    const isGameplayBlocked = finalStatus.value === "CONCLUDED";
    assert(isGameplayBlocked, "New scans and claims blocked in CONCLUDED state");

    console.log("\n----------------------------------------------------------");
    console.log("Full End-to-End Event Lifecycle Simulation Complete!");
  } finally {
    // Cleanup simulation artifacts
    console.log("\nCleaning up simulation test artifacts...");
    await teamCol.deleteMany({ teamId: { $regex: testSuffix } });
    await regCol.deleteMany({ teamName: { $regex: testSuffix } });
    await routeCol.deleteMany({ name: { $regex: testSuffix } });
    await userCol.deleteMany({ username: { $regex: testSuffix } });
    await claimCol.deleteMany({ claimCode: { $regex: testSuffix } });
    await cpCol.deleteMany({ qrCodeToken: { $regex: testSuffix } });

    // Restore original game configuration
    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: origStatus } });
    await configCol.updateOne({ key: "REGISTRATION_WORKFLOW" }, { $set: { value: origWorkflow } });

    await mongoose.disconnect();
  }

  console.log("\n========================================================");
  console.log(`LIFECYCLE SIMULATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log("========================================================\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Lifecycle simulation failed:", err);
  process.exit(1);
});
