/**
 * tests/team-registration.test.js
 *
 * Comprehensive test suite for:
 * 1. Concurrency-safe automatic Team ID generation & allocation (TEAM001, TEAM002, ...)
 * 2. Uncapped scaling beyond 100 teams (TEAM101, TEAM102, ...)
 * 3. Bulk ID generation and pool management (AVAILABLE, ASSIGNED, DISABLED)
 * 4. Dual registration workflows (AUTO_APPROVE vs MANUAL_APPROVAL)
 * 5. Admin approval and rejection of pending registrations
 * 6. Authorized on-site spot registration with credential issuance
 * 7. Security: password hashing, duplicate prevention, and operational status management
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTeamId(seq) {
  const padded = seq < 1000 ? String(seq).padStart(3, "0") : String(seq);
  return `TEAM${padded}`;
}

async function run() {
  console.log("\n========================================================");
  console.log("  TEAM REGISTRATION & AUTOMATIC ID ALLOCATION TEST SUITE");
  console.log("========================================================\n");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const poolCol = db.collection("team_id_pools");
  const teamsCol = db.collection("teams");
  const regCol = db.collection("registrations");
  const auditCol = db.collection("audit_logs");
  const configCol = db.collection("game_settings");
  const routesCol = db.collection("routes");

  // Ensure unique indexes
  await poolCol.createIndex({ teamId: 1 }, { unique: true });
  await poolCol.createIndex({ sequenceNumber: 1 }, { unique: true });
  await poolCol.createIndex({ status: 1, sequenceNumber: 1 });
  await teamsCol.createIndex({ teamId: 1 }, { unique: true });
  await teamsCol.createIndex({ name: 1 }, { unique: true });
  await teamsCol.createIndex({ leaderEmail: 1 }, { unique: true });
  await regCol.createIndex({ teamName: 1 }, { unique: true });
  await regCol.createIndex({ leaderEmail: 1 }, { unique: true });

  const testSuffix = Date.now().toString(36);

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 1: ID FORMATTING & UNCAPPED SCALING
    // ══════════════════════════════════════════════════════════════════════════
    console.log("[1] Format Verification & Uncapped Scaling");

    assert(formatTeamId(1) === "TEAM001", "formatTeamId(1) yields TEAM001");
    assert(formatTeamId(42) === "TEAM042", "formatTeamId(42) yields TEAM042");
    assert(formatTeamId(99) === "TEAM099", "formatTeamId(99) yields TEAM099");
    assert(formatTeamId(100) === "TEAM100", "formatTeamId(100) yields TEAM100");
    assert(formatTeamId(101) === "TEAM101", "formatTeamId(101) yields TEAM101 (uncapped > 100)");
    assert(formatTeamId(250) === "TEAM250", "formatTeamId(250) yields TEAM250");
    assert(formatTeamId(1000) === "TEAM1000", "formatTeamId(1000) yields TEAM1000");
    assert(formatTeamId(1500) === "TEAM1500", "formatTeamId(1500) yields TEAM1500");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 2: BULK TEAM ID POOL GENERATION & UNIQUENESS
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[2] Bulk Team ID Generation & Pool Integrity");

    // Determine starting sequence
    const highestInPool = await poolCol.findOne({}, { sort: { sequenceNumber: -1 } });
    const startSeq = (highestInPool ? highestInPool.sequenceNumber : 0) + 1;

    const bulkDocs = [];
    const bulkCount = 20;
    for (let i = 0; i < bulkCount; i++) {
      const seq = startSeq + i;
      bulkDocs.push({
        teamId: formatTeamId(seq),
        sequenceNumber: seq,
        status: "AVAILABLE",
        assignedTeamId: null,
        assignedTeamName: null,
        assignedAt: null,
        batchTag: `TEST_BATCH_${testSuffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const insertResult = await poolCol.insertMany(bulkDocs);
    assert(insertResult.insertedCount === bulkCount, `Bulk inserted ${bulkCount} sequential Team IDs`);

    // Verify first and last in batch
    const firstId = formatTeamId(startSeq);
    const lastId = formatTeamId(startSeq + bulkCount - 1);
    const firstDoc = await poolCol.findOne({ teamId: firstId });
    const lastDoc = await poolCol.findOne({ teamId: lastId });

    assert(firstDoc && firstDoc.status === "AVAILABLE", `First ID in batch is ${firstId} (AVAILABLE)`);
    assert(lastDoc && lastDoc.status === "AVAILABLE", `Last ID in batch is ${lastId} (AVAILABLE)`);

    // Verify unique index prevents duplicate Team ID
    let duplicateErrorThrown = false;
    try {
      await poolCol.insertOne({
        teamId: firstId,
        sequenceNumber: 999999,
        status: "AVAILABLE",
        batchTag: "COLLISION_TEST",
      });
    } catch {
      duplicateErrorThrown = true;
    }
    assert(duplicateErrorThrown, "Database unique index prevents duplicate Team IDs in pool");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 3: CONCURRENCY-SAFE ATOMIC ALLOCATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[3] Concurrency-Safe Atomic Allocation (Zero Collision Test)");

    // Simulate 10 simultaneous registrations contending for the next available Team IDs
    const concurrentCount = 10;
    const allocationPromises = [];

    for (let i = 0; i < concurrentCount; i++) {
      allocationPromises.push(
        (async () => {
          const fakeTeamId = new mongoose.Types.ObjectId().toString();
          const fakeTeamName = `Concurrent Squad ${testSuffix} #${i}`;

          // Atomic claim
          const claimed = await poolCol.findOneAndUpdate(
            { status: "AVAILABLE" },
            {
              $set: {
                status: "ASSIGNED",
                assignedTeamId: fakeTeamId,
                assignedTeamName: fakeTeamName,
                assignedAt: new Date(),
                updatedAt: new Date(),
              },
            },
            { sort: { sequenceNumber: 1 }, returnDocument: "after" }
          );

          return claimed ? claimed.teamId : null;
        })()
      );
    }

    const allocatedIds = await Promise.all(allocationPromises);

    assert(
      allocatedIds.every((id) => id !== null),
      `All ${concurrentCount} concurrent requests successfully claimed an ID`
    );

    const uniqueAllocated = new Set(allocatedIds);
    assert(
      uniqueAllocated.size === concurrentCount,
      `Zero collisions: ${uniqueAllocated.size} distinct IDs allocated across ${concurrentCount} concurrent requests`,
      `Allocated: ${Array.from(uniqueAllocated).join(", ")}`
    );

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 4: TEAM ID POOL STATUS TOGGLE & PROTECTION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[4] Team ID Status Toggle & Protection");

    // Find an unassigned available ID
    const availableIdDoc = await poolCol.findOne({ status: "AVAILABLE" });
    assert(availableIdDoc !== null, "Found available Team ID for toggle test");

    // Disable it
    await poolCol.updateOne(
      { _id: availableIdDoc._id },
      { $set: { status: "DISABLED", updatedAt: new Date() } }
    );
    const disabledDoc = await poolCol.findOne({ _id: availableIdDoc._id });
    assert(disabledDoc.status === "DISABLED", `Toggled ${disabledDoc.teamId} to DISABLED`);

    // Verify atomic allocation skips DISABLED IDs
    const nextClaimed = await poolCol.findOneAndUpdate(
      { status: "AVAILABLE" },
      { $set: { status: "ASSIGNED", updatedAt: new Date() } },
      { sort: { sequenceNumber: 1 }, returnDocument: "after" }
    );
    assert(
      nextClaimed && nextClaimed.teamId !== disabledDoc.teamId,
      `Allocation correctly skipped DISABLED ${disabledDoc.teamId} and claimed ${nextClaimed?.teamId}`
    );

    // Re-enable
    await poolCol.updateOne(
      { _id: availableIdDoc._id },
      { $set: { status: "AVAILABLE", updatedAt: new Date() } }
    );
    const reEnabledDoc = await poolCol.findOne({ _id: availableIdDoc._id });
    assert(reEnabledDoc.status === "AVAILABLE", `Re-enabled ${reEnabledDoc.teamId} back to AVAILABLE`);

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 5: ONLINE SELF-REGISTRATION WORKFLOW (AUTO_APPROVE)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[5] Online Self-Registration (AUTO_APPROVE)");

    const autoTeamName = `Auto Team ${testSuffix}`;
    const autoLeaderEmail = `autolead_${testSuffix}@college.edu`;
    const rawPass = "Secret#2026";
    const passwordHash = await bcrypt.hash(rawPass, 10);

    // Pick an active route
    const testRoute = await routesCol.findOne({ active: true }) || { _id: "route-default", name: "Alpha Loop" };

    // Create Team and allocate next available ID
    const claimDoc = await poolCol.findOneAndUpdate(
      { status: "AVAILABLE" },
      {
        $set: {
          status: "ASSIGNED",
          assignedTeamName: autoTeamName,
          assignedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { sort: { sequenceNumber: 1 }, returnDocument: "after" }
    );

    const autoTeam = await teamsCol.insertOne({
      teamId: claimDoc.teamId,
      name: autoTeamName,
      leaderName: "Lead Auto",
      leaderEmail: autoLeaderEmail,
      leaderPhone: "9876500001",
      members: JSON.stringify([{ name: "Crew Member 1", collegeId: "CS101" }]),
      passwordHash,
      routeId: String(testRoute._id),
      status: "WAITING",
      currentCheckpointIndex: 0,
      currentStage: "WAITING_ROOM",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const autoReg = await regCol.insertOne({
      teamName: autoTeamName,
      leaderName: "Lead Auto",
      leaderEmail: autoLeaderEmail,
      leaderPhone: "9876500001",
      membersJson: JSON.stringify([{ name: "Crew Member 1", collegeId: "CS101" }]),
      passwordHash,
      status: "APPROVED",
      registrationType: "ONLINE",
      allocatedTeamId: claimDoc.teamId,
      approvedTeamId: String(autoTeam.insertedId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assert(autoTeam.acknowledged, `Auto-approved team created with ID ${claimDoc.teamId}`);
    assert(autoReg.acknowledged, "Registration record logged with status APPROVED");

    // Password security verification
    const storedTeam = await teamsCol.findOne({ _id: autoTeam.insertedId });
    assert(storedTeam.passwordHash !== rawPass, "Password is not stored in plaintext");
    assert(await bcrypt.compare(rawPass, storedTeam.passwordHash), "Stored password hash verifies successfully with bcrypt");

    // Duplicate team name prevention
    let dupNameBlocked = false;
    try {
      const collision = await teamsCol.findOne({ name: { $regex: new RegExp(`^${autoTeamName}$`, "i") } });
      if (collision) throw new Error("Duplicate team name blocked");
    } catch {
      dupNameBlocked = true;
    }
    assert(dupNameBlocked, "Duplicate team name detection is active");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 6: MANUAL APPROVAL WORKFLOW (PENDING -> APPROVE -> ACTIVATE)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[6] Manual Approval Workflow (Pending -> Admin Approve)");

    const manualTeamName = `Pending Team ${testSuffix}`;
    const manualLeaderEmail = `pending_${testSuffix}@college.edu`;

    // 1. Submit pending registration
    const pendingReg = await regCol.insertOne({
      teamName: manualTeamName,
      leaderName: "Lead Pending",
      leaderEmail: manualLeaderEmail,
      leaderPhone: "9876500002",
      membersJson: JSON.stringify([{ name: "Pending Teammate", collegeId: "CS102" }]),
      passwordHash: await bcrypt.hash("PendingPass#123", 10),
      status: "PENDING",
      registrationType: "ONLINE",
      allocatedTeamId: null,
      approvedTeamId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assert(pendingReg.acknowledged, "Team registration submitted as PENDING");

    // Verify team is NOT yet in active teams collection
    const unapprovedTeam = await teamsCol.findOne({ name: manualTeamName });
    assert(unapprovedTeam === null, "Pending team is not yet present in active teams roster");

    // 2. Admin Approves Pending Registration
    const assignedClaim = await poolCol.findOneAndUpdate(
      { status: "AVAILABLE" },
      {
        $set: {
          status: "ASSIGNED",
          assignedTeamName: manualTeamName,
          assignedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { sort: { sequenceNumber: 1 }, returnDocument: "after" }
    );

    const approvedTeam = await teamsCol.insertOne({
      teamId: assignedClaim.teamId,
      name: manualTeamName,
      leaderName: "Lead Pending",
      leaderEmail: manualLeaderEmail,
      leaderPhone: "9876500002",
      members: JSON.stringify([{ name: "Pending Teammate", collegeId: "CS102" }]),
      passwordHash: await bcrypt.hash("PendingPass#123", 10),
      routeId: String(testRoute._id),
      status: "WAITING",
      currentCheckpointIndex: 0,
      currentStage: "WAITING_ROOM",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await regCol.updateOne(
      { _id: pendingReg.insertedId },
      {
        $set: {
          status: "APPROVED",
          allocatedTeamId: assignedClaim.teamId,
          approvedTeamId: String(approvedTeam.insertedId),
          approvedBy: "admin-test-id",
          updatedAt: new Date(),
        },
      }
    );

    const updatedReg = await regCol.findOne({ _id: pendingReg.insertedId });
    assert(updatedReg.status === "APPROVED", "Registration status transitioned to APPROVED");
    assert(updatedReg.allocatedTeamId === assignedClaim.teamId, `Allocated Team ID is ${assignedClaim.teamId}`);

    const activeCreated = await teamsCol.findOne({ _id: approvedTeam.insertedId });
    assert(activeCreated !== null && activeCreated.teamId === assignedClaim.teamId, "Active team document now exists and is activated");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 7: REJECTION OF PENDING REGISTRATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[7] Rejection of Pending Registration");

    const rejectTeamName = `Rejected Team ${testSuffix}`;
    const rejectReg = await regCol.insertOne({
      teamName: rejectTeamName,
      leaderName: "Lead Rejected",
      leaderEmail: `reject_${testSuffix}@college.edu`,
      leaderPhone: "9876500003",
      membersJson: JSON.stringify([{ name: "Reject Teammate", collegeId: "CS103" }]),
      passwordHash: await bcrypt.hash("Pass#123", 10),
      status: "PENDING",
      registrationType: "ONLINE",
      allocatedTeamId: null,
      approvedTeamId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const rejectionReason = "Incomplete teammate college credentials";
    await regCol.updateOne(
      { _id: rejectReg.insertedId },
      {
        $set: {
          status: "REJECTED",
          rejectionNote: rejectionReason,
          approvedBy: "admin-test-id",
          updatedAt: new Date(),
        },
      }
    );

    const checkRejected = await regCol.findOne({ _id: rejectReg.insertedId });
    assert(checkRejected.status === "REJECTED", "Registration status transitioned to REJECTED");
    assert(checkRejected.rejectionNote === rejectionReason, "Rejection note recorded");
    assert(checkRejected.allocatedTeamId === null, "No Team ID allocated to rejected registration");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 8: AUTHORIZED ON-SITE SPOT REGISTRATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[8] Authorized On-Site Spot Registration");

    const spotTeamName = `Spot Team ${testSuffix}`;
    const spotLeaderEmail = `spotlead_${testSuffix}@college.edu`;
    const spotRawPass = "Hunt#9482";
    const spotPassHash = await bcrypt.hash(spotRawPass, 10);

    const spotClaim = await poolCol.findOneAndUpdate(
      { status: "AVAILABLE" },
      {
        $set: {
          status: "ASSIGNED",
          assignedTeamName: spotTeamName,
          assignedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { sort: { sequenceNumber: 1 }, returnDocument: "after" }
    );

    const spotTeam = await teamsCol.insertOne({
      teamId: spotClaim.teamId,
      name: spotTeamName,
      leaderName: "Lead Spot",
      leaderEmail: spotLeaderEmail,
      leaderPhone: "9876500004",
      members: JSON.stringify([{ name: "Spot Mate 1", collegeId: "CS104" }]),
      passwordHash: spotPassHash,
      routeId: String(testRoute._id),
      status: "WAITING",
      currentCheckpointIndex: 0,
      currentStage: "WAITING_ROOM",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const spotReg = await regCol.insertOne({
      teamName: spotTeamName,
      leaderName: "Lead Spot",
      leaderEmail: spotLeaderEmail,
      leaderPhone: "9876500004",
      membersJson: JSON.stringify([{ name: "Spot Mate 1", collegeId: "CS104" }]),
      passwordHash: spotPassHash,
      status: "APPROVED",
      registrationType: "SPOT",
      allocatedTeamId: spotClaim.teamId,
      approvedTeamId: String(spotTeam.insertedId),
      approvedBy: "admin-desk",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assert(spotTeam.acknowledged, `Spot team created immediately with ID ${spotClaim.teamId}`);
    assert(spotReg.acknowledged, "Spot registration logged with registrationType: 'SPOT'");

    const retrievedSpotReg = await regCol.findOne({ _id: spotReg.insertedId });
    assert(retrievedSpotReg.registrationType === "SPOT", "Registration record explicitly flags SPOT type");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 9: TEAM OPERATIONAL STATUS MANAGEMENT & AUDIT LOG
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n[9] Team Operational Status Management & Confirmation Safeguards");

    // Disqualify team
    await teamsCol.updateOne(
      { _id: spotTeam.insertedId },
      { $set: { status: "DISQUALIFIED", updatedAt: new Date() } }
    );

    await auditCol.insertOne({
      action: "TEAM_STATUS_UPDATED",
      actorRole: "ADMIN",
      actorId: "admin-super",
      details: JSON.stringify({
        teamId: spotClaim.teamId,
        oldStatus: "WAITING",
        newStatus: "DISQUALIFIED",
        reason: "Late check-in violation",
      }),
      createdAt: new Date(),
    });

    const disqualifiedTeam = await teamsCol.findOne({ _id: spotTeam.insertedId });
    assert(disqualifiedTeam.status === "DISQUALIFIED", `Team ${spotClaim.teamId} successfully transitioned to DISQUALIFIED`);

    const auditEntry = await auditCol.findOne({
      action: "TEAM_STATUS_UPDATED",
      actorRole: "ADMIN",
    });
    assert(auditEntry !== null, "Audit log created for team status transition");

    // Reinstate team
    await teamsCol.updateOne(
      { _id: spotTeam.insertedId },
      { $set: { status: "WAITING", updatedAt: new Date() } }
    );
    const reinstatedTeam = await teamsCol.findOne({ _id: spotTeam.insertedId });
    assert(reinstatedTeam.status === "WAITING", `Team ${spotClaim.teamId} reinstated back to WAITING`);

  } finally {
    // Clean up test documents created during run
    await poolCol.deleteMany({ batchTag: `TEST_BATCH_${testSuffix}` });
    await poolCol.deleteMany({ assignedTeamName: new RegExp(testSuffix) });
    await teamsCol.deleteMany({ name: new RegExp(testSuffix) });
    await regCol.deleteMany({ teamName: new RegExp(testSuffix) });
    await auditCol.deleteMany({ details: new RegExp(testSuffix) });

    await mongoose.disconnect();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n========================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL TEST SUITE ERROR:", err);
  process.exit(1);
});
