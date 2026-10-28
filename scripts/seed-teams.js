const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seedTeams() {
  await mongoose.connect('mongodb://localhost:27017/tech_mystery_hunt');

  const routes = await mongoose.connection.collection('routes').find({ active: true }).toArray();
  const defaultRoute = routes[0];

  const passwordHash = await bcrypt.hash('hunt123', 10);

  const initialTeams = [
    {
      teamId: 'MH-2026-001',
      name: 'CyberKnights',
      leaderName: 'PATHU',
      leaderEmail: 'cyberknights@techfest.college.edu',
      leaderPhone: '9876543210',
      members: JSON.stringify([{ name: 'PATHU', collegeId: 'CS01', phone: '9876543210' }]),
      passwordHash: passwordHash,
      routeId: defaultRoute ? defaultRoute._id : null,
      status: 'WAITING',
      currentStage: 'WAITING_ROOM',
      currentCheckpointIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      teamId: 'MH-2026-002',
      name: 'BinaryBots',
      leaderName: 'Anand Krishna',
      leaderEmail: 'binarybots@techfest.college.edu',
      leaderPhone: '9876543211',
      members: JSON.stringify([{ name: 'Anand Krishna', collegeId: 'EC01', phone: '9876543211' }]),
      passwordHash: passwordHash,
      routeId: routes[1] ? routes[1]._id : defaultRoute ? defaultRoute._id : null,
      status: 'WAITING',
      currentStage: 'WAITING_ROOM',
      currentCheckpointIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      teamId: 'MH-2026-003',
      name: 'CodeBreakers',
      leaderName: 'Kiran Mohan',
      leaderEmail: 'codebreakers@techfest.college.edu',
      leaderPhone: '9876543212',
      members: JSON.stringify([{ name: 'Kiran Mohan', collegeId: 'ME01', phone: '9876543212' }]),
      passwordHash: passwordHash,
      routeId: routes[2] ? routes[2]._id : defaultRoute ? defaultRoute._id : null,
      status: 'WAITING',
      currentStage: 'WAITING_ROOM',
      currentCheckpointIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const t of initialTeams) {
    const existing = await mongoose.connection.collection('teams').findOne({ teamId: t.teamId });
    if (!existing) {
      await mongoose.connection.collection('teams').insertOne(t);
      console.log('Created team:', t.teamId, t.name);
    } else {
      await mongoose.connection.collection('teams').updateOne(
        { _id: existing._id },
        { $set: { passwordHash: passwordHash, leaderName: t.leaderName, name: t.name } }
      );
      console.log('Updated team:', t.teamId);
    }
  }

  // Also make sure TeamIdPool has them marked as ASSIGNED
  let seq = 1001;
  for (const t of initialTeams) {
    await mongoose.connection.collection('teamidpools').updateOne(
      { teamId: t.teamId },
      { 
        $set: { 
          teamId: t.teamId, 
          sequenceNumber: seq++,
          status: 'ASSIGNED', 
          assignedTeamName: t.name,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
  }

  console.log('Teams seeded successfully!');
  process.exit(0);
}

seedTeams().catch(console.error);
