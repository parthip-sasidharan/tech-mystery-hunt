/**
 * scripts/seed-mongo.js
 *
 * Seeds MongoDB Atlas / local MongoDB directly using Mongoose models.
 * Preserves all questions, checkpoints (1-10), routes, gameconfigs, and dev users.
 */

"use strict";

require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

async function main() {
  console.log("🌱 Seeding MongoDB database...");
  console.log(`📡 Connecting to: ${MONGODB_URI.replace(/:([^:@]+)@/, ":****@")}`);

  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB.");

  const db = mongoose.connection.db;

  // 1. System Configs
  const configs = [
    { key: "CHECKPOINT_COUNT", value: process.env.DEFAULT_CHECKPOINT_COUNT || "8", description: "Total checkpoints (8 or 10)" },
    { key: "GAME_STATUS", value: "WAITING", description: "Hunt state: WAITING|ACTIVE|PAUSED|CONCLUDED" },
    { key: "REGISTRATION_OPEN", value: "true", description: "Team self-registration toggle" },
    { key: "TOTAL_TREASURE_BOXES", value: process.env.TOTAL_TREASURE_BOXES || "3", description: "Number of physical prize boxes" },
    { key: "HINT_THRESHOLD", value: process.env.HINT_THRESHOLD || "2", description: "Wrong attempts before hint unlocks" },
    { key: "HUNT_TITLE", value: "Tech Mystery Hunt – The Missing Code", description: "Official event name" },
  ];

  const configCol = db.collection("gameconfigs");
  for (const c of configs) {
    await configCol.updateOne(
      { key: c.key },
      { $setOnInsert: { key: c.key, value: c.value, description: c.description, createdAt: new Date() }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log("  ✓ GameConfig entries seeded in MongoDB.");

  // 2. Dev Users
  const isDev = (process.env.NODE_ENV || "development") !== "production";
  if (isDev) {
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

    console.log("  ✓ Dev accounts verified in MongoDB: admin | volunteer1.");
  }

  // 3. Checkpoints 1-10 & Questions
  const checkpointDefinitions = [
    {
      sequenceNumber: 1,
      name: "Nadumuttam",
      campusArea: "Central Courtyard (Nadumuttam)",
      locationHint: "I am the architectural consequence of a decision to leave something unfinished, yet without me the whole would lose its identity. My boundaries are tangible, but my defining feature cannot be touched; look for the place whose most important component is the one no builder installed.",
      qrCodeToken: "QR_TOKEN_CP01_VAULT_7X4B",
      isFinalTreasure: false,
      question: {
        prompt: "WHO IS HOD OF DEPT OF COMPUTER APPLICATIONS?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "DR SANDHYA R|DR. SANDHYA R|DR SANDHYA|SANDHYA R|SANDHYA",
        points: 100,
        hint: "HOD, Dept of Computer Applications (MCA).",
      },
    },
    {
      sequenceNumber: 2,
      name: "College Store",
      campusArea: "Student Co-operative Store",
      locationHint: "My relevance expires without my existence becoming meaningless, and my value can decline while my contents remain unchanged. I facilitate an exchange in which the receiver may possess the means long before acquiring the ability, and the transaction is completed before its true outcome can be measured.",
      qrCodeToken: "QR_TOKEN_CP02_SILICON_3R9P",
      isFinalTreasure: false,
      question: {
        prompt: "WHICH BRAND GENERATOR IS USED IN SNGCE?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "KOHLER",
        points: 100,
        hint: "Check the generator manufacturer / brand plate.",
      },
    },
    {
      sequenceNumber: 3,
      name: "Mech Lab",
      campusArea: "Mechanical Engineering Lab Block",
      locationHint: "I am a school in which matter is questioned until its behaviour confesses. My language has no alphabet, yet every answer can be measured; here, equilibrium is a temporary agreement, motion is evidence, and resistance is not an enemy but the subject under investigation.",
      qrCodeToken: "QR_TOKEN_CP03_ARCHIVE_9K2M",
      isFinalTreasure: false,
      question: {
        prompt: "NUMBER OF PLACEMENTS IN 2025-2026 PLACEMENT POSTER?",
        type: "NUMERIC",
        options: null,
        correctAnswer: "121",
        points: 100,
        hint: "Refer to the official 2025-2026 campus placement poster milestone.",
      },
    },
    {
      sequenceNumber: 4,
      name: "Main Gate",
      campusArea: "Campus Main Entrance Gate",
      locationHint: "I have a mouth but never eat, two arms but no hands, and I open without speaking. What am I?",
      qrCodeToken: "QR_TOKEN_CP04_ROBOTICS_5W1Q",
      isFinalTreasure: false,
      question: {
        prompt: "NAME OF THE BIGGEST MISSILE IN MAIN ENTRANCE?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "BRAHMOS|BRAHMOS MISSILE",
        points: 100,
        hint: "The supersonic cruise missile model displayed near the main entrance.",
      },
    },
    {
      sequenceNumber: 5,
      name: "Generator Room",
      campusArea: "Power Substation & Generator Yard",
      locationHint: "I become important when something whose presence is usually unquestioned suddenly disappears, and my greatest achievement is making an extraordinary failure appear almost ordinary. Who am I?",
      qrCodeToken: "QR_TOKEN_CP05_QUANTUM_8T6L",
      isFinalTreasure: false,
      question: {
        prompt: "WHAT IS THE REGISTRATION NUMBER OF BUS NUMBER 1?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "KL 40 E 6327|KL40E6327|KL 40E 6327|KL-40-E-6327",
        points: 100,
        hint: "Registration format: KL 40 E 6327.",
      },
    },
    {
      sequenceNumber: 6,
      name: "Fugeniz Kambi",
      campusArea: "Fugeniz Fest Yard / Main Pillar (Kambi)",
      locationHint: "I have a spine but no bones, stand tall but never walk, and wear rust without wearing clothes. What am I? (Hint: Fe2O3 · xH2O)",
      qrCodeToken: "QR_TOKEN_CP06_NEURAL_2V8Y",
      isFinalTreasure: false,
      question: {
        prompt: "WHAT IS THE NAME MENTIONED IN THE WALL OPPOSITE THE STORE?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "ARANGU|അരങ്ങ്|ARANGU(MALAYALAM)|ARANGU (MALAYALAM)|ARANGU MALAYALAM",
        points: 100,
        hint: "Cultural stage name painted on the opposite wall (Arangu / അരങ്ങ്).",
      },
    },
    {
      sequenceNumber: 7,
      name: "5th Floor MCB",
      campusArea: "5th Floor Electrical Distribution Board (MCB)",
      locationHint: "5 ↑ + FLOW − CONTINUITY = SAFETY\nThe number is not a quantity of guardians, and the interruption is not a mistake. Find the place reached after interpreting the number as a vertical instruction, where protection may require a system to stop.",
      qrCodeToken: "QR_TOKEN_CP07_CIPHER_4H7D",
      isFinalTreasure: false,
      question: {
        prompt: "NUMBER OF FANS IN SNGCE MAIN CANTEEN?",
        type: "NUMERIC",
        options: null,
        correctAnswer: "20|TWENTY",
        points: 100,
        hint: "Count the total ceiling fans installed across the main dining area.",
      },
    },
    {
      sequenceNumber: 8,
      name: "Central Library",
      campusArea: "Campus Central Library",
      locationHint: "I am a place where strangers whisper across centuries without ever meeting, where dead thinkers outlive their bodies, what place punishes the voice but rewards the curious, and holds more conversations when nobody speaks?",
      qrCodeToken: "QR_TOKEN_CP08_TREASURE_VAULT_1A9Z",
      isFinalTreasure: false,
      question: {
        prompt: "NAME OF SNGCE DOCTOR?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "DR T M SREEDEVI|DR. T M SREEDEVI|DR TM SREEDEVI|DR. T. M. SREEDEVI|T M SREEDEVI|DR SREEDEVI|SREEDEVI",
        points: 100,
        hint: "Campus Medical Officer / Doctor.",
      },
    },
    {
      sequenceNumber: 9,
      name: "Service Center",
      campusArea: "Campus Service & Maintenance Center",
      locationHint: "Where does failure become a question instead of a conclusion, and where can something declared useless regain its former purpose?",
      qrCodeToken: "QR_TOKEN_CP09_RADIO_6E3F",
      isFinalTreasure: false,
      question: {
        prompt: "NO OF STEPS IN PG BLOCK ENTRANCE?",
        type: "NUMERIC",
        options: null,
        correctAnswer: "11|ELEVEN",
        points: 100,
        hint: "Count the steps leading up to the PG Block entrance.",
      },
    },
    {
      sequenceNumber: 10,
      name: "Medicinal Garden",
      campusArea: "Campus Herbal & Medicinal Garden (Final Treasure Vault)",
      locationHint: "My residents possess identities older than the institutions that study them, yet most pass unnoticed by those who cannot interpret their language. Their knowledge is neither written nor spoken, and their greatest secret is that the boundary between remedy and ordinary existence depends on the observer.",
      qrCodeToken: "QR_TOKEN_CP10_SINGULARITY_9Z0K",
      isFinalTreasure: true,
      question: {
        prompt: "Ultimate milestone reached. Choose Box 1, Box 2, or Box 3 and present your physical token to the Box Marshal.",
        type: "BOX_SELECTION",
        options: JSON.stringify(["Box 1 (Titan Box)", "Box 2 (Cipher Box)", "Box 3 (Nova Box)"]),
        correctAnswer: "TREASURE_CLAIM",
        points: 500,
        hint: "Confer with the TechFest Box Marshal.",
      },
    },
  ];

  const cpCol = db.collection("checkpoints");
  const qCol = db.collection("questions");

  for (const cpDef of checkpointDefinitions) {
    const cpRes = await cpCol.findOneAndUpdate(
      { sequenceNumber: cpDef.sequenceNumber },
      {
        $set: {
          sequenceNumber: cpDef.sequenceNumber,
          name: cpDef.name,
          campusArea: cpDef.campusArea,
          locationHint: cpDef.locationHint,
          qrCodeToken: cpDef.qrCodeToken,
          isFinalTreasure: cpDef.isFinalTreasure,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: "after" }
    );

    const cpId = String(cpRes._id || cpRes.value?._id);

    await qCol.deleteMany({ checkpointId: cpId });
    await qCol.insertOne({
      checkpointId: cpId,
      prompt: cpDef.question.prompt,
      type: cpDef.question.type,
      options: cpDef.question.options,
      correctAnswerHash: cpDef.question.correctAnswer.trim().toUpperCase(),
      points: cpDef.question.points,
      hint: cpDef.question.hint,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  console.log("  ✓ Checkpoints 1–10 and hashed questions seeded in MongoDB.");

  // 4. Routes
  const routesData = [
    { name: "Route Alpha", description: "Staggered path starting at CS Vault", sequence: [1, 2, 3, 4, 5, 6, 7, 8] },
    { name: "Route Beta", description: "Inverted perimeter starting at Cipher Gate", sequence: [7, 5, 3, 1, 6, 4, 2, 8] },
    { name: "Route Gamma", description: "Central loop starting at Archive", sequence: [3, 1, 4, 2, 7, 5, 6, 8] },
    { name: "Route Delta", description: "High-tech path starting at Robotics Bay", sequence: [4, 6, 2, 5, 1, 7, 3, 8] },
  ];

  const routeCol = db.collection("routes");
  for (const r of routesData) {
    await routeCol.updateOne(
      { name: r.name },
      {
        $set: {
          name: r.name,
          description: r.description,
          checkpointSequence: JSON.stringify(r.sequence),
          active: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }
  console.log("  ✓ Routes seeded in MongoDB.");

  // 5. Indexes for Collections
  const poolCol = db.collection("team_id_pools");
  await poolCol.createIndex({ teamId: 1 }, { unique: true });
  await poolCol.createIndex({ sequenceNumber: 1 }, { unique: true });
  await poolCol.createIndex({ status: 1, sequenceNumber: 1 });

  const teamsCol = db.collection("teams");
  await teamsCol.createIndex({ teamId: 1 }, { unique: true });
  await teamsCol.createIndex({ name: 1 }, { unique: true });
  await teamsCol.createIndex({ leaderEmail: 1 }, { unique: true });

  const regCol = db.collection("registrations");
  await regCol.createIndex({ teamName: 1 }, { unique: true });
  await regCol.createIndex({ leaderEmail: 1 }, { unique: true });
  await regCol.createIndex({ status: 1 });

  const claimCol = db.collection("prizeclaims");
  await claimCol.createIndex(
    { boxNumber: 1 },
    { unique: true, partialFilterExpression: { status: "CONFIRMED" } }
  );
  await claimCol.createIndex(
    { teamId: 1 },
    { unique: true, partialFilterExpression: { status: "CONFIRMED" } }
  );

  console.log("  ✓ Unique indexes verified for TeamIdPool, Teams, Registrations, and PrizeClaims.");
  console.log("\n🏁 MongoDB seed complete!");
}

main()
  .catch((e) => {
    console.error("MongoDB seeding error:", e);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
