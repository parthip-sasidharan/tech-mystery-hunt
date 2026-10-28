/**
 * scripts/change-admin-password.js
 *
 * Operational utility to securely change the Grand Master Admin password.
 * Usage: node scripts/change-admin-password.js <newPassword>
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

async function main() {
  const newPassword = process.argv[2];

  if (!newPassword) {
    console.error("Usage: node scripts/change-admin-password.js <newPassword>");
    process.exit(1);
  }

  if (newPassword.length < 10) {
    console.error("Error: New password must be at least 10 characters long.");
    process.exit(1);
  }

  if (newPassword === "Admin#TechHunt2026") {
    console.error("Error: New password cannot be the default development placeholder.");
    process.exit(1);
  }

  console.log("📡 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  const userCol = db.collection("users");

  const admin = await userCol.findOne({ username: "admin", role: "ADMIN" });
  if (!admin) {
    console.error("Error: Admin user 'admin' not found in MongoDB.");
    process.exit(1);
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await userCol.updateOne(
    { _id: admin._id },
    { $set: { passwordHash: newHash, updatedAt: new Date() } }
  );

  const auditCol = db.collection("auditlogs");
  await auditCol.insertOne({
    action: "ADMIN_PASSWORD_CHANGED_CLI",
    actorRole: "ADMIN",
    actorId: String(admin._id),
    details: JSON.stringify({ username: "admin", updatedAt: new Date() }),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("✓ Grand Master Admin password successfully updated in MongoDB.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
