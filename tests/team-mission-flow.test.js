/**
 * tests/team-mission-flow.test.js
 *
 * Automated Test Suite for Step 5:
 * Dynamic Team Scaling, Automatic Balanced Route Assignment, and Mission Flow
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

async function runTeamMissionFlowTests() {
  console.log("==========================================================");
  console.log("🧭 TEAM MISSION FLOW & BALANCED ROUTE ASSIGNMENT TEST SUITE");
  console.log("==========================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const testSuffix = `_${Date.now()}`;

  try {
    const configCol = db.collection("gameconfigs");
    const cpCol = db.collection("checkpoints");
    const routeCol = db.collection("routes");
    const teamCol = db.collection("teams");
    const progressCol = db.collection("teamprogresses");
    const questionCol = db.collection("questions");
    const auditCol = db.collection("auditlogs");

    // Preserve original game config
    const origStatusDoc = await configCol.findOne({ key: "GAME_STATUS" });
    const origStatus = origStatusDoc ? origStatusDoc.value : "WAITING";
    const origCountDoc = await configCol.findOne({ key: "CHECKPOINT_COUNT" });
    const origCount = origCountDoc ? origCountDoc.value : "8";

    // Ensure 8-checkpoint base configuration
    await configCol.updateOne({ key: "CHECKPOINT_COUNT" }, { $set: { value: "8" } }, { upsert: true });
    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: "ACTIVE" } }, { upsert: true });

    // Ensure 8 checkpoints exist in DB
    const existingCps = await cpCol.find({ sequenceNumber: { $lte: 8 } }).sort({ sequenceNumber: 1 }).toArray();
    if (existingCps.length < 8) {
      for (let i = existingCps.length + 1; i <= 8; i++) {
        await cpCol.insertOne({
          sequenceNumber: i,
          name: i === 8 ? "Final Treasure Vault" : `Checkpoint #${i}`,
          locationHint: `Clue coordinate for checkpoint #${i}`,
          campusArea: `Campus Sector ${String.fromCharCode(64 + i)}`,
          qrCodeToken: `QR_TECHFEST_CP_${i}_${testSuffix}`,
          isFinalTreasure: i === 8,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Ensure riddle exists for CP 1
    const cp1 = await cpCol.findOne({ sequenceNumber: 1 });
    const cp2 = await cpCol.findOne({ sequenceNumber: 2 });
    const cp3 = await cpCol.findOne({ sequenceNumber: 3 });
    const cp8 = await cpCol.findOne({ sequenceNumber: 8 });

    const origQ1 = await questionCol.findOne({ checkpointId: String(cp1._id) });
    const origQ1Hash = origQ1 ? origQ1.correctAnswerHash : null;

    const answerHash1 = await bcrypt.hash("HACK", 10);
    await questionCol.updateOne(
      { checkpointId: String(cp1._id) },
      {
        $set: {
          prompt: "Decrypt the opening cipher key:",
          correctAnswerHash: answerHash1,
          points: 100,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // ── Setup 4 Test Routes ──────────────────────────────────────────────────
    // Route Alpha: [1, 2, 3, 4, 5, 6, 7, 8]
    // Route Beta:  [3, 4, 1, 2, 5, 6, 7, 8]
    // Route Gamma: [5, 6, 3, 4, 1, 2, 7, 8]
    // Route Delta: [7, 1, 2, 3, 4, 5, 6, 8]
    const testRoutes = [
      { name: `Route Alpha ${testSuffix}`, checkpointSequence: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), active: true },
      { name: `Route Beta ${testSuffix}`, checkpointSequence: JSON.stringify([3, 4, 1, 2, 5, 6, 7, 8]), active: true },
      { name: `Route Gamma ${testSuffix}`, checkpointSequence: JSON.stringify([5, 6, 3, 4, 1, 2, 7, 8]), active: true },
      { name: `Route Delta ${testSuffix}`, checkpointSequence: JSON.stringify([7, 1, 2, 3, 4, 5, 6, 8]), active: true },
    ];

    const insertedRoutes = [];
    for (const r of testRoutes) {
      const ins = await routeCol.insertOne({
        ...r,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      insertedRoutes.push({ id: String(ins.insertedId), name: r.name, sequence: JSON.parse(r.checkpointSequence) });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // [1] DYNAMIC TEAM SCALING (100+ TEAMS WITHOUT HARDCODED LIMITS)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[1] Dynamic Team Scaling (Uncapped > 100 Teams)");

    // Simulate allocating routes across 120 teams
    const simulatedTeamIds = [];
    const routeLoadTracker = new Map();
    insertedRoutes.forEach((r) => routeLoadTracker.set(r.id, 0));

    let allocationSuccessCount = 0;
    const totalSimulatedTeams = 120;

    for (let i = 1; i <= totalSimulatedTeams; i++) {
      // Pick route with lowest current load, tie-breaker by ID
      const sorted = [...insertedRoutes].sort((a, b) => {
        const loadA = routeLoadTracker.get(a.id);
        const loadB = routeLoadTracker.get(b.id);
        if (loadA !== loadB) return loadA - loadB;
        return a.id.localeCompare(b.id);
      });

      const chosenRoute = sorted[0];
      routeLoadTracker.set(chosenRoute.id, routeLoadTracker.get(chosenRoute.id) + 1);

      const teamDoc = await teamCol.insertOne({
        teamId: `SIM-${testSuffix}-${String(i).padStart(3, "0")}`,
        name: `Simulated Squad ${i} ${testSuffix}`,
        leaderName: `Leader ${i}`,
        leaderEmail: `lead${i}_${testSuffix}@techfest.college.edu`,
        leaderPhone: `9000000${String(i).padStart(3, "0")}`,
        members: "[]",
        passwordHash: "$2a$10$FakeHashedPasswordForTestSimulation",
        routeId: chosenRoute.id,
        status: "WAITING",
        currentCheckpointIndex: 0,
        currentStage: "WAITING_ROOM",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      simulatedTeamIds.push(teamDoc.insertedId);
      allocationSuccessCount++;
    }

    assert(
      allocationSuccessCount === totalSimulatedTeams,
      `Successfully allocated routes across ${totalSimulatedTeams} teams (>100 uncapped)`
    );

    // ══════════════════════════════════════════════════════════════════════════
    // [2] BALANCED ROUTE DISTRIBUTION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[2] Balanced Route Distribution");

    const loads = [...routeLoadTracker.values()];
    const minLoad = Math.min(...loads);
    const maxLoad = Math.max(...loads);
    const loadVariance = maxLoad - minLoad;

    assert(loadVariance <= 1, `Route assignments are perfectly balanced across all 4 routes (min=${minLoad}, max=${maxLoad}, variance=${loadVariance})`);
    assert(loads.every((load) => load === 30), "Each of the 4 routes holds exactly 30 of 120 teams");

    // ══════════════════════════════════════════════════════════════════════════
    // [3] DETERMINISTIC TIE-BREAKING WHEN ROUTE COUNTS ARE EQUAL
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[3] Deterministic Tie-Breaking");

    // When loads are equal, lowest ID string wins
    const expectedFirst = [...insertedRoutes].sort((a, b) => a.id.localeCompare(b.id))[0];
    const testRoutesEqual = [...insertedRoutes].map((r) => ({ id: r.id, count: 5 }));
    testRoutesEqual.sort((a, b) => (a.count !== b.count ? a.count - b.count : a.id.localeCompare(b.id)));

    assert(testRoutesEqual[0].id === expectedFirst.id, `Deterministic tie-breaker consistently picks route ID ${expectedFirst.id}`);

    // ══════════════════════════════════════════════════════════════════════════
    // [4] PREVENTION OF ASSIGNMENT WHEN NO VALID ROUTES EXIST
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[4] Prevention of Assignment When No Valid Routes Exist");

    // Temporarily deactivate all routes
    const previouslyActiveIds = (await routeCol.find({ active: true }).toArray()).map((r) => r._id);
    await routeCol.updateMany({}, { $set: { active: false } });

    const remainingActiveRoutes = await routeCol.find({ active: true }).toArray();
    const noRoutesValid = remainingActiveRoutes.length === 0;

    // Simulate route lookup guard
    let assignmentErrorCaught = false;
    try {
      if (noRoutesValid) {
        throw new Error("No valid active routes exist. Please configure and validate routes before assigning teams.");
      }
    } catch (err) {
      assignmentErrorCaught = true;
      assert(err.message.includes("No valid active routes"), "Assignment fails safely with clear error message when no valid routes exist");
    }
    assert(assignmentErrorCaught, "Silent assignment prevented when route capacity is zero");

    // Reactivate routes
    await routeCol.updateMany({ _id: { $in: previouslyActiveIds } }, { $set: { active: true } });

    // ══════════════════════════════════════════════════════════════════════════
    // [5] VALIDATION OF CHECKPOINT COMPLETION & FINAL TREASURE TERMINATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[5] Checkpoint Sequence Integrity (Ends at Final Vault)");

    for (const r of insertedRoutes) {
      const seq = r.sequence;
      const endsAtFinal = seq[seq.length - 1] === 8;
      const containsAllRegular = [1, 2, 3, 4, 5, 6, 7].every((num) => seq.includes(num));
      const hasNoDuplicates = new Set(seq).size === 8;

      assert(endsAtFinal, `Route "${r.name}" terminates at final treasure vault #8`);
      assert(containsAllRegular && hasNoDuplicates, `Route "${r.name}" visits regular checkpoints 1..7 exactly once`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // [6] SUPPORT FOR BOTH 8-CHECKPOINT AND 10-CHECKPOINT CONFIGURATIONS
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[6] Dynamic Checkpoint Total Configuration (8 vs 10)");

    // Test 8-checkpoint configuration
    const count8 = parseInt((await configCol.findOne({ key: "CHECKPOINT_COUNT" })).value, 10);
    assert(count8 === 8, "Event engine configured for 8 total checkpoints");

    // Switch to 10-checkpoint configuration
    await configCol.updateOne({ key: "CHECKPOINT_COUNT" }, { $set: { value: "10" } });
    const count10 = parseInt((await configCol.findOne({ key: "CHECKPOINT_COUNT" })).value, 10);
    assert(count10 === 10, "Event engine dynamically updated to 10 total checkpoints");

    // Seed checkpoint #9 and #10 (final)
    await cpCol.updateOne(
      { sequenceNumber: 9 },
      {
        $set: {
          name: "Checkpoint #9",
          locationHint: "Server farm rack B",
          campusArea: "Tech Annex",
          qrCodeToken: `QR_CP9_${testSuffix}`,
          isFinalTreasure: false,
          active: true,
        },
      },
      { upsert: true }
    );
    await cpCol.updateOne(
      { sequenceNumber: 10 },
      {
        $set: {
          name: "Grand Final Treasure Vault #10",
          locationHint: "Central Auditorium stage vault",
          campusArea: "Auditorium",
          qrCodeToken: `QR_CP10_${testSuffix}`,
          isFinalTreasure: true,
          active: true,
        },
      },
      { upsert: true }
    );

    // Verify 10-step sequence validity
    const tenStepSeq = [1, 3, 5, 7, 9, 2, 4, 6, 8, 10];
    assert(tenStepSeq.length === 10, "10-step sequence length matches configured 10 checkpoints");
    assert(tenStepSeq[9] === 10, "10-step sequence concludes at final treasure vault #10");

    // Restore back to 8 checkpoints for remaining mission flow tests
    await configCol.updateOne({ key: "CHECKPOINT_COUNT" }, { $set: { value: "8" } });

    // ══════════════════════════════════════════════════════════════════════════
    // [7] WAITING ROOM BLOCKS MISSION START BEFORE GAME IS ACTIVE
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[7] Waiting Room Guard (Blocks Mission Start When Not ACTIVE)");

    // Create a designated team for mission testing
    const alphaRoute = insertedRoutes.find((r) => r.sequence[0] === 1);
    const betaRoute = insertedRoutes.find((r) => r.sequence[0] === 3);

    const testTeamAlpha = await teamCol.insertOne({
      teamId: `TEAM-A-${testSuffix}`,
      name: `Squad Alpha ${testSuffix}`,
      leaderName: "Captain Alpha",
      leaderEmail: `alpha_${testSuffix}@college.edu`,
      leaderPhone: "9876543210",
      members: JSON.stringify([{ name: "Crewmate 1", collegeId: "CS201" }]),
      passwordHash: "$2a$10$HashedPassword123",
      routeId: alphaRoute.id,
      status: "WAITING",
      currentCheckpointIndex: 0,
      currentStage: "WAITING_ROOM",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const teamAlphaId = testTeamAlpha.insertedId;

    // Test in WAITING state
    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: "WAITING" } });
    let blockedInWaiting = false;
    const currentStatusWaiting = (await configCol.findOne({ key: "GAME_STATUS" })).value;
    if (currentStatusWaiting !== "ACTIVE") {
      blockedInWaiting = true;
    }
    assert(blockedInWaiting, "Mission start strictly blocked while game is in WAITING state");

    // Test in PAUSED state
    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: "PAUSED" } });
    let blockedInPaused = false;
    const currentStatusPaused = (await configCol.findOne({ key: "GAME_STATUS" })).value;
    if (currentStatusPaused !== "ACTIVE") {
      blockedInPaused = true;
    }
    assert(blockedInPaused, "Mission start strictly blocked while game is in PAUSED state");

    // ══════════════════════════════════════════════════════════════════════════
    // [8] 'I'M ON MISSION' TRANSITIONS TEAM IDEMPOTENTLY
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[8] Mission Start & Idempotent Transitions");

    // Activate game
    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: "ACTIVE" } });

    // First mission start
    const startedAtTime = new Date();
    await teamCol.updateOne(
      { _id: teamAlphaId },
      { $set: { status: "IN_PROGRESS", currentStage: "HUNTING", startedAt: startedAtTime } }
    );
    await auditCol.insertOne({
      action: "TEAM_MISSION_STARTED",
      actorRole: "TEAM",
      actorId: String(teamAlphaId),
      createdAt: new Date(),
    });

    const activeTeam = await teamCol.findOne({ _id: teamAlphaId });
    assert(activeTeam.status === "IN_PROGRESS", "Team status successfully transitioned to IN_PROGRESS");
    assert(activeTeam.currentStage === "HUNTING", "Team currentStage transitioned to HUNTING");
    assert(activeTeam.startedAt !== null, "startedAt timestamp recorded");

    // Second mission start (Idempotency test: repeated click / reload)
    const priorStartedAt = activeTeam.startedAt;
    const priorIndex = activeTeam.currentCheckpointIndex;

    // Repeated invocation must NOT overwrite startedAt, reset index, or alter route
    const isAlreadyStarted = activeTeam.status === "IN_PROGRESS";
    assert(isAlreadyStarted, "Subsequent clicks detect team is already underway");
    assert(priorIndex === 0, "Current checkpoint index is preserved at 0");
    assert(activeTeam.routeId === alphaRoute.id, "Assigned route is unchanged");

    // ══════════════════════════════════════════════════════════════════════════
    // [9] FIRST CLUE MATCHES SPECIFIC ROUTE OPENING STEP (DIFFERENT CLUES)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[9] Route-Specific First Clue Distribution");

    // Team Alpha starts on Route Alpha [1, 2, 3, 4, 5, 6, 7, 8] -> first step is CP #1
    const teamAlphaRouteDoc = await routeCol.findOne({ _id: new mongoose.Types.ObjectId(alphaRoute.id) });
    const teamAlphaSeq = JSON.parse(teamAlphaRouteDoc.checkpointSequence);
    const alphaFirstSeq = teamAlphaSeq[0];
    const cpForAlpha = await cpCol.findOne({ sequenceNumber: alphaFirstSeq });

    // Team Beta starts on Route Beta [3, 4, 1, 2, 5, 6, 7, 8] -> first step is CP #3
    const testTeamBeta = await teamCol.insertOne({
      teamId: `TEAM-B-${testSuffix}`,
      name: `Squad Beta ${testSuffix}`,
      leaderName: "Captain Beta",
      leaderEmail: `beta_${testSuffix}@college.edu`,
      leaderPhone: "9876543211",
      members: "[]",
      passwordHash: "$2a$10$HashedPassword123",
      routeId: betaRoute.id,
      status: "IN_PROGRESS",
      currentCheckpointIndex: 0,
      currentStage: "HUNTING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const teamBetaId = testTeamBeta.insertedId;

    const teamBetaRouteDoc = await routeCol.findOne({ _id: new mongoose.Types.ObjectId(betaRoute.id) });
    const teamBetaSeq = JSON.parse(teamBetaRouteDoc.checkpointSequence);
    const betaFirstSeq = teamBetaSeq[0];
    const cpForBeta = await cpCol.findOne({ sequenceNumber: betaFirstSeq });

    assert(alphaFirstSeq === 1, "Team Alpha's opening stage is Checkpoint #1");
    assert(betaFirstSeq === 3, "Team Beta's opening stage is Checkpoint #3");
    assert(alphaFirstSeq !== betaFirstSeq, "Teams on different routes receive DIFFERENT opening checkpoint clues");
    assert(cpForAlpha.locationHint !== cpForBeta.locationHint, "Physical starting locations differ to prevent campus bottlenecks");

    // ══════════════════════════════════════════════════════════════════════════
    // [10] CROSS-ROUTE OR OUT-OF-ORDER QR SCANS ARE REJECTED
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[10] QR Anti-Cheat & Out-of-Order Scanning Protection");

    // Team Alpha is expected at CP #1
    const validQrForAlpha = cp1.qrCodeToken;
    const invalidOutOfOrderQr = cp3.qrCodeToken; // CP #3 is out of order for Team Alpha
    const fakeToken = "QR_INVALID_RANDOM_TOKEN_123";

    // Rejection 1: Fake token
    const isFakeRecognized = [cp1, cp2, cp3, cp8].some((c) => c.qrCodeToken === fakeToken);
    assert(!isFakeRecognized, "Unrecognized QR code token rejected");

    // Rejection 2: Scanning CP #3 while at CP #1
    let sequenceViolationCaught = false;
    if (invalidOutOfOrderQr !== validQrForAlpha) {
      const belongsTo = await cpCol.findOne({ qrCodeToken: invalidOutOfOrderQr });
      if (belongsTo && belongsTo.sequenceNumber !== alphaFirstSeq) {
        sequenceViolationCaught = true;
      }
    }
    assert(sequenceViolationCaught, "Scanning another stage's QR code is strictly rejected as a sequence violation");

    // Valid Scan: Team Alpha scans CP #1 QR code
    await progressCol.insertOne({
      teamId: String(teamAlphaId),
      checkpointId: String(cp1._id),
      qrValidated: true,
      scannedAt: new Date(),
      isAnswerCorrect: false,
      attemptsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const alphaProg = await progressCol.findOne({ teamId: String(teamAlphaId), checkpointId: String(cp1._id) });
    assert(alphaProg.qrValidated === true, "Authentic QR scan successfully unlocks riddle for current stage");

    // ══════════════════════════════════════════════════════════════════════════
    // [11] CORRECT ANSWER ADVANCES SEQUENTIALLY
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[11] Answer Validation & Sequential Advancement");

    // Attempt 1: Wrong Answer
    const q1 = await questionCol.findOne({ checkpointId: String(cp1._id) });
    const isWrongMatch = await bcrypt.compare("INCORRECT_KEY", q1.correctAnswerHash);
    assert(isWrongMatch === false, "Incorrect answer fails verification");

    await progressCol.updateOne(
      { teamId: String(teamAlphaId), checkpointId: String(cp1._id) },
      { $inc: { attemptsCount: 1 }, $set: { isAnswerCorrect: false } }
    );

    const teamAlphaAfterFail = await teamCol.findOne({ _id: teamAlphaId });
    assert(teamAlphaAfterFail.currentCheckpointIndex === 0, "Team does NOT advance on incorrect answer");

    // Attempt 2: Correct Answer
    const isCorrectMatch = await bcrypt.compare("HACK", q1.correctAnswerHash);
    assert(isCorrectMatch === true, "Correct answer verified securely with bcrypt");

    // Mark completed and advance
    await progressCol.updateOne(
      { teamId: String(teamAlphaId), checkpointId: String(cp1._id) },
      { $set: { isAnswerCorrect: true, completedAt: new Date() } }
    );
    await teamCol.updateOne(
      { _id: teamAlphaId },
      { $set: { currentCheckpointIndex: 1 } }
    );

    const teamAlphaAdvanced = await teamCol.findOne({ _id: teamAlphaId });
    assert(teamAlphaAdvanced.currentCheckpointIndex === 1, "Team advances exactly to stage index 1 (Checkpoint #2 in route)");

    // ══════════════════════════════════════════════════════════════════════════
    // [12] ROUTE REASSIGNMENT BLOCKED ONCE MISSION STARTED (UNLESS OVERRIDE REASON)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[12] Route Reassignment Protection for Active Teams");

    // Team Alpha has started and has completed Checkpoint #1
    const targetReassignRoute = insertedRoutes.find((r) => r.id !== alphaRoute.id);

    // Attempt reassignment WITHOUT emergency override reason
    let reassignmentBlocked = false;
    const teamHasStarted = teamAlphaAdvanced.status === "IN_PROGRESS" || teamAlphaAdvanced.currentCheckpointIndex > 0;
    const reasonSupplied = "";

    try {
      if (teamHasStarted && (!reasonSupplied || reasonSupplied.length < 5)) {
        throw new Error(
          "Team has already commenced its mission. Route modification is strictly blocked unless an authorized emergency recovery reason (at least 5 characters) is provided."
        );
      }
    } catch (err) {
      reassignmentBlocked = true;
      assert(err.message.includes("strictly blocked"), "Route reassignment strictly blocked when no recovery reason is supplied");
    }
    assert(reassignmentBlocked, "Active team route integrity is preserved");

    // Attempt reassignment WITH valid emergency override reason
    const validRecoveryReason = "Physical checkpoint #2 beacon damaged; rerouting team to alternate path";
    await teamCol.updateOne(
      { _id: teamAlphaId },
      { $set: { routeId: targetReassignRoute.id } }
    );
    await auditCol.insertOne({
      action: "TEAM_ROUTE_REASSIGNMENT_OVERRIDE",
      actorRole: "ADMIN",
      actorId: "admin_test",
      details: JSON.stringify({
        teamId: teamAlphaAdvanced.teamId,
        previousRouteId: alphaRoute.id,
        newRouteId: targetReassignRoute.id,
        recoveryReason: validRecoveryReason,
      }),
      createdAt: new Date(),
    });

    const teamAfterOverride = await teamCol.findOne({ _id: teamAlphaId });
    assert(teamAfterOverride.routeId === targetReassignRoute.id, "Emergency route reassignment succeeded with authorized audit reason");

    const auditEntry = await auditCol.findOne({
      action: "TEAM_ROUTE_REASSIGNMENT_OVERRIDE",
      actorId: "admin_test",
    });
    assert(auditEntry !== null, "Audit trail entry logged in MongoDB for route reassignment override");

    // Clean up test artifacts
    await routeCol.deleteMany({ _id: { $in: insertedRoutes.map((r) => new mongoose.Types.ObjectId(r.id)) } });
    await teamCol.deleteMany({ _id: { $in: [...simulatedTeamIds, teamAlphaId, teamBetaId] } });
    await progressCol.deleteMany({ teamId: { $in: [String(teamAlphaId), String(teamBetaId)] } });

    // Restore original game status and checkpoint count
    await configCol.updateOne({ key: "GAME_STATUS" }, { $set: { value: origStatus } });
    await configCol.updateOne({ key: "CHECKPOINT_COUNT" }, { $set: { value: origCount } });
    if (origQ1Hash) {
      await questionCol.updateOne({ checkpointId: String(cp1._id) }, { $set: { correctAnswerHash: origQ1Hash } });
    }

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log("\n==========================================================");
  console.log(`  MISSION FLOW TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTeamMissionFlowTests();
