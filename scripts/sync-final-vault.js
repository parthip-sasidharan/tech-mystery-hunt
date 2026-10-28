require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cfg = await mongoose.connection.collection("gameconfigs").findOne({ key: "CHECKPOINT_COUNT" });
  const count = parseInt(cfg?.value || "8", 10);
  console.log("Current CHECKPOINT_COUNT:", count);

  // Unset isFinalTreasure on all checkpoints except the count-th checkpoint
  await mongoose.connection.collection("checkpoints").updateMany(
    { sequenceNumber: { $ne: count } },
    { $set: { isFinalTreasure: false } }
  );

  await mongoose.connection.collection("checkpoints").updateOne(
    { sequenceNumber: count },
    { $set: { isFinalTreasure: true } }
  );

  const cps = await mongoose.connection.collection("checkpoints").find({}).sort({ sequenceNumber: 1 }).toArray();
  console.log("Checkpoints after sync:");
  for (const c of cps) {
    console.log(`CP #${c.sequenceNumber}: ${c.name} | isFinalTreasure: ${c.isFinalTreasure}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
