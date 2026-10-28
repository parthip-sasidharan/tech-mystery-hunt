const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const uri = "mongodb+srv://thulasisasidharan17_db_user:CXDsTxMlAko2G7Wv@cluster0.zrkfsz0.mongodb.net/tech_mystery_hunt?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash("123", 10);
  await db.collection("users").updateOne(
    { username: "admin" },
    {
      $set: {
        username: "admin",
        email: "admin@techfest.college.edu",
        name: "Grand Master Admin",
        passwordHash: hash,
        role: "ADMIN",
        active: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // Also make sure volunteer is updated with '1234'
  const volHash = await bcrypt.hash("1234", 10);
  await db.collection("users").updateOne(
    { username: "volunteer" },
    {
      $set: {
        username: "volunteer",
        email: "volunteer@techfest.college.edu",
        name: "Event Volunteer",
        passwordHash: volHash,
        role: "VOLUNTEER",
        active: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log("✓ Added admin and volunteer credentials into MongoDB Atlas!");
  process.exit(0);
}

main().catch(console.error);
