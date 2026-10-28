/**
 * scripts/seed-atlas.js
 *
 * Seeds the remote MongoDB Atlas cluster directly with:
 * - 10 Checkpoints & Authentic Questions
 * - Routes (Alpha, Beta, Gamma, Delta)
 * - GameConfigs & Settings
 * - Admin (`pathu` / `123`) & Volunteer (`pathu` / `1234`) accounts
 * - Team ID Pool (TEAM001 - TEAM050)
 */

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ATLAS_URI = "mongodb+srv://thulasisasidharan17_db_user:CXDsTxMlAko2G7Wv@cluster0.zrkfsz0.mongodb.net/tech_mystery_hunt?retryWrites=true&w=majority";

const QUESTIONS_DATA = [
  {
    seq: 1,
    name: "The Cryptic Server Vault",
    campusArea: "CS Department, Ground Floor Lab 1",
    locationHint: "Where fans hum loudest and fiber cables sleep beneath the cold floor tiles.",
    qrToken: "QR_TOKEN_CP01_VAULT_7X4B",
    isFinal: false,
    prompt: "Intercepted Binary Transmission from the Server Vault: [ 01001000  01000001  01000011  01001011 ]. Decode each 8-bit ASCII binary octet to reveal the 4-letter secret authorization keyword.",
    type: "TEXT",
    options: null,
    answer: "HACK",
    hint: "Convert binary octets to ASCII characters (01001000 = H...).",
  },
  {
    seq: 2,
    name: "The Silicon Junction",
    campusArea: "Electronics Wing, 1st Floor Hallway",
    locationHint: "Near the circuit diagram mural where resistance is definitely not futile.",
    qrToken: "QR_TOKEN_CP02_SILICON_3R9P",
    isFinal: false,
    prompt: "Which fundamental digital logic gate outputs HIGH (1) if and only if its two input bits are completely distinct (one input is 0 and the other input is 1)?",
    type: "MULTIPLE_CHOICE",
    options: ["AND", "OR", "XOR", "NAND"],
    answer: "XOR",
    hint: "Exclusive choice.",
  },
  {
    seq: 3,
    name: "The Algorithmic Archive",
    campusArea: "Central Library, Digital Resource Wing",
    locationHint: "Between the rows of Turing Award memoirs and bound journals from 1999.",
    qrToken: "QR_TOKEN_CP03_ARCHIVE_9K2M",
    isFinal: false,
    prompt: "What is the worst-case time complexity of the standard QuickSort algorithm when a naive pivot (such as always choosing the first or last element) is selected on an already-sorted array of n elements?",
    type: "MULTIPLE_CHOICE",
    options: ["O(n)", "O(n log n)", "O(n^2)", "O(2^n)"],
    answer: "O(n^2)",
    hint: "Quadratic degradation on already-sorted arrays.",
  },
  {
    seq: 4,
    name: "The Robotics Sandbox",
    campusArea: "Mechanical & Mechatronics Bay 3",
    locationHint: "Behind the steel safety mesh where robotic arms calibrate their PID loops.",
    qrToken: "QR_TOKEN_CP04_ROBOTICS_5W1Q",
    isFinal: false,
    prompt: "A precision robotic arm is powered by a bipolar stepper motor with a step angle of 1.8° per pulse. How many full electrical step pulses are required for the motor shaft to complete one full 360° rotation?",
    type: "NUMERIC",
    options: null,
    answer: "200",
    hint: "Divide 360 by 1.8.",
  },
  {
    seq: 5,
    name: "The Quantum Core",
    campusArea: "Physics Research Annex, Basement",
    locationHint: "Beneath the warning sign: 'Do not observe the cat unless instructed.'",
    qrToken: "QR_TOKEN_CP05_QUANTUM_8T6L",
    isFinal: false,
    prompt: "Which foundational quantum information theorem, formulated by Wootters and Zurek in 1982, states that it is mathematically impossible to create an identical copy of an arbitrary unknown quantum state?",
    type: "MULTIPLE_CHOICE",
    options: ["Superposition", "No-Cloning Theorem", "Quantum Decoherence", "Pauli Exclusion"],
    answer: "No-Cloning Theorem",
    hint: "Wootters and Zurek (1982).",
  },
  {
    seq: 6,
    name: "The Neural Nexus",
    campusArea: "AI & Innovation Incubator, 2nd Floor",
    locationHint: "Where neural networks dream in tensor flow and weights converge to zero loss.",
    qrToken: "QR_TOKEN_CP06_NEURAL_2V8Y",
    isFinal: false,
    prompt: "What is the name of the classic S-shaped neural network activation function that maps any real-valued number into a smooth probability output strictly between the open interval (0, 1)?",
    type: "TEXT",
    options: null,
    answer: "SIGMOID",
    hint: "S-shaped logistic function.",
  },
  {
    seq: 7,
    name: "The Cipher Gate",
    campusArea: "Old Clock Tower Stairs, Landing B",
    locationHint: "Look behind the bronze bell pendulum where shadow meets stone.",
    qrToken: "QR_TOKEN_CP07_CIPHER_4H7D",
    isFinal: false,
    prompt: "A secret campus signal was encrypted using a classic Caesar Cipher with a forward shift of +3: 'WHFKHVW'. Decrypt this ciphertext (shift each character backwards by 3 positions) to uncover the original word.",
    type: "TEXT",
    options: null,
    answer: "TECHFEST",
    hint: "Shift backwards by 3 letters.",
  },
  {
    seq: 8,
    name: "The Amphitheater Safe",
    campusArea: "Main Amphitheater Stage, Green Room Safe",
    locationHint: "The final coordinate! Three locked treasure boxes guarded by the TechFest Marshal.",
    qrToken: "QR_TOKEN_CP08_TREASURE_VAULT_1A9Z",
    isFinal: false,
    prompt: "Which fundamental data structure operates strictly on a Last-In, First-Out (LIFO) order, where elements are both inserted (pushed) and removed (popped) exclusively from the top?",
    type: "TEXT",
    options: null,
    answer: "STACK",
    hint: "Opposite of a Queue (FIFO).",
  },
  {
    seq: 9,
    name: "The Network Gateway",
    campusArea: "Tech Annex Server Rack B",
    locationHint: "Between the core backbone switches where green link LEDs flash in synchrony.",
    qrToken: "QR_TOKEN_CP09_NETGATE_3K7X",
    isFinal: false,
    prompt: "What official standard TCP port number is assigned by IANA for secure web communication over HTTPS (TLS / SSL)?",
    type: "NUMERIC",
    options: null,
    answer: "443",
    hint: "Standard secure web port.",
  },
  {
    seq: 10,
    name: "Grand Final Treasure Vault #10",
    campusArea: "Main Stage Vault",
    locationHint: "Central Auditorium stage vault guarded by the Chief Event Marshall.",
    qrToken: "QR_TOKEN_CP10_FINAL_VAULT_9Z2K",
    isFinal: true,
    prompt: "🏆 GRAND FINAL MILESTONE REACHED! Choose Box 1, Box 2, or Box 3 and physically present your claim token to the Chief Event Marshall at the Stage Vault to verify your victory!",
    type: "BOX_SELECTION",
    options: ["Box 1 (Titan Box)", "Box 2 (Cipher Box)", "Box 3 (Nova Box)"],
    answer: "BOX 1",
    hint: "Confer with the TechFest Box Marshal.",
  },
];

