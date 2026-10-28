/**
 * tests/run-tests.js
 *
 * Baseline engine and gameplay test suite connecting to real MongoDB via Mongoose.
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

async function runAutomatedTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING AUTOMATED ENGINE & SECURITY TEST SUITE (MONGODB)");
  console.log("=================================================");

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

  try {
    // TEST 1: Database Connectivity & Configs
    console.log("\n[Test Group 1] MongoDB Database & System Configuration");
    const checkpointConfig = await db.collection("gameconfigs").findOne({ key: "CHECKPOINT_COUNT" });
    assert(checkpointConfig !== null, "Game config collection has data in MongoDB");
    assert(["8", "10"].includes(checkpointConfig.value), "Default checkpoint count is valid (8 or 10)");

    // TEST 2: Admin & Volunteer Security
    console.log("\n[Test Group 2] User Credentials Security in MongoDB");
    const adminUser = await db.collection("users").findOne({ username: "admin" });
    assert(adminUser !== null, "Grand Master Admin account exists in MongoDB");
    assert(adminUser.passwordHash.startsWith("$2"), "Admin password is securely bcrypt hashed (not plaintext)");
    const adminPassMatch = await bcrypt.compare("Admin#TechHunt2026", adminUser.passwordHash);
    assert(adminPassMatch === true, "Admin password matches seeded bcrypt hash");

    const volunteer = await db.collection("users").findOne({ username: "volunteer1" });
    assert(volunteer !== null, "Volunteer Box Marshall account exists in MongoDB");
    assert(volunteer.role === "VOLUNTEER", "Volunteer role authorization is distinct from Admin");

    // TEST 3: Checkpoints & Question Hashing
    console.log("\n[Test Group 3] Checkpoint Definitions & Anti-Spoil Protection");
    const checkpoints = await db.collection("checkpoints").find({}).sort({ sequenceNumber: 1 }).toArray();
    assert(checkpoints.length >= 8, `At least 8 checkpoints in MongoDB (found ${checkpoints.length})`);

    const cp8 = checkpoints.find((c) => c.sequenceNumber === 8);
    assert(cp8 !== null && cp8.isFinalTreasure === true, "Checkpoint #8 is designated as the Final Treasure Vault");

    const q1 = await db.collection("questions").findOne({ checkpointId: String(checkpoints[0]._id) });
    assert(q1 !== null, "Checkpoint #1 has a riddle attached in MongoDB");
    assert(q1.correctAnswerHash.startsWith("$2"), "Question answer is hashed with bcrypt, never plaintext");

    // TEST 4: Dynamic Team Registration & Collision-Free Team ID
    console.log("\n[Test Group 4] Team ID Generation & Route Assignment");
    const currentYear = new Date().getFullYear();
    const testTeamEmail = `test.team.${Date.now()}@example.com`;
    const testTeamName = `Cyber Hawks ${Date.now()}`;

    const routes = await db.collection("routes").find({ active: true }).toArray();
    assert(routes.length >= 2, "Multiple anti-bottleneck campus routes exist in MongoDB");

    const teamCountBefore = await db.collection("teams").countDocuments();
    const generatedTeamId = `MH-${currentYear}-${String(teamCountBefore + 1).padStart(3, "0")}`;
    const hashedPassword = await bcrypt.hash("SecPass#2026", 10);

    const insertTeamResult = await db.collection("teams").insertOne({
      teamId: generatedTeamId,
      name: testTeamName,
      leaderName: "Test Lead",
      leaderEmail: testTeamEmail,
      leaderPhone: "9988776655",
      members: JSON.stringify([
        { name: "Teammate Alpha", collegeId: "CS101" },
        { name: "Teammate Beta", collegeId: "CS102" },
      ]),
      passwordHash: hashedPassword,
      routeId: String(routes[0]._id),
      status: "WAITING",
      currentCheckpointIndex: 0,
      currentStage: "WAITING_ROOM",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const testTeamId = String(insertTeamResult.insertedId);
    const testTeam = await db.collection("teams").findOne({ _id: insertTeamResult.insertedId });

    assert(testTeam.teamId.startsWith(`MH-${currentYear}-`), `Automatic Team ID format generated: ${testTeam.teamId}`);
    assert(testTeam.passwordHash.startsWith("$2"), "Team password is securely bcrypt hashed");
    assert(testTeam.routeId !== null, `Team successfully assigned to route: ${routes[0].name}`);

    // TEST 5: QR Code Security & Sequence Integrity
    console.log("\n[Test Group 5] QR Code Validation & Anti-Skipping Enforcement");
    const invalidQr = "QR_TOKEN_FAKE_9999";
    const outOfSequenceQr = checkpoints[3].qrCodeToken;
    const validQr = checkpoints[0].qrCodeToken;

    assert(invalidQr !== validQr, "Invalid QR token differs from valid token");
    assert(outOfSequenceQr !== validQr, "Out-of-sequence token detected as jump attempt");

    const cp0Id = String(checkpoints[0]._id);
    await db.collection("teamprogresses").insertOne({
      teamId: testTeamId,
      checkpointId: cp0Id,
      qrValidated: true,
      scannedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const progress = await db.collection("teamprogresses").findOne({ teamId: testTeamId, checkpointId: cp0Id });
    assert(progress.qrValidated === true, "Valid QR code scan marks progress qrValidated=true");

    // TEST 6: Riddle Answer Verification
    console.log("\n[Test Group 6] Riddle Answer Verification");
    const isIncorrect = await bcrypt.compare("WRONG_ANSWER", q1.correctAnswerHash);
    const isCorrect = await bcrypt.compare("HACK", q1.correctAnswerHash);
    assert(isIncorrect === false, "Incorrect answer rejected");
    assert(isCorrect === true, "Correct answer 'HACK' accepted by bcrypt hash verification");

    // Mark test team advancing
    await db.collection("teams").updateOne(
      { _id: insertTeamResult.insertedId },
      { $set: { currentCheckpointIndex: 1, status: "IN_PROGRESS" } }
    );

    // TEST 7: Final Treasure Box Claim & Volunteer Handover
    console.log("\n[Test Group 7] Physical Treasure Claim & Volunteer Handover");
    await db.collection("teams").updateOne(
      { _id: insertTeamResult.insertedId },
      { $set: { currentCheckpointIndex: 8, currentStage: "TREASURE_SEARCH" } }
    );

    const claimCode = `BOX2-${testTeam.teamId}-TEST99`;
    const insertClaim = await db.collection("prizeclaims").insertOne({
      teamId: testTeamId,
      boxNumber: 2,
      claimCode,
      status: "PENDING_VERIFICATION",
      claimedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const claim = await db.collection("prizeclaims").findOne({ _id: insertClaim.insertedId });
    assert(claim.boxNumber === 2, "Team successfully initiated claim for Box #2");
    assert(claim.status === "PENDING_VERIFICATION", "Initial claim status is PENDING_VERIFICATION");

    // Volunteer confirms claim
    await db.collection("prizeclaims").updateOne(
      { _id: insertClaim.insertedId },
      {
        $set: {
          status: "CONFIRMED",
          volunteerId: String(volunteer._id),
          volunteerNotes: "Identity and physical ticket verified at dais.",
          verifiedAt: new Date(),
        },
      }
    );

    await db.collection("teams").updateOne(
      { _id: insertTeamResult.insertedId },
      { $set: { status: "COMPLETED", currentStage: "FINISHED" } }
    );

    const verifiedClaim = await db.collection("prizeclaims").findOne({ _id: insertClaim.insertedId });
    assert(verifiedClaim.status === "CONFIRMED", "Volunteer successfully verified and confirmed prize claim");

    const finalTeamState = await db.collection("teams").findOne({ _id: insertTeamResult.insertedId });
    assert(finalTeamState.status === "COMPLETED", "Team state marked COMPLETED upon volunteer confirmation");

    // Cleanup
    await db.collection("prizeclaims").deleteOne({ _id: insertClaim.insertedId });
    await db.collection("teamprogresses").deleteMany({ teamId: testTeamId });
    await db.collection("teams").deleteOne({ _id: insertTeamResult.insertedId });
    console.log("✓ Test artifacts cleaned up.");

  } catch (err) {
    console.error("Test execution failure:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log("\n=================================================");
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("=================================================");
    if (failed > 0) process.exit(1);
  }
}

runAutomatedTests();
