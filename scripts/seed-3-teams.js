const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/tech_mystery_hunt');
  const db = mongoose.connection.db;

  // 1. Set GAME_STATUS = ACTIVE
  await db.collection('gameconfigs').updateOne(
    { key: 'GAME_STATUS' },
    { $set: { value: 'ACTIVE', description: 'Game active for testing' } },
    { upsert: true }
  );

  // 2. Fetch routes
  const routeAlpha = await db.collection('routes').findOne({ name: 'Route Alpha' });
  const routeBeta = await db.collection('routes').findOne({ name: 'Route Beta' });
  const routeGamma = await db.collection('routes').findOne({ name: 'Route Gamma' });

  // 3. Clear any existing prize claims to start clean
  await db.collection('prizeclaims').deleteMany({});
  await db.collection('teamprogresses').deleteMany({});
  await db.collection('teams').deleteMany({});
  await db.collection('teamids').deleteMany({});

  const passwordHash = await bcrypt.hash('hunt123', 10);

  const teamDefs = [
    {
      teamId: 'MH-2026-001',
      name: 'CyberKnights',
      leaderName: 'Arjun Ramesh',
      leaderEmail: 'arjun@team1.edu',
      leaderPhone: '9876543210',
      members: ['Arjun Ramesh', 'Devika S', 'Rahul K', 'Sneha M'],
      routeId: routeAlpha ? routeAlpha._id.toString() : null,
      routeName: 'Route Alpha',
      sequence: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    {
      teamId: 'MH-2026-002',
      name: 'BinaryBots',
      leaderName: 'Fathima Noor',
      leaderEmail: 'fathima@team2.edu',
      leaderPhone: '9876543211',
      members: ['Fathima Noor', 'Bilal Ahmed', 'Ananya R', 'Gautam V'],
      routeId: routeBeta ? routeBeta._id.toString() : null,
      routeName: 'Route Beta',
      sequence: [7, 5, 3, 1, 9, 6, 4, 2, 8, 10],
    },
    {
      teamId: 'MH-2026-003',
      name: 'CodeBreakers',
      leaderName: 'Kiran Mohan',
      leaderEmail: 'kiran@team3.edu',
      leaderPhone: '9876543212',
      members: ['Kiran Mohan', 'Rohit V', 'Priya N', 'Adarsh P'],
      routeId: routeGamma ? routeGamma._id.toString() : null,
      routeName: 'Route Gamma',
      sequence: [3, 1, 4, 2, 8, 7, 5, 9, 6, 10],
    },
  ];

  for (const def of teamDefs) {
    // Upsert into teamids
    await db.collection('teamids').insertOne({
      teamId: def.teamId,
      assigned: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Team
    await db.collection('teams').insertOne({
      teamId: def.teamId,
      name: def.name,
      leaderName: def.leaderName,
      leaderEmail: def.leaderEmail,
      leaderPhone: def.leaderPhone,
      members: JSON.stringify(def.members),
      passwordHash,
      routeId: def.routeId,
      currentCheckpointIndex: 0,
      currentStage: 'HUNTING',
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  console.log('Successfully seeded 3 test teams with password "hunt123" and active game status!');
  await mongoose.disconnect();
}

run();