async function seed() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(ATLAS_URI);
  const db = mongoose.connection.db;

  console.log("Connected! Initializing Cloud Database collections...");

  // 1. Configs
  const configs = [
    { key: "CHECKPOINT_COUNT", value: "10" },
    { key: "GAME_STATUS", value: "WAITING" },
    { key: "REGISTRATION_OPEN", value: "true" },
    { key: "TOTAL_TREASURE_BOXES", value: "3" },
    { key: "HINT_THRESHOLD", value: "2" },
    { key: "HUNT_TITLE", value: "Tech Mystery Hunt – The Missing Code" },
    { key: "WHATSAPP_HELPLINE_NUMBER", value: "+91 98765 43210" },
  ];
  for (const c of configs) {
    await db.collection("gameconfigs").updateOne(
      { key: c.key },
      { $set: { key: c.key, value: c.value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  await db.collection("gameconfigs").deleteOne({ key: "GLOBAL_BROADCAST" });
  console.log("✓ Game configs initialized.");

  // 2. Users (Admin & Volunteer)
  const adminPass = await bcrypt.hash("123", 10);
  const volPass = await bcrypt.hash("1234", 10);

  await db.collection("users").updateOne(
    { username: "pathu" },
    {
      $set: {
        username: "pathu",
        email: "pathu@techfest.college.edu",
        name: "Grand Master Pathu",
        passwordHash: adminPass,
        role: "ADMIN",
        active: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  await db.collection("users").updateOne(
    { username: "volunteer1" },
    {
      $set: {
        username: "volunteer1",
        email: "volunteer@techfest.college.edu",
        name: "Volunteer Marshall",
        passwordHash: volPass,
        role: "VOLUNTEER",
        active: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log("✓ Admin ('pathu' / '123') and Volunteer ('pathu' / '1234') seeded.");

  // 3. Checkpoints & Questions
  const cpCol = db.collection("checkpoints");
  const qCol = db.collection("questions");

  for (const item of QUESTIONS_DATA) {
    const cp = await cpCol.findOneAndUpdate(
      { sequenceNumber: item.seq },
      {
        $set: {
          sequenceNumber: item.seq,
          name: item.name,
          campusArea: item.campusArea,
          locationHint: item.locationHint,
          qrCodeToken: item.qrToken,
          isFinalTreasure: item.isFinal,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: "after" }
    );

    const cpId = String(cp._id || cp.value?._id);
    const hash = await bcrypt.hash(item.answer.trim().toUpperCase(), 10);

    await qCol.updateOne(
      { checkpointId: cpId },
      {
        $set: {
          checkpointId: cpId,
          prompt: item.prompt,
          type: item.type,
          options: item.options ? JSON.stringify(item.options) : null,
          correctAnswerHash: hash,
          points: item.isFinal ? 500 : 100,
          hint: item.hint,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }
  console.log("✓ All 10 Checkpoints & Authentic Questions seeded in Atlas.");

  // 4. Routes (10 CP balanced sequences)
  const routes = [
    {
      name: "Route Alpha",
      description: "Staggered path starting at CS Vault and concluding at Grand Final Treasure Vault",
      sequence: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    {
      name: "Route Beta",
      description: "Inverted perimeter starting at Cipher Gate and concluding at Grand Final Treasure Vault",
      sequence: [7, 5, 3, 1, 9, 6, 4, 2, 8, 10],
    },
    {
      name: "Route Gamma",
      description: "Central loop starting at Archive and concluding at Grand Final Treasure Vault",
      sequence: [3, 1, 4, 2, 8, 7, 5, 9, 6, 10],
    },
    {
      name: "Route Delta",
      description: "High-tech path starting at Robotics Bay and concluding at Grand Final Treasure Vault",
      sequence: [4, 6, 9, 2, 5, 1, 8, 7, 3, 10],
    },
  ];
  for (const r of routes) {
    await db.collection("routes").updateOne(
      { name: r.name },
      {
        $set: {
          checkpointSequence: JSON.stringify(r.sequence),
          description: r.description,
          active: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }
  console.log("✓ Routes Alpha, Beta, Gamma, Delta seeded.");

  // 5. Team ID Pool (TEAM001 - TEAM050)
  const poolCol = db.collection("team_id_pools");
  const existingCount = await poolCol.countDocuments({});
  if (existingCount === 0) {
    const docs = [];
    for (let i = 1; i <= 50; i++) {
      docs.push({
        teamId: `TEAM${String(i).padStart(3, "0")}`,
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
    await poolCol.insertMany(docs);
    console.log("✓ Team ID Pool (TEAM001 to TEAM050) seeded.");
  } else {
    console.log(`✓ Team ID Pool already has ${existingCount} entries.`);
  }

  console.log("\n🚀 Atlas Cloud Database is 100% READY FOR LAUNCH!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Atlas seed error:", err);
  process.exit(1);
});
