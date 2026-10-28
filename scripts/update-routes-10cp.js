require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const routes10 = [
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

  for (const r of routes10) {
    await mongoose.connection.collection("routes").updateOne(
      { name: r.name },
      {
        $set: {
          checkpointSequence: JSON.stringify(r.sequence),
          description: r.description,
          active: true,
          updatedAt: new Date(),
        },
      }
    );
    console.log(`✓ Updated ${r.name}: ${JSON.stringify(r.sequence)}`);
  }

  // Also check Checkpoint 8 question: in a 10 checkpoint game, CP 8 is a regular checkpoint
  const cp8 = await mongoose.connection.collection("checkpoints").findOne({ sequenceNumber: 8 });
  if (cp8) {
    await mongoose.connection.collection("checkpoints").updateOne(
      { sequenceNumber: 8 },
      {
        $set: {
          name: "The Amphitheater Safe",
          isFinalTreasure: false,
          updatedAt: new Date(),
        },
      }
    );
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("STACK", 10);
    await mongoose.connection.collection("questions").updateOne(
      { checkpointId: String(cp8._id) },
      {
        $set: {
          prompt: "Which fundamental data structure operates strictly on a Last-In, First-Out (LIFO) order?",
          type: "TEXT",
          options: null,
          correctAnswerHash: hash,
          points: 100,
          hint: "Opposite of a Queue (FIFO).",
          updatedAt: new Date(),
        },
      }
    );
    console.log("✓ Updated CP#8 to regular puzzle challenge (Answer: STACK).");
  }

  // Check Checkpoint 10 is the Final Treasure Vault
  await mongoose.connection.collection("checkpoints").updateOne(
    { sequenceNumber: 10 },
    {
      $set: {
        isFinalTreasure: true,
        updatedAt: new Date(),
      },
    }
  );
  console.log("✓ Checkpoint #10 confirmed as the ONLY Final Treasure Vault.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
