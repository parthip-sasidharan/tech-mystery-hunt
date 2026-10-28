/**
 * prisma/seed.js
 *
 * Seeds the database with:
 *   1. Default GameConfig entries.
 *   2. A default DEV admin and volunteer (DEV ONLY — detected by NODE_ENV or explicit flag).
 *      Production admin creation must use: scripts/setup-admin.js
 *   3. All checkpoints (1–10) with hashed questions.
 *   4. Default anti-crowding campus routes.
 *
 * Run:  node prisma/seed.js
 *       npm run db:seed
 */

"use strict";

require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const IS_DEV = (process.env.NODE_ENV || "development") !== "production";

async function main() {
  console.log("🌱 Seeding Tech Mystery Hunt database...");
  if (!IS_DEV) {
    console.warn(
      "⚠️  Running seed in non-development mode. Default dev credentials will NOT be created.\n" +
      "   Run `ADMIN_SETUP_PASSWORD=... node scripts/setup-admin.js` to bootstrap the admin account."
    );
  }

  // ── 1. System Configs ─────────────────────────────────────────────────────
  const configs = [
    { key: "CHECKPOINT_COUNT",     value: process.env.DEFAULT_CHECKPOINT_COUNT || "8", description: "Total checkpoints (8 or 10)" },
    { key: "GAME_STATUS",          value: "WAITING",       description: "Hunt state: WAITING|ACTIVE|PAUSED|CONCLUDED" },
    { key: "REGISTRATION_OPEN",    value: "true",           description: "Team self-registration toggle" },
    { key: "TOTAL_TREASURE_BOXES", value: process.env.TOTAL_TREASURE_BOXES || "3",     description: "Number of physical prize boxes" },
    { key: "HINT_THRESHOLD",       value: process.env.HINT_THRESHOLD || "2",           description: "Wrong attempts before hint unlocks" },
    { key: "HUNT_TITLE",           value: "Tech Mystery Hunt – The Missing Code",       description: "Official event name" },
  ];

  for (const c of configs) {
    await prisma.gameConfig.upsert({
      where:  { key: c.key },
      update: { description: c.description },  // Don't overwrite organiser's live values
      create: c,
    });
  }
  console.log("  ✓ GameConfig entries seeded.");

  // ── 2. Dev-only default accounts ──────────────────────────────────────────
  if (IS_DEV) {
    const DEV_ADMIN_PW     = "Admin#TechHunt2026";
    const DEV_VOLUNTEER_PW = "Volunteer#TechHunt2026";

    const adminHash     = await bcrypt.hash(DEV_ADMIN_PW, 10);
    const volunteerHash = await bcrypt.hash(DEV_VOLUNTEER_PW, 10);

    const admin = await prisma.user.upsert({
      where:  { username: "admin" },
      update: { passwordHash: adminHash, role: "ADMIN", active: true },
      create: {
        username:     "admin",
        email:        "admin@techfest.college.edu",
        name:         "Grand Master Admin",
        passwordHash: adminHash,
        role:         "ADMIN",
        active:       true,
      },
    });

    const volunteer = await prisma.user.upsert({
      where:  { username: "volunteer1" },
      update: { passwordHash: volunteerHash, role: "VOLUNTEER", active: true },
      create: {
        username:     "volunteer1",
        email:        "volunteer1@techfest.college.edu",
        name:         "Box Marshall Alex",
        passwordHash: volunteerHash,
        role:         "VOLUNTEER",
        active:       true,
      },
    });

    console.log(
      `  ✓ DEV accounts seeded: admin (${admin.username}) | volunteer (${volunteer.username}).`
    );
    console.log("    ⚠️  These credentials are for local development ONLY. Use setup-admin.js in production.");
  }

  // ── 3. Checkpoints 1–10 with hashed answers ───────────────────────────────
  const checkpointDefinitions = [
    {
      sequenceNumber: 1,
      name: "The Cryptic Server Vault",
      campusArea: "CS Department, Ground Floor Lab 1",
      locationHint: "Where fans hum loudest and fiber cables sleep beneath the cold floor tiles.",
      qrCodeToken: "QR_TOKEN_CP01_VAULT_7X4B",
      isFinalTreasure: false,
      question: {
        prompt: "Decode this message: '01001000 01000001 01000011 01001011'. What 4-letter English word is it?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "HACK",
        points: 100,
        hint: "Convert binary octets to ASCII characters.",
      },
    },
    {
      sequenceNumber: 2,
      name: "The Silicon Junction",
      campusArea: "Electronics Wing, 1st Floor Hallway",
      locationHint: "Near the circuit diagram mural where resistance is definitely not futile.",
      qrCodeToken: "QR_TOKEN_CP02_SILICON_3R9P",
      isFinalTreasure: false,
      question: {
        prompt: "Which logic gate outputs 1 only when its two input bits are completely distinct?",
        type: "MULTIPLE_CHOICE",
        options: JSON.stringify(["AND", "OR", "XOR", "NAND"]),
        correctAnswer: "XOR",
        points: 100,
        hint: "Exclusive choice.",
      },
    },
    {
      sequenceNumber: 3,
      name: "The Algorithmic Archive",
      campusArea: "Central Library, Digital Resource Wing",
      locationHint: "Between the rows of Turing Award memoirs and bound journals from 1999.",
      qrCodeToken: "QR_TOKEN_CP03_ARCHIVE_9K2M",
      isFinalTreasure: false,
      question: {
        prompt: "What is the worst-case time complexity of QuickSort with a naive pivot?",
        type: "MULTIPLE_CHOICE",
        options: JSON.stringify(["O(n)", "O(n log n)", "O(n^2)", "O(2^n)"]),
        correctAnswer: "O(n^2)",
        points: 100,
        hint: "Quadratic degradation on already-sorted arrays.",
      },
    },
    {
      sequenceNumber: 4,
      name: "The Robotics Sandbox",
      campusArea: "Mechanical & Mechatronics Bay 3",
      locationHint: "Behind the steel safety mesh where robotic arms calibrate their PID loops.",
      qrCodeToken: "QR_TOKEN_CP04_ROBOTICS_5W1Q",
      isFinalTreasure: false,
      question: {
        prompt: "A stepper motor has a step angle of 1.8°. How many full steps are needed for one complete 360° rotation?",
        type: "NUMERIC",
        options: null,
        correctAnswer: "200",
        points: 100,
        hint: "Divide 360 by 1.8.",
      },
    },
    {
      sequenceNumber: 5,
      name: "The Quantum Core",
      campusArea: "Physics Research Annex, Basement",
      locationHint: "Beneath the warning sign: 'Do not observe the cat unless instructed.'",
      qrCodeToken: "QR_TOKEN_CP05_QUANTUM_8T6L",
      isFinalTreasure: false,
      question: {
        prompt: "Which theorem states that an arbitrary unknown quantum state cannot be perfectly copied?",
        type: "MULTIPLE_CHOICE",
        options: JSON.stringify(["Superposition", "No-Cloning Theorem", "Quantum Decoherence", "Pauli Exclusion"]),
        correctAnswer: "No-Cloning Theorem",
        points: 100,
        hint: "Wootters and Zurek (1982).",
      },
    },
    {
      sequenceNumber: 6,
      name: "The Neural Nexus",
      campusArea: "AI & Innovation Incubator, 2nd Floor",
      locationHint: "Where neural networks dream in tensor flow and weights converge to zero loss.",
      qrCodeToken: "QR_TOKEN_CP06_NEURAL_2V8Y",
      isFinalTreasure: false,
      question: {
        prompt: "What activation function maps real numbers strictly into the open interval (0, 1)?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "SIGMOID",
        points: 100,
        hint: "S-shaped logistic function.",
      },
    },
    {
      sequenceNumber: 7,
      name: "The Cipher Gate",
      campusArea: "Old Clock Tower Stairs, Landing B",
      locationHint: "Look behind the bronze bell pendulum where shadow meets stone.",
      qrCodeToken: "QR_TOKEN_CP07_CIPHER_4H7D",
      isFinalTreasure: false,
      question: {
        prompt: "Decrypt this Caesar Cipher (shift +3): 'WHFKHVW'. What is the original word?",
        type: "TEXT_CODE",
        options: null,
        correctAnswer: "TECHFEST",
        points: 100,
        hint: "Shift backwards by 3 letters.",
      },
    },
    {
      sequenceNumber: 8,
      name: "The Vault of the Three Boxes (8-CP Final Treasure)",
      campusArea: "Main Amphitheater Stage, Green Room Safe",
      locationHint: "The final coordinate! Three locked treasure boxes guarded by the TechFest Marshal.",
      qrCodeToken: "QR_TOKEN_CP08_TREASURE_VAULT_1A9Z",
      isFinalTreasure: true,
      question: {
        prompt: "You have arrived at the Treasure Vault! Choose Box 1, Box 2, or Box 3 and present your claim code to the Marshal.",
        type: "BOX_SELECTION",
        options: JSON.stringify(["Box 1 (Titan Box)", "Box 2 (Cipher Box)", "Box 3 (Nova Box)"]),
        correctAnswer: "TREASURE_CLAIM",
        points: 500,
        hint: "Select a box and obtain physical verification.",
      },
    },
    {
      sequenceNumber: 9,
      name: "The Radio Telemetry Station",
      campusArea: "Rooftop Observatory Tower",
      locationHint: "Beneath the parabolic dish pointed toward geostationary coordinates.",
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
      name: "The Grand Singularity (10-CP Final Treasure)",
      campusArea: "Main Auditorium Grand Foyer",
      locationHint: "The supreme 10-checkpoint culmination point guarding the three physical boxes.",
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

  for (const cpDef of checkpointDefinitions) {
    const existing = await prisma.checkpoint.findUnique({
      where: { sequenceNumber: cpDef.sequenceNumber },
    });

    const cp = existing
      ? await prisma.checkpoint.update({
          where: { id: existing.id },
          data: {
            name:            cpDef.name,
            campusArea:      cpDef.campusArea,
            locationHint:    cpDef.locationHint,
            qrCodeToken:     cpDef.qrCodeToken,
            isFinalTreasure: cpDef.isFinalTreasure,
          },
        })
      : await prisma.checkpoint.create({
          data: {
            sequenceNumber:  cpDef.sequenceNumber,
            name:            cpDef.name,
            campusArea:      cpDef.campusArea,
            locationHint:    cpDef.locationHint,
            qrCodeToken:     cpDef.qrCodeToken,
            isFinalTreasure: cpDef.isFinalTreasure,
          },
        });

    // Hash the correct answer with bcrypt (never stored plaintext)
    const answerHash = await bcrypt.hash(cpDef.question.correctAnswer.trim().toUpperCase(), 8);

    await prisma.question.deleteMany({ where: { checkpointId: cp.id } });
    await prisma.question.create({
      data: {
        checkpointId:      cp.id,
        prompt:            cpDef.question.prompt,
        type:              cpDef.question.type,
        options:           cpDef.question.options,
        correctAnswerHash: answerHash,
        points:            cpDef.question.points,
        hint:              cpDef.question.hint,
      },
    });
  }
  console.log("  ✓ Checkpoints 1–10 seeded with bcrypt-hashed answers.");

  // ── 4. Anti-Crowding Campus Routes ────────────────────────────────────────
  const routesData = [
    { name: "Route Alpha", description: "Staggered path starting at CS Vault",       sequence: [1, 2, 3, 4, 5, 6, 7, 8] },
    { name: "Route Beta",  description: "Inverted perimeter starting at Cipher Gate", sequence: [7, 5, 3, 1, 6, 4, 2, 8] },
    { name: "Route Gamma", description: "Central loop starting at Archive",           sequence: [3, 1, 4, 2, 7, 5, 6, 8] },
    { name: "Route Delta", description: "High-tech path starting at Robotics Bay",    sequence: [4, 6, 2, 5, 1, 7, 3, 8] },
  ];

  for (const r of routesData) {
    await prisma.route.upsert({
      where:  { name: r.name },
      update: { description: r.description, checkpointSequence: JSON.stringify(r.sequence), active: true },
      create: { name: r.name, description: r.description, checkpointSequence: JSON.stringify(r.sequence), active: true },
    });
  }
  console.log("  ✓ Campus routes seeded (Alpha, Beta, Gamma, Delta).");

  console.log("\n🏁 Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
