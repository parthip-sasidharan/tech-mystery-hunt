const mongoose = require('mongoose');

async function resetTeam1() {
  await mongoose.connect('mongodb://localhost:27017/tech_mystery_hunt');
  const team1 = await mongoose.connection.collection('teams').findOne({ teamId: 'MH-2026-001' });
  if (!team1) return console.log('Team not found');

  await mongoose.connection.collection('teams').updateOne(
    { _id: team1._id },
    { $set: { currentCheckpointIndex: 0, currentStage: 'HUNTING' } }
  );

  await mongoose.connection.collection('teamprogresses').deleteMany({ teamId: team1._id.toString() });
  await mongoose.connection.collection('teamprogresses').deleteMany({ teamId: team1._id });
  await mongoose.connection.collection('prizeclaims').deleteMany({ teamId: team1._id });

  console.log('Reset MH-2026-001 to Checkpoint 1 successfully!');
  process.exit(0);
}

resetTeam1();
