/**
 * scripts/reset-game-fresh.js
 *
 * Resets the Tech Mystery Hunt database into a pristine, fresh state
 * ready for a new game:
 * - Clears all previous teams, registrations, progress, and prize claims.
 * - Resets the Team ID pool to AVAILABLE (TEAM001 onwards).
 * - Sets GAME_STATUS to "WAITING".
 * - Sets REGISTRATION_OPEN to "true".
 * - Preserves checkpoints, riddles, campus routes, and admin/volunteer accounts.
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

async function resetFresh() {
  console.log("🧹 Resetting Tech Mystery Hunt database for a fresh new game...");
  console.log(`📡 Connecting to: ${MONGODB_URI.replace(/:([^:@]+)@/, ":****@")}`);

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // 1. Clear team gameplay data
  const delTeams = await db.collection("teams").deleteMany({});
  const delRegs = await db.collection("registrations").deleteMany({});
  const delProg = await db.collection("teamprogresses").deleteMany({});
  const delClaims = await db.collection("prizeclaims").deleteMany({});
  const delTasks = await db.collection("taskverifications").deleteMany({});
  const delAudit = await db.collection("auditlogs").deleteMany({});

  console.log(`  ✓ Cleared ${delTeams.deletedCount} team(s)`);
  console.log(`  ✓ Cleared ${delRegs.deletedCount} registration(s)`);
  console.log(`  ✓ Cleared ${delProg.deletedCount} checkpoint progress record(s)`);
  console.log(`  ✓ Cleared ${delClaims.deletedCount} prize claim(s)`);
  console.log(`  ✓ Cleared ${delTasks.deletedCount} task verification(s)`);
  console.log(`  ✓ Cleared ${delAudit.deletedCount} audit log(s)`);

  // 2. Reset Team ID pool
  await db.collection("teamidpools").deleteMany({});
  await db.collection("team_id_pools").deleteMany({});

  const poolDocs = [];
  for (let i = 1; i <= 50; i++) {
    const seqStr = String(i).padStart(3, "0");
    poolDocs.push({
      teamId: `TEAM${seqStr}`,
      sequenceNumber: i,
      status: "AVAILABLE",
      assignedTeamId: null,
      assignedTeamName: null,
      assignedAt: null,
      batchTag: "INITIAL_FRESH_POOL",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await db.collection("teamidpools").insertMany(poolDocs);
  console.log("  ✓ Reset Team ID Pool with 50 fresh sequential IDs (TEAM001 to TEAM050)");

  // 3. Reset Game Configurations
  const configCol = db.collection("gameconfigs");
  await configCol.updateOne(
    { key: "GAME_STATUS" },
    { $set: { value: "WAITING", updatedAt: new Date() } },
    { upsert: true }
  );
  await configCol.updateOne(
    { key: "REGISTRATION_OPEN" },
    { $set: { value: "true", updatedAt: new Date() } },
    { upsert: true }
  );
  await configCol.updateOne(
    { key: "CHECKPOINT_COUNT" },
    { $set: { value: "8", updatedAt: new Date() } },
    { upsert: true }
  );
  console.log("  ✓ Game Status set to 'WAITING' (Teams will wait in the Waiting Room)");
  console.log("  ✓ Registration set to 'OPEN'");
  console.log("  ✓ Checkpoint Count set to 8 (7 regular checkpoints + 1 final vault)");

  // 4. Ensure dev admin & volunteer exist
  const adminHash = await bcrypt.hash("Admin#TechHunt2026", 10);
  const volunteerHash = await bcrypt.hash("Volunteer#TechHunt2026", 10);

  const userCol = db.collection("users");
  await userCol.updateOne(
    { username: "admin" },
    {
      $set: {
        username: "admin",
        email: "admin@techfest.college.edu",
        name: "Grand Master Admin",
        passwordHash: adminHash,
        role: "ADMIN",
        active: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  await userCol.updateOne(
    { username: "volunteer1" },
    {
      $set: {
        username: "volunteer1",
        email: "volunteer1@techfest.college.edu",
        name: "Box Marshall Alex",
        passwordHash: volunteerHash,
        role: "VOLUNTEER",
        active: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log("  ✓ Admin & Volunteer accounts verified ready.");

  console.log("\n🎉 DATABASE IS NOW 100% PRISTINE AND READY FOR A FRESH GAMEPLAY RUN!");
  await mongoose.disconnect();
}

resetFresh().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
