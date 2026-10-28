const mongoose = require('mongoose');

async function run() {
  const teamIdArg = process.argv[2] || 'MH-2026-001';
  const targetIndex = parseInt(process.argv[3] || '9', 10); // 9 = Checkpoint 10 (0-indexed)

  await mongoose.connect('mongodb://127.0.0.1:27017/tech_mystery_hunt');
  const db = mongoose.connection.db;

  const team = await db.collection('teams').findOne({ teamId: teamIdArg });
  if (!team) {
    console.error(`Team ${teamIdArg} not found!`);
    process.exit(1);
  }

  await db.collection('teams').updateOne(
    { _id: team._id },
    {
      $set: {
        currentCheckpointIndex: targetIndex,
        currentStage: targetIndex >= 9 ? 'HUNTING' : 'HUNTING',
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
      }
    }
  );

  console.log(`Fast-forwarded Team ${teamIdArg} (${team.name}) to Checkpoint index ${targetIndex} (Stage #${targetIndex + 1})!`);
  await mongoose.disconnect();
}

run();
