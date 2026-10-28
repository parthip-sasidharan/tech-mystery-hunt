const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/tech_mystery_hunt');
  const db = mongoose.connection.db;

  await db.collection('teams').updateOne(
    { teamId: 'MH-2026-001' },
    { $set: { leaderName: 'Rahul Sharma', name: 'CyberKnights' } }
  );

  console.log('Updated MH-2026-001 leaderName to Rahul Sharma!');
  await mongoose.disconnect();
}

run();
