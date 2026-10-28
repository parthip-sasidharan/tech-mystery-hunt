const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/tech_mystery_hunt');
  const db = mongoose.connection.db;

  const cps = await db.collection('checkpoints').find({}).sort({ sequenceNumber: 1 }).toArray();
  const questions = await db.collection('questions').find({}).toArray();
  const qMap = new Map(questions.map(q => [q.checkpointId.toString(), q]));

  const testAnswers = {
    1: ['HACK'],
    2: ['XOR'],
    3: ['O(n^2)'],
    4: ['200'],
    5: ['No-Cloning Theorem'],
    6: ['SIGMOID'],
    7: ['TECHFEST'],
    8: ['STACK'],
    9: ['443'],
  };

  for (const cp of cps) {
    const q = qMap.get(cp._id.toString());
    if (!q || cp.isFinalTreasure) continue;
    let matched = false;
    for (const ans of (testAnswers[cp.sequenceNumber] || [])) {
      const ok = await bcrypt.compare(ans.toUpperCase(), q.correctAnswerHash);
      if (ok) {
        console.log(`CP #${cp.sequenceNumber} (${cp.name}): MATCHES '${ans}'`);
        matched = true;
        break;
      }
    }
    if (!matched) {
      console.log(`CP #${cp.sequenceNumber} (${cp.name}): NO MATCH! Hash: ${q.correctAnswerHash}`);
    }
  }

  await mongoose.disconnect();
}

run();
