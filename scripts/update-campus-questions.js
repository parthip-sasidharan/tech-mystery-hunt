/**
 * scripts/update-campus-questions.js
 *
 * Synchronizes authentic SNGCE campus questions and answers into MongoDB Atlas and Local MongoDB:
 * 1. WHO IS HOD OF DEPT OF COMPUTER APPLICATIONS? -> DR SANDHYA R
 * 2. WHICH BRAND GENERATOR IS USED IN SNGCE? -> KOHLER
 * 3. NUMBER OF PLACEMENTS IN 2025-2026 PLACEMENT POSTER? -> 121
 * 4. NAME OF THE BIGGEST MISSILE IN MAIN ENTRANCE? -> BRAHMOS
 * 5. WHAT IS THE REGISTRATION NUMBER OF BUS NUMBER 1? -> KL 40 E 6327
 * 6. WHAT IS THE NAME MENTIONED IN THE WALL OPPOSITE THE STORE? -> ARANGU(MALAYALAM)
 * 7. NUMBER OF FANS IN SNGCE MAIN CANTEEN? -> 20
 * 8. NAME OF SNGCE DOCTOR? -> DR T M SREEDEVI
 * 9. NO OF STEPS IN PG BLOCK ENTRANCE? -> 11
 * 10. GRAND FINAL TREASURE VAULT -> Box Selection & Claim Code
 */

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

const QUESTIONS_DATA = [
  {
    seq: 1,
    prompt: "WHO IS HOD OF DEPT OF COMPUTER APPLICATIONS?",
    type: "TEXT_CODE",
    options: null,
    correctAnswer: "DR SANDHYA R|DR. SANDHYA R|DR SANDHYA|SANDHYA R|SANDHYA",
    points: 100,
    hint: "HOD, Dept of Computer Applications (MCA).",
  },
  {
    seq: 2,
    prompt: "WHICH BRAND GENERATOR IS USED IN SNGCE?",
    type: "TEXT_CODE",
    options: null,
    correctAnswer: "KOHLER",
    points: 100,
    hint: "Check the generator manufacturer / brand plate.",
  },
  {
    seq: 3,
    prompt: "NUMBER OF PLACEMENTS IN 2025-2026 PLACEMENT POSTER?",
    type: "NUMERIC",
    options: null,
    correctAnswer: "121",
    points: 100,
    hint: "Refer to the official 2025-2026 campus placement poster milestone.",
  },
  {
    seq: 4,
    prompt: "NAME OF THE BIGGEST MISSILE IN MAIN ENTRANCE?",
    type: "TEXT_CODE",
    options: null,
    correctAnswer: "BRAHMOS|BRAHMOS MISSILE",
    points: 100,
    hint: "The supersonic cruise missile model displayed near the main entrance.",
  },
  {
    seq: 5,
    prompt: "WHAT IS THE REGISTRATION NUMBER OF BUS NUMBER 1?",
    type: "TEXT_CODE",
    options: null,
    correctAnswer: "KL 40 E 6327|KL40E6327|KL 40E 6327|KL-40-E-6327",
    points: 100,
    hint: "Registration format: KL 40 E 6327.",
  },
  {
    seq: 6,
    prompt: "WHAT IS THE NAME MENTIONED IN THE WALL OPPOSITE THE STORE?",
    type: "TEXT_CODE",
    options: null,
    correctAnswer: "ARANGU|അരങ്ങ്|ARANGU(MALAYALAM)|ARANGU (MALAYALAM)|ARANGU MALAYALAM",
    points: 100,
    hint: "Cultural stage name painted on the opposite wall (Arangu / അരങ്ങ്).",
  },
  {
    seq: 7,
    prompt: "NUMBER OF FANS IN SNGCE MAIN CANTEEN?",
    type: "NUMERIC",
    options: null,
    correctAnswer: "20|TWENTY",
    points: 100,
    hint: "Count the total ceiling fans installed across the main dining area.",
  },
  {
    seq: 8,
    prompt: "NAME OF SNGCE DOCTOR?",
    type: "TEXT_CODE",
    options: null,
    correctAnswer: "DR T M SREEDEVI|DR. T M SREEDEVI|DR TM SREEDEVI|DR. T. M. SREEDEVI|T M SREEDEVI|DR SREEDEVI|SREEDEVI",
    points: 100,
    hint: "Campus Medical Officer / Doctor.",
  },
  {
    seq: 9,
    prompt: "NO OF STEPS IN PG BLOCK ENTRANCE?",
    type: "NUMERIC",
    options: null,
    correctAnswer: "11|ELEVEN",
    points: 100,
    hint: "Count the steps leading up to the PG Block entrance.",
  },
  {
    seq: 10,
    prompt: "Ultimate milestone reached. Choose Box 1, Box 2, or Box 3 and present your physical token to the Box Marshal.",
    type: "BOX_SELECTION",
    options: JSON.stringify(["Box 1 (Titan Box)", "Box 2 (Cipher Box)", "Box 3 (Nova Box)"]),
    correctAnswer: "TREASURE_CLAIM",
    points: 500,
    hint: "Confer with the TechFest Box Marshal.",
  },
];

const ATLAS_URI = "mongodb+srv://thulasisasidharan17_db_user:CXDsTxMlAko2G7Wv@cluster0.zrkfsz0.mongodb.net/tech_mystery_hunt?retryWrites=true&w=majority";
const LOCAL_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

async function updateQuestions(uri, label) {
  try {
    console.log(`\nConnecting to ${label}...`);
    const conn = await mongoose.createConnection(uri).asPromise();
    const db = conn.db;

    const cpCol = db.collection("checkpoints");
    const qCol = db.collection("questions");

    for (const item of QUESTIONS_DATA) {
      const cp = await cpCol.findOne({ sequenceNumber: item.seq });
      if (!cp) {
        console.warn(`  ⚠️ Checkpoint #${item.seq} not found in ${label}!`);
        continue;
      }

      const cpId = String(cp._id);

      await qCol.deleteMany({ checkpointId: cpId });
      await qCol.insertOne({
        checkpointId: cpId,
        prompt: item.prompt,
        type: item.type,
        options: item.options,
        correctAnswerHash: item.correctAnswer.trim().toUpperCase(),
        points: item.points,
        hint: item.hint,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`  ✓ Q#${item.seq} [${cp.name}]: "${item.prompt.substring(0, 40)}..." -> Answer configured`);
    }

    await conn.close();
    console.log(`✅ ${label} questions successfully updated!`);
  } catch (err) {
    console.error(`⚠️ Could not update questions in ${label}:`, err.message);
  }
}

async function main() {
  await updateQuestions(ATLAS_URI, "MongoDB Atlas Cloud");
  await updateQuestions(LOCAL_URI, "Local MongoDB");
  console.log("\n🎉 All 10 campus questions and accepted answers synchronized!");
  process.exit(0);
}

main().catch(console.error);
