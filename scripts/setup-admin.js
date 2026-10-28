/**
 * scripts/setup-admin.js
 *
 * One-time secure admin bootstrap script using MongoDB Atlas / Mongoose.
 *
 * Usage:
 *   ADMIN_SETUP_PASSWORD="YourStrongPassword" node scripts/setup-admin.js
 *   (or in PowerShell: $env:ADMIN_SETUP_PASSWORD="YourStrongPassword"; npm run setup:admin)
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

const REQUIRED = {
  ADMIN_SETUP_PASSWORD: process.env.ADMIN_SETUP_PASSWORD,
  ADMIN_SETUP_USERNAME: process.env.ADMIN_SETUP_USERNAME,
  ADMIN_SETUP_EMAIL:    process.env.ADMIN_SETUP_EMAIL,
  ADMIN_SETUP_NAME:     process.env.ADMIN_SETUP_NAME,
  JWT_SECRET:           process.env.JWT_SECRET,
};

const missing = Object.entries(REQUIRED)
  .filter(([, v]) => !v || v.trim() === "")
  .map(([k]) => k);

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:", missing.join(", "));
  console.error(
    "\nSet them in your .env file (except ADMIN_SETUP_PASSWORD which must be\n" +
    "passed inline to avoid shell history leakage):\n" +
    "  $env:ADMIN_SETUP_PASSWORD=\"YourStrongPass\"; npm run setup:admin"
  );
  process.exit(1);
}

const password = REQUIRED.ADMIN_SETUP_PASSWORD.trim();
if (password.length < 12) {
  console.error("❌ ADMIN_SETUP_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

async function main() {
  console.log("🔐 Tech Mystery Hunt – Secure MongoDB Admin Bootstrap\n");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const username = REQUIRED.ADMIN_SETUP_USERNAME.trim().toLowerCase();
  const email    = REQUIRED.ADMIN_SETUP_EMAIL.trim().toLowerCase();
  const name     = REQUIRED.ADMIN_SETUP_NAME.trim();

  const userCol = db.collection("users");

  // 1. Check for any existing admin
  const existingAdmin = await userCol.findOne({ role: "ADMIN" });
  if (existingAdmin) {
    console.log(`✓ Admin account already exists in MongoDB (username: ${existingAdmin.username}).`);
    console.log("  No changes made. Remove the existing admin first if you need to reset.");
    return;
  }

  // 2. Check for username / email collision
  const collision = await userCol.findOne({ $or: [{ username }, { email }] });
  if (collision) {
    console.error(`❌ A user with username "${username}" or email "${email}" already exists.`);
    process.exit(1);
  }

  // 3. Hash password
  const passwordHash = await bcrypt.hash(password, 12); // cost=12 for admin accounts

  // 4. Create admin
  const insertResult = await userCol.insertOne({
    username,
    email,
    name,
    passwordHash,
    role: "ADMIN",
    active: true,
    assignedCheckpointId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`✓ Admin account created successfully in MongoDB.`);
  console.log(`  Username : ${username}`);
  console.log(`  Email    : ${email}`);
  console.log(`  Role     : ADMIN`);
  console.log(`  ID       : ${insertResult.insertedId}`);

  // 5. Seed default GameConfig entries if missing
  const configCol = db.collection("gameconfigs");
  const defaults = [
    { key: "CHECKPOINT_COUNT",     value: process.env.DEFAULT_CHECKPOINT_COUNT || "8",  description: "Total configured checkpoints (8 or 10)" },
    { key: "GAME_STATUS",          value: "WAITING",       description: "Hunt state: WAITING | ACTIVE | PAUSED | CONCLUDED" },
    { key: "REGISTRATION_OPEN",    value: "true",           description: "Whether team self-registration is open" },
    { key: "TOTAL_TREASURE_BOXES", value: process.env.TOTAL_TREASURE_BOXES || "3", description: "Number of physical prize boxes" },
    { key: "HINT_THRESHOLD",       value: process.env.HINT_THRESHOLD || "2",        description: "Wrong attempts before hint unlocks" },
    { key: "HUNT_TITLE",           value: "Tech Mystery Hunt – The Missing Code",   description: "Official event name" },
  ];

  for (const cfg of defaults) {
    await configCol.updateOne(
      { key: cfg.key },
      { $setOnInsert: { key: cfg.key, value: cfg.value, description: cfg.description, createdAt: new Date() }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log("\n✓ Default GameConfig entries ensured in MongoDB.");

  // 6. Audit log
  const auditCol = db.collection("auditlogs");
  await auditCol.insertOne({
    action: "ADMIN_BOOTSTRAP",
    actorRole: "SYSTEM",
    actorId: String(insertResult.insertedId),
    details: JSON.stringify({ username, email, triggeredBy: "setup-admin.js" }),
    createdAt: new Date(),
  });

  console.log("\n✅ Setup complete. You can now log in at /login with your admin credentials.");
}

main()
  .catch((err) => {
    console.error("❌ Setup failed:", err.message || err);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
