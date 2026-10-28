/**
 * scripts/migrate-sqlite-to-mongo.js
 *
 * Migrates existing data from SQLite (dev.db via Prisma) to MongoDB Atlas / local MongoDB (via Mongoose).
 * Preserves all existing records and IDs.
 * Does NOT delete the SQLite database file.
 */

"use strict";

require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";

async function migrate() {
  console.log("🚀 Starting data migration from SQLite to MongoDB...");
  console.log(`📡 Target MongoDB URI: ${MONGODB_URI.replace(/:([^:@]+)@/, ":****@")}`);

  const prisma = new PrismaClient();
  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB.");

  const db = mongoose.connection.db;

  try {
    // 1. GameConfig
    const configs = await prisma.gameConfig.findMany();
    if (configs.length > 0) {
      const configCollection = db.collection("gameconfigs");
      for (const c of configs) {
        await configCollection.updateOne(
          { key: c.key },
          { $set: { key: c.key, value: c.value, description: c.description, updatedAt: c.updatedAt, createdAt: c.createdAt } },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${configs.length} GameConfig entries`);
    }

    // 2. Users (Admin, Volunteers)
    const users = await prisma.user.findMany();
    if (users.length > 0) {
      const userCollection = db.collection("users");
      for (const u of users) {
        await userCollection.updateOne(
          { username: u.username },
          {
            $set: {
              _id: u.id,
              username: u.username.toLowerCase(),
              email: u.email.toLowerCase(),
              passwordHash: u.passwordHash,
              name: u.name,
              role: u.role,
              active: u.active,
              assignedCheckpointId: u.assignedCheckpointId || null,
              createdAt: u.createdAt,
              updatedAt: u.updatedAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${users.length} User records`);
    }

    // 3. Routes
    const routes = await prisma.route.findMany();
    if (routes.length > 0) {
      const routeCollection = db.collection("routes");
      for (const r of routes) {
        await routeCollection.updateOne(
          { name: r.name },
          {
            $set: {
              _id: r.id,
              name: r.name,
              description: r.description,
              checkpointSequence: r.checkpointSequence,
              active: r.active,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${routes.length} Route records`);
    }

    // 4. Checkpoints
    const checkpoints = await prisma.checkpoint.findMany();
    if (checkpoints.length > 0) {
      const checkpointCollection = db.collection("checkpoints");
      for (const cp of checkpoints) {
        await checkpointCollection.updateOne(
          { sequenceNumber: cp.sequenceNumber },
          {
            $set: {
              _id: cp.id,
              sequenceNumber: cp.sequenceNumber,
              name: cp.name,
              locationHint: cp.locationHint,
              campusArea: cp.campusArea,
              qrCodeToken: cp.qrCodeToken,
              isFinalTreasure: cp.isFinalTreasure,
              treasureBoxNumber: cp.treasureBoxNumber,
              createdAt: cp.createdAt,
              updatedAt: cp.updatedAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${checkpoints.length} Checkpoint records`);
    }

    // 5. Questions
    const questions = await prisma.question.findMany();
    if (questions.length > 0) {
      const questionCollection = db.collection("questions");
      for (const q of questions) {
        await questionCollection.updateOne(
          { _id: q.id },
          {
            $set: {
              _id: q.id,
              checkpointId: q.checkpointId,
              prompt: q.prompt,
              type: q.type,
              options: q.options,
              correctAnswerHash: q.correctAnswerHash,
              points: q.points,
              hint: q.hint,
              createdAt: q.createdAt,
              updatedAt: q.updatedAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${questions.length} Question records`);
    }

    // 6. Teams
    const teams = await prisma.team.findMany();
    if (teams.length > 0) {
      const teamCollection = db.collection("teams");
      for (const t of teams) {
        await teamCollection.updateOne(
          { teamId: t.teamId },
          {
            $set: {
              _id: t.id,
              teamId: t.teamId,
              name: t.name,
              leaderName: t.leaderName,
              leaderEmail: t.leaderEmail.toLowerCase(),
              leaderPhone: t.leaderPhone,
              members: t.members,
              passwordHash: t.passwordHash,
              routeId: t.routeId,
              status: t.status,
              currentCheckpointIndex: t.currentCheckpointIndex,
              currentStage: t.currentStage,
              startedAt: t.startedAt,
              completedAt: t.completedAt,
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${teams.length} Team records`);
    }

    // 7. TeamProgress
    const progresses = await prisma.teamProgress.findMany();
    if (progresses.length > 0) {
      const progressCollection = db.collection("teamprogresses");
      for (const p of progresses) {
        await progressCollection.updateOne(
          { teamId: p.teamId, checkpointId: p.checkpointId },
          {
            $set: {
              _id: p.id,
              teamId: p.teamId,
              checkpointId: p.checkpointId,
              scannedAt: p.scannedAt,
              qrValidated: p.qrValidated,
              answerSubmitted: p.answerSubmitted,
              isAnswerCorrect: p.isAnswerCorrect,
              attemptsCount: p.attemptsCount,
              completedAt: p.completedAt,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${progresses.length} TeamProgress records`);
    }

    // 8. PrizeClaims
    const claims = await prisma.prizeClaim.findMany();
    if (claims.length > 0) {
      const claimCollection = db.collection("prizeclaims");
      for (const cl of claims) {
        await claimCollection.updateOne(
          { claimCode: cl.claimCode },
          {
            $set: {
              _id: cl.id,
              teamId: cl.teamId,
              boxNumber: cl.boxNumber,
              claimCode: cl.claimCode,
              status: cl.status,
              claimedAt: cl.claimedAt,
              volunteerId: cl.volunteerId,
              volunteerNotes: cl.volunteerNotes,
              verifiedAt: cl.verifiedAt,
              createdAt: cl.createdAt,
              updatedAt: cl.updatedAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${claims.length} PrizeClaim records`);
    }

    // 9. Registrations
    const registrations = await prisma.registration.findMany();
    if (registrations.length > 0) {
      const regCollection = db.collection("registrations");
      for (const reg of registrations) {
        await regCollection.updateOne(
          { teamName: reg.teamName },
          {
            $set: {
              _id: reg.id,
              teamName: reg.teamName,
              leaderName: reg.leaderName,
              leaderEmail: reg.leaderEmail.toLowerCase(),
              leaderPhone: reg.leaderPhone,
              membersJson: reg.membersJson,
              passwordHash: reg.passwordHash,
              status: reg.status,
              rejectionNote: reg.rejectionNote,
              approvedTeamId: reg.approvedTeamId,
              createdAt: reg.createdAt,
              updatedAt: reg.updatedAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${registrations.length} Registration records`);
    }

    // 10. AuditLogs
    const logs = await prisma.auditLog.findMany();
    if (logs.length > 0) {
      const logCollection = db.collection("auditlogs");
      for (const al of logs) {
        await logCollection.updateOne(
          { _id: al.id },
          {
            $set: {
              _id: al.id,
              action: al.action,
              actorRole: al.actorRole,
              actorId: al.actorId,
              details: al.details,
              ipAddress: al.ipAddress,
              createdAt: al.createdAt,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Migrated ${logs.length} AuditLog records`);
    }

    console.log("\n🎉 Migration successfully completed! All records preserved in MongoDB.");

  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}

migrate();
