const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function updatePasswords() {
  await mongoose.connect('mongodb://localhost:27017/tech_mystery_hunt');

  const adminHash = await bcrypt.hash('123', 10);
  const volunteerHash = await bcrypt.hash('1234', 10);

  // Update admin user
  const adminRes = await mongoose.connection.collection('users').updateOne(
    { role: 'ADMIN' },
    { 
      $set: { 
        passwordHash: adminHash,
        updatedAt: new Date()
      } 
    }
  );
  console.log('Admin password updated to 123:', adminRes.modifiedCount);

  // Update volunteer1 user
  const volRes = await mongoose.connection.collection('users').updateOne(
    { username: 'volunteer1' },
    { 
      $set: { 
        passwordHash: volunteerHash,
        updatedAt: new Date()
      } 
    }
  );
  console.log('Volunteer1 password updated to 1234:', volRes.modifiedCount);

  // Print all users to confirm
  const allUsers = await mongoose.connection.collection('users').find({}).toArray();
  for (const u of allUsers) {
    console.log('User:', u.username, 'Role:', u.role, 'Name:', u.name);
  }

  process.exit(0);
}

updatePasswords().catch(console.error);
