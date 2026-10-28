const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/tech_mystery_hunt');
  const db = mongoose.connection.db;

  const cps = await db.collection('checkpoints').find({}).sort({ sequenceNumber: 1 }).toArray();
  const questions = await db.collection('questions').find({}).toArray();
  const qMap = new Map(questions.map(q => [q.checkpointId.toString(), q]));

  const answers = {
    1: 'HACK',
    2: 'XOR',
    3: 'O(n^2)',
    4: '200',
    5: 'No-Cloning Theorem',
    6: 'SIGMOID',
    7: 'TECHFEST',
    8: 'STACK',
    9: '443',
    10: 'FINAL VAULT (No question! Scanning this QR unlocks the Box Clue!)'
  };

  console.log('================================================================');
  console.log('              TECH MYSTERY HUNT: MASTER CHEAT SHEET              ');
  console.log('================================================================\n');

  for (const cp of cps) {
    const q = qMap.get(cp._id.toString());
    console.log(`[CHECKPOINT #${cp.sequenceNumber}] ${cp.name} ${cp.isFinalTreasure ? '🏆 (FINAL VAULT)' : ''}`);
    console.log(`  QR Token: ${cp.qrCodeToken}`);
    console.log(`  Location: ${cp.locationHint}`);
    if (q) {
      console.log(`  Question: ${q.prompt}`);
      if (q.options) console.log(`  Options: ${q.options}`);
      console.log(`  >>> ANSWER: ${answers[cp.sequenceNumber]}`);
    }
    console.log('----------------------------------------------------------------');
  }

  await mongoose.disconnect();
}

run();
