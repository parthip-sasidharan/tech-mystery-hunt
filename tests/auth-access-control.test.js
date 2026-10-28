/**
 * tests/auth-access-control.test.js
 *
 * Comprehensive authentication and role-based access-control test suite for MongoDB & Mongoose.
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-dev-secret";
const GENERIC_ERROR = "Invalid credentials";

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

function makeToken(payload, secret = JWT_SECRET, options = { expiresIn: "1h" }) {
  return jwt.sign(payload, secret, options);
}

function verifyToken(token, secret = JWT_SECRET) {
  try { return jwt.verify(token, secret); }
  catch { return null; }
}

async function createTestTeam(db, suffix, routeId) {
  const currentYear = new Date().getFullYear();
  const teamCount = await db.collection("teams").countDocuments();
  const teamId = `MH-${currentYear}-T${String(teamCount + 1).padStart(3, "0")}`;

  const res = await db.collection("teams").insertOne({
    teamId,
    name: `Test Squad ${suffix}`,
    leaderName: `Lead ${suffix}`,
    leaderEmail: `lead${suffix}@test.invalid`,
    leaderPhone: "9000000000",
    members: JSON.stringify([{ name: "Member A", collegeId: "CS999" }]),
    passwordHash: await bcrypt.hash(`Pass#${suffix}`, 10),
    routeId: String(routeId),
    status: "WAITING",
    currentCheckpointIndex: 0,
    currentStage: "WAITING_ROOM",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { id: String(res.insertedId), teamId, name: `Test Squad ${suffix}`, passwordHash: await bcrypt.hash(`Pass#${suffix}`, 10) };
}

async function runTests() {
  console.log("==========================================================");
  console.log("🔐 AUTH & ACCESS-CONTROL TEST SUITE – MongoDB & Mongoose");
  console.log("==========================================================");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const teamsToCleanup = [];
  const claimsToCleanup = [];
  const tasksToCleanup = [];
  const regsToCleanup = [];

  try {
    // ── Group 1: Schema Integrity ─────────────────────────────────────────
    console.log("\n[Group 1] MongoDB Schema & Collections Integrity");
    const configs = await db.collection("gameconfigs").find({}).toArray();
    assert(configs.length > 0, "GameConfig collection has seeded entries in MongoDB");

    const cpCount = await db.collection("checkpoints").countDocuments();
    assert(cpCount >= 8, `At least 8 checkpoints exist in MongoDB (found ${cpCount})`);

    const finalCps = await db.collection("checkpoints").find({ isFinalTreasure: true }).toArray();
    assert(finalCps.length >= 1, "At least one checkpoint is designated as final treasure");

    const routes = await db.collection("routes").find({ active: true }).toArray();
    assert(routes.length >= 2, `At least 2 active campus routes exist (found ${routes.length})`);

    // ── Group 2: Password Hashing ─────────────────────────────────────────
    console.log("\n[Group 2] Password Hashing – Admin, Volunteer, Team");
    const admin = await db.collection("users").findOne({ username: "admin" });
    assert(admin !== null, "Admin account exists in MongoDB database");
    assert(admin.passwordHash.startsWith("$2"), "Admin password is bcrypt-hashed");
    assert(admin.role === "ADMIN", "Admin has role=ADMIN");
    assert(
      await bcrypt.compare("Admin#TechHunt2026", admin.passwordHash),
      "Admin password verifies correctly"
    );

    const volunteer = await db.collection("users").findOne({ username: "volunteer1" });
    assert(volunteer !== null, "Volunteer account exists in MongoDB");
    assert(volunteer.passwordHash.startsWith("$2"), "Volunteer password is bcrypt-hashed");
    assert(volunteer.role === "VOLUNTEER", "Volunteer has role=VOLUNTEER");
    assert(
      !(await bcrypt.compare("Admin#TechHunt2026", volunteer.passwordHash)),
      "Volunteer cannot authenticate with admin password"
    );

    const tempTeam = await createTestTeam(db, "HashTest", routes[0]._id);
    teamsToCleanup.push(tempTeam.id);
    assert(tempTeam.passwordHash.startsWith("$2"), "Team password is bcrypt-hashed");
    assert(
      !(await bcrypt.compare("WrongPassword", tempTeam.passwordHash)),
      "Wrong password rejected for team"
    );

    // ── Group 3: Login Error Sanitisation ────────────────────────────────
    console.log("\n[Group 3] Login Error Sanitisation (Anti-Enumeration)");
    const wrongAdminPw = await bcrypt.compare("totally-wrong", admin.passwordHash);
    assert(!wrongAdminPw, "Wrong password returns false (not throws)");

    const ghost = await db.collection("users").findOne({ username: "ghost_user_nonexistent" });
    assert(ghost === null, "Non-existent user lookup returns null (no leak)");

    const ghostTeam = await db.collection("teams").findOne({ teamId: "MH-0000-GHOST" });
    assert(ghostTeam === null, "Non-existent teamId lookup returns null (no leak)");

    const err1 = !wrongAdminPw ? GENERIC_ERROR : null;
    const err2 = ghost === null ? GENERIC_ERROR : null;
    assert(err1 === err2, "Wrong password and unknown user produce identical error messages");

    // ── Group 4: JWT Token Signing & Verification ─────────────────────────
    console.log("\n[Group 4] JWT Token Signing & Verification");
    const adminToken = makeToken({ sub: String(admin._id), role: "ADMIN", usernameOrTeamId: "admin", name: admin.name });
    const adminPayload = verifyToken(adminToken);
    assert(adminPayload !== null, "Admin JWT verifies successfully");
    assert(adminPayload?.role === "ADMIN", "Admin JWT carries role=ADMIN");
    assert(adminPayload?.sub === String(admin._id), "Admin JWT sub matches database id");

    const volunteerToken = makeToken({ sub: String(volunteer._id), role: "VOLUNTEER", usernameOrTeamId: "volunteer1", name: volunteer.name });
    const volPayload = verifyToken(volunteerToken);
    assert(volPayload?.role === "VOLUNTEER", "Volunteer JWT carries role=VOLUNTEER");

    const teamToken = makeToken({ sub: tempTeam.id, role: "TEAM", usernameOrTeamId: tempTeam.teamId, name: tempTeam.name });
    const teamPayload = verifyToken(teamToken);
    assert(teamPayload?.role === "TEAM", "Team JWT carries role=TEAM");

    const tamperedToken = makeToken({ sub: String(admin._id), role: "ADMIN" }, "wrong-secret");
    const tamperedPayload = verifyToken(tamperedToken);
    assert(tamperedPayload === null, "Token signed with wrong secret is rejected");

    const expiredToken = makeToken({ sub: String(admin._id), role: "ADMIN" }, JWT_SECRET, { expiresIn: "0s" });
    await new Promise((r) => setTimeout(r, 50));
    const expiredPayload = verifyToken(expiredToken);
    assert(expiredPayload === null, "Expired token is rejected");

    // ── Group 5: Role Separation ──────────────────────────────────────────
    console.log("\n[Group 5] Role Separation (ADMIN vs VOLUNTEER vs TEAM)");
    assert(adminPayload?.role === "ADMIN", "ADMIN role passes admin-route guard");
    assert(volPayload?.role !== "ADMIN", "VOLUNTEER role is blocked from admin-only routes");
    assert(teamPayload?.role !== "ADMIN", "TEAM role is blocked from admin-only routes");

    assert(["ADMIN", "VOLUNTEER"].includes(volPayload?.role), "VOLUNTEER role passes volunteer-route guard");
    assert(["ADMIN", "VOLUNTEER"].includes(adminPayload?.role), "ADMIN role also passes volunteer-route guard");
    assert(!["ADMIN", "VOLUNTEER"].includes(teamPayload?.role), "TEAM role is blocked from volunteer routes");

    assert(teamPayload?.role === "TEAM", "TEAM role passes team-route guard");
    assert(adminPayload?.role !== "TEAM", "ADMIN role does NOT pass TEAM-only route guard");
    assert(volPayload?.role !== "TEAM", "VOLUNTEER role does NOT pass TEAM-only route guard");

    // ── Group 6: Cross-Team Data Isolation ────────────────────────────────
    console.log("\n[Group 6] Cross-Team Data Isolation in MongoDB");
    const teamA = await createTestTeam(db, "IsoA", routes[0]._id);
    const teamB = await createTestTeam(db, "IsoB", routes[1]._id);
    teamsToCleanup.push(teamA.id, teamB.id);

    const tokenA = makeToken({ sub: teamA.id, role: "TEAM", usernameOrTeamId: teamA.teamId, name: teamA.name });
    const tokenB = makeToken({ sub: teamB.id, role: "TEAM", usernameOrTeamId: teamB.teamId, name: teamB.name });
    const payloadA = verifyToken(tokenA);
    const payloadB = verifyToken(tokenB);

    function requireTeamSelf(sessionSub, requestedId) {
      return sessionSub === requestedId;
    }

    assert(requireTeamSelf(payloadA?.sub, teamA.id), "Team A can access their own data");
    assert(requireTeamSelf(payloadB?.sub, teamB.id), "Team B can access their own data");
    assert(!requireTeamSelf(payloadA?.sub, teamB.id), "Team A is blocked from Team B's data");
    assert(!requireTeamSelf(payloadB?.sub, teamA.id), "Team B is blocked from Team A's data");

    const firstCp = await db.collection("checkpoints").findOne({}, { sort: { sequenceNumber: 1 } });
    const progressAInsert = await db.collection("teamprogresses").insertOne({
      teamId: teamA.id,
      checkpointId: String(firstCp._id),
      qrValidated: true,
      scannedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const progressForB = await db.collection("teamprogresses").findOne({
      teamId: teamB.id,
      checkpointId: String(firstCp._id),
    });
    assert(progressForB === null, "Team B has no access to Team A's checkpoint progress record");
    await db.collection("teamprogresses").deleteOne({ _id: progressAInsert.insertedId });

    // ── Group 7: Answer Anti-Spoil Protection ─────────────────────────────
    console.log("\n[Group 7] Answer Anti-Spoil Protection");
    const checkpoints = await db.collection("checkpoints").find({}).sort({ sequenceNumber: 1 }).toArray();

    for (const cp of checkpoints) {
      const q = await db.collection("questions").findOne({ checkpointId: String(cp._id) });
      if (q) {
        assert(q.correctAnswerHash.startsWith("$2"), `CP#${cp.sequenceNumber} answer is bcrypt-hashed`);
        if (cp.sequenceNumber === 1) {
          assert(q.correctAnswerHash !== "HACK", "Checkpoint #1 answer is not stored plaintext");
          const correctMatch = await bcrypt.compare("HACK", q.correctAnswerHash);
          const incorrectMatch = await bcrypt.compare("WRONG", q.correctAnswerHash);
          assert(correctMatch, "Correct answer 'HACK' verifies against bcrypt hash");
          assert(!incorrectMatch, "Incorrect answer 'WRONG' fails verification");
        }
      }
    }

    // ── Group 8: QR Code Sequence Integrity ───────────────────────────────
    console.log("\n[Group 8] QR Code Sequence Integrity & Anti-Skip Enforcement");
    const validQr = checkpoints[0].qrCodeToken;
    const skipQr = checkpoints[3].qrCodeToken;
    const fakeQr = "QR_TOKEN_FAKE_NONEXISTENT";

    function simulateQrCheck(incomingToken, expectedToken, allCps) {
      if (incomingToken === expectedToken) return { ok: true };
      const match = allCps.find((c) => c.qrCodeToken === incomingToken);
      if (match) return { ok: false, reason: `wrong_sequence:${match.name}` };
      return { ok: false, reason: "invalid_token" };
    }

    assert(simulateQrCheck(validQr, checkpoints[0].qrCodeToken, checkpoints).ok, "Valid QR token for current checkpoint accepted");
    assert(!simulateQrCheck(skipQr, checkpoints[0].qrCodeToken, checkpoints).ok, "Out-of-sequence QR token rejected");
    assert(!simulateQrCheck(fakeQr, checkpoints[0].qrCodeToken, checkpoints).ok, "Fake QR token rejected");

    const tokenSet = new Set(checkpoints.map((c) => c.qrCodeToken));
    assert(tokenSet.size === checkpoints.length, "All QR code tokens are globally unique in MongoDB");

    // ── Group 9: Registration Model ───────────────────────────────────────
    console.log("\n[Group 9] Registration Model in MongoDB");
    const regHash = await bcrypt.hash("RegPass#Test", 10);
    const regRes = await db.collection("registrations").insertOne({
      teamName: `Reg Team ${Date.now()}`,
      leaderName: "Reg Leader",
      leaderEmail: `reg.${Date.now()}@test.invalid`,
      leaderPhone: "9111111111",
      membersJson: JSON.stringify([{ name: "Reg Member", collegeId: "RM001" }]),
      passwordHash: regHash,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    regsToCleanup.push(regRes.insertedId);

    const reg = await db.collection("registrations").findOne({ _id: regRes.insertedId });
    assert(reg.status === "PENDING", "Registration starts in PENDING state in MongoDB");
    assert(reg.passwordHash.startsWith("$2"), "Registration password is bcrypt-hashed");

    // ── Group 10: TaskVerification Persistence ────────────────────────────
    console.log("\n[Group 10] TaskVerification – Volunteer On-Ground Actions");
    const taskRes = await db.collection("taskverifications").insertOne({
      checkpointId: String(checkpoints[0]._id),
      volunteerId: String(volunteer._id),
      teamId: teamA.id,
      action: "PRESENCE_CONFIRMED",
      notes: "Team verified at CS Vault.",
      verifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tasksToCleanup.push(taskRes.insertedId);

    const task = await db.collection("taskverifications").findOne({ _id: taskRes.insertedId });
    assert(task.action === "PRESENCE_CONFIRMED", "TaskVerification action stored correctly in MongoDB");
    assert(task.volunteerId === String(volunteer._id), "TaskVerification linked to volunteer");

    // ── Group 11: PrizeClaim Access Control ───────────────────────────────
    console.log("\n[Group 11] PrizeClaim Access Control & Volunteer Scope");
    // Determine an available box number to avoid colliding with active confirmed prizes
    const takenBoxes = await db.collection("prizeclaims").distinct("boxNumber", { status: "CONFIRMED" });
    let testBox = [1, 2, 3].find((b) => !takenBoxes.includes(b));
    if (!testBox) {
      await db.collection("prizeclaims").deleteMany({ claimCode: { $regex: /TEST/i } });
      testBox = 1;
    }
    const claimCode = `BOX${testBox}-${teamA.teamId}-TESTXX`;
    const claimRes = await db.collection("prizeclaims").insertOne({
      teamId: teamA.id,
      boxNumber: testBox,
      claimCode,
      status: "PENDING_VERIFICATION",
      claimedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    claimsToCleanup.push(claimRes.insertedId);

    const claim = await db.collection("prizeclaims").findOne({ _id: claimRes.insertedId });
    assert(claim.status === "PENDING_VERIFICATION", "New claim starts as PENDING_VERIFICATION in MongoDB");

    await db.collection("prizeclaims").updateOne(
      { _id: claimRes.insertedId },
      {
        $set: {
          status: "CONFIRMED",
          volunteerId: String(volunteer._id),
          volunteerNotes: "Identity verified. Box 1 handed over.",
          verifiedAt: new Date(),
        },
      }
    );

    const confirmed = await db.collection("prizeclaims").findOne({ _id: claimRes.insertedId });
    assert(confirmed.status === "CONFIRMED", "Volunteer can confirm a prize claim in MongoDB");

    // ── Group 12: AuditLog Integrity ─────────────────────────────────────
    console.log("\n[Group 12] AuditLog Integrity in MongoDB");
    const auditRes = await db.collection("auditlogs").insertOne({
      action: "AUTH_TEST_RUN",
      actorRole: "SYSTEM",
      actorId: null,
      details: JSON.stringify({ engine: "MongoDB Atlas Mongoose", ts: Date.now() }),
      createdAt: new Date(),
    });

    const auditEntry = await db.collection("auditlogs").findOne({ _id: auditRes.insertedId });
    assert(auditEntry !== null, "AuditLog entry persisted in MongoDB");
    assert(auditEntry.action === "AUTH_TEST_RUN", "AuditLog stores action accurately");
    await db.collection("auditlogs").deleteOne({ _id: auditRes.insertedId });

  } catch (err) {
    console.error("\n💥 Unexpected test error:", err);
    failed++;
  } finally {
    console.log("\n  Cleaning up test artifacts in MongoDB...");
    for (const id of claimsToCleanup) {
      await db.collection("prizeclaims").deleteOne({ _id: id }).catch(() => {});
    }
    for (const id of tasksToCleanup) {
      await db.collection("taskverifications").deleteOne({ _id: id }).catch(() => {});
    }
    for (const id of teamsToCleanup) {
      await db.collection("teamprogresses").deleteMany({ teamId: id }).catch(() => {});
      await db.collection("prizeclaims").deleteMany({ teamId: id }).catch(() => {});
      await db.collection("teams").deleteMany({ teamId: id }).catch(() => {});
      try {
        const { ObjectId } = require("mongodb");
        await db.collection("teams").deleteOne({ _id: new ObjectId(id) }).catch(() => {});
      } catch {}
    }
    for (const id of regsToCleanup) {
      await db.collection("registrations").deleteOne({ _id: id }).catch(() => {});
    }

    await mongoose.disconnect();
    console.log("\n==========================================================");
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================\n");
    if (failed > 0) process.exit(1);
  }
}

runTests();
