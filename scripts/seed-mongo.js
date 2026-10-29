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
        prompt: "Intercepted Binary Transmission from the Server Vault: [ 01001000  01000001  01000011  01001011 ]. Decode each 8-bit ASCII binary octet to reveal the 4-letter secret authorization keyword.",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "HACK",
        points: 100,
        hint: "Convert binary octets to ASCII characters.",
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
        prompt: "Which fundamental digital logic gate outputs HIGH (1) if and only if its two input bits are completely distinct (one input is 0 and the other input is 1)?",
        type: "MULTIPLE_CHOICE",
        options: JSON.stringify(["AND", "OR", "XOR", "NAND"]),
        correctAnswer: "XOR",
        points: 100,
        hint: "Exclusive choice.",
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
        prompt: "What is the worst-case time complexity of the standard QuickSort algorithm when a naive pivot (such as always choosing the first or last element) is selected on an already-sorted array of n elements?",
        type: "MULTIPLE_CHOICE",
        options: JSON.stringify(["O(n)", "O(n log n)", "O(n^2)", "O(2^n)"]),
        correctAnswer: "O(n^2)",
        points: 100,
        hint: "Quadratic degradation on already-sorted arrays.",
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
        prompt: "A precision robotic arm is powered by a bipolar stepper motor with a step angle of 1.8° per pulse. How many full electrical step pulses are required for the motor shaft to complete one full 360° rotation?",
        type: "NUMERIC",
        options: null,
        correctAnswer: "200",
        points: 100,
        hint: "Divide 360 by 1.8.",
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
        prompt: "Which foundational quantum information theorem, formulated by Wootters and Zurek in 1982, states that it is mathematically impossible to create an identical copy of an arbitrary unknown quantum state?",
        type: "MULTIPLE_CHOICE",
        options: JSON.stringify(["Superposition", "No-Cloning Theorem", "Quantum Decoherence", "Pauli Exclusion"]),
        correctAnswer: "No-Cloning Theorem",
        points: 100,
        hint: "Wootters and Zurek (1982).",
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
        prompt: "What is the name of the classic S-shaped neural network activation function that maps any real-valued number into a smooth probability output strictly between the open interval (0, 1)?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "SIGMOID",
        points: 100,
        hint: "S-shaped logistic function.",
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
        prompt: "A secret campus signal was encrypted using a classic Caesar Cipher with a forward shift of +3: 'WHFKHVW'. Decrypt this ciphertext (shift each character backwards by 3 positions) to uncover the original word.",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "TECHFEST",
        points: 100,
        hint: "Shift backwards by 3 letters.",
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
        prompt: "Which fundamental data structure operates strictly on a Last-In, First-Out (LIFO) order, where elements are both inserted (pushed) and removed (popped) exclusively from the top?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "STACK",
        points: 100,
        hint: "Think of push and pop operations, opposite of a FIFO Queue.",
      },
    },
    {
      sequenceNumber: 9,
      name: "Medicinal Garden",
      campusArea: "Campus Herbal & Medicinal Garden",
      locationHint: "My residents possess identities older than the institutions that study them, yet most pass unnoticed by those who cannot interpret their language. Their knowledge is neither written nor spoken, and their greatest secret is that the boundary between remedy and ordinary existence depends on the observer.",
      qrCodeToken: "QR_TOKEN_CP09_RADIO_6E3F",
      isFinalTreasure: false,
      question: {
        prompt: "What standard port number is assigned by IANA for secure HTTPS communications?",
        type: "NUMERIC",
        options: null,
        correctAnswer: "443",
        points: 100,
        hint: "Common web security port.",
      },
    },
    {
      sequenceNumber: 10,
      name: "Grand Final Treasure Vault",
      campusArea: "Main Stage Vault / Auditorium",
      locationHint: "🏆 GRAND FINAL TREASURE VAULT: The ultimate culmination point! Locate the buried/guarded treasure box coordinates and verify your physical victory with the Chief Event Marshall!",
      qrCodeToken: "QR_TOKEN_CP10_SINGULARITY_9Z0K",
      isFinalTreasure: true,
      question: {
        prompt: "Ultimate milestone reached. Choose Box 1, Box 2, or Box 3 and present your physical token.",
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
    const answerHash = await bcrypt.hash(cpDef.question.correctAnswer.trim().toUpperCase(), 8);

    await qCol.deleteMany({ checkpointId: cpId });
    await qCol.insertOne({
      checkpointId: cpId,
      prompt: cpDef.question.prompt,
      type: cpDef.question.type,
      options: cpDef.question.options,
      correctAnswerHash: answerHash,
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
