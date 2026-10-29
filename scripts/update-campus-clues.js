/**
 * scripts/update-campus-clues.js
 *
 * Updates all 10 checkpoints in MongoDB Atlas and Local DB with authentic college campus clues:
 * 1. Nadumuttam
 * 2. Store
 * 3. Mech Lab
 * 4. Main Gate
 * 5. Generator
 * 6. Fugeniz Kambi
 * 7. 5th Floor MCB
 * 8. Library
 * 9. Service Center
 * 10. Medicinal Garden (Final Treasure Vault)
 */

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

const CLUES_DATA = [
  {
    seq: 1,
    name: "Nadumuttam",
    campusArea: "Central Courtyard (Nadumuttam)",
    locationHint: "I am the architectural consequence of a decision to leave something unfinished, yet without me the whole would lose its identity. My boundaries are tangible, but my defining feature cannot be touched; look for the place whose most important component is the one no builder installed.",
    isFinalTreasure: false,
  },
  {
    seq: 2,
    name: "College Store",
    campusArea: "Student Co-operative Store",
    locationHint: "My relevance expires without my existence becoming meaningless, and my value can decline while my contents remain unchanged. I facilitate an exchange in which the receiver may possess the means long before acquiring the ability, and the transaction is completed before its true outcome can be measured.",
    isFinalTreasure: false,
  },
  {
    seq: 3,
    name: "Mech Lab",
    campusArea: "Mechanical Engineering Lab Block",
    locationHint: "I am a school in which matter is questioned until its behaviour confesses. My language has no alphabet, yet every answer can be measured; here, equilibrium is a temporary agreement, motion is evidence, and resistance is not an enemy but the subject under investigation.",
    isFinalTreasure: false,
  },
  {
    seq: 4,
    name: "Main Gate",
    campusArea: "Campus Main Entrance Gate",
    locationHint: "I have a mouth but never eat, two arms but no hands, and I open without speaking. What am I?",
    isFinalTreasure: false,
  },
  {
    seq: 5,
    name: "Generator Room",
    campusArea: "Power Substation & Generator Yard",
    locationHint: "I become important when something whose presence is usually unquestioned suddenly disappears , and my greatest achievement is making an extraordinary failure appear almost ordinary. Who am I?",
    isFinalTreasure: false,
  },
  {
    seq: 6,
    name: "Fugeniz Kambi",
    campusArea: "Fugeniz Fest Yard / Main Pillar (Kambi)",
    locationHint: "I have a spine but no bones, stand tall but never walk, and wear rust without wearing clothes. What am I?\nHint: Fe2O3 · xH2O",
    isFinalTreasure: false,
  },
  {
    seq: 7,
    name: "5th Floor MCB",
    campusArea: "5th Floor Electrical Distribution Board (MCB)",
    locationHint: "5 ↑ + FLOW − CONTINUITY = SAFETY\nThe number is not a quantity of guardians, and the interruption is not a mistake. Find the place reached after interpreting the number as a vertical instruction, where protection may require a system to stop.",
    isFinalTreasure: false,
  },
  {
    seq: 8,
    name: "Central Library",
    campusArea: "Campus Central Library",
    locationHint: "I am a place where strangers whisper across centuries without ever meeting, where dead thinkers outlive their bodies, what place punishes the voice but rewards the curious, and holds more conversations when nobody speaks?",
    isFinalTreasure: false,
  },
  {
    seq: 9,
    name: "Service Center",
    campusArea: "Campus Service & Maintenance Center",
    locationHint: "Where does failure become a question instead of a conclusion, and where can something declared useless regain its former purpose?",
    isFinalTreasure: false,
  },
  {
    seq: 10,
    name: "Medicinal Garden",
    campusArea: "Campus Herbal & Medicinal Garden (Final Treasure Vault)",
    locationHint: "My residents possess identities older than the institutions that study them, yet most pass unnoticed by those who cannot interpret their language. Their knowledge is neither written nor spoken, and their greatest secret is that the boundary between remedy and ordinary existence depends on the observer.",
    isFinalTreasure: true,
  },
];

const ATLAS_URI = "mongodb+srv://thulasisasidharan17_db_user:CXDsTxMlAko2G7Wv@cluster0.zrkfsz0.mongodb.net/tech_mystery_hunt?retryWrites=true&w=majority";
const LOCAL_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

async function updateDb(uri, label) {
  try {
    console.log(`\nConnecting to ${label}...`);
    const conn = await mongoose.createConnection(uri).asPromise();
    const db = conn.db;

    for (const item of CLUES_DATA) {
      const res = await db.collection("checkpoints").updateOne(
        { sequenceNumber: item.seq },
        {
          $set: {
            name: item.name,
            campusArea: item.campusArea,
            locationHint: item.locationHint,
            isFinalTreasure: item.isFinalTreasure,
            updatedAt: new Date(),
          },
        }
      );
      console.log(`  ✓ Checkpoint #${item.seq} [${item.name}] (isFinal=${item.isFinalTreasure}): updated (${res.modifiedCount} modified, ${res.matchedCount} matched)`);
    }

    await conn.close();
    console.log(`✅ ${label} successfully updated!`);
  } catch (err) {
    console.error(`⚠️ Could not update ${label}:`, err.message);
  }
}

async function main() {
  await updateDb(ATLAS_URI, "MongoDB Atlas Cloud");
  await updateDb(LOCAL_URI, "Local MongoDB");
  console.log("\n🎉 All 10 checkpoint clues, locations, and names successfully synchronized!");
  process.exit(0);
}

main().catch(console.error);
