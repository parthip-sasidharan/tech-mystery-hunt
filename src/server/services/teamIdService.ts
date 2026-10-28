import { connectToDatabase } from "../db";
import { TeamIdPool, Team, AuditLog } from "../models";

/**
 * Formats a numeric sequence into a standardized Team ID.
 * Examples: 1 -> "TEAM001", 42 -> "TEAM042", 100 -> "TEAM100", 1500 -> "TEAM1500"
 * Never hardcoded to a fixed ceiling.
 */
export function formatTeamId(seq: number): string {
  const padded = seq < 1000 ? String(seq).padStart(3, "0") : String(seq);
  return `TEAM${padded}`;
}

/**
 * Extracts sequence number from a Team ID string if it matches TEAM\d+ format.
 */
export function parseTeamIdSequence(teamIdStr: string): number | null {
  const match = teamIdStr.match(/^TEAM(\d+)$/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Determines the current highest sequence number across TeamIdPool and existing Team records.
 */
export async function getHighestSequenceNumber(): Promise<number> {
  await connectToDatabase();

  const highestInPool = await TeamIdPool.findOne({})
    .sort({ sequenceNumber: -1 })
    .select("sequenceNumber")
    .lean();

  let maxSeq = highestInPool ? highestInPool.sequenceNumber : 0;

  // Also check existing teams in case any were assigned without pool
  const allTeams = await Team.find({ teamId: { $regex: /^TEAM\d+$/i } })
    .select("teamId")
    .lean();

  for (const t of allTeams) {
    const seq = parseTeamIdSequence(t.teamId);
    if (seq && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  return maxSeq;
}

/**
 * Bulk generates a batch of sequential Team IDs into the pool as AVAILABLE.
 * Supports generating 10, 50, 100, 500+ IDs on demand.
 */
export async function bulkGenerateTeamIds(
  count: number,
  adminId?: string,
  batchTag: string = "MANUAL_BULK"
) {
  await connectToDatabase();

  if (count <= 0 || count > 1000) {
    throw new Error("Batch generation count must be between 1 and 1000.");
  }

  const startSeq = (await getHighestSequenceNumber()) + 1;
  const docs = [];

  for (let i = 0; i < count; i++) {
    const seq = startSeq + i;
    docs.push({
      teamId: formatTeamId(seq),
      sequenceNumber: seq,
      status: "AVAILABLE" as const,
      assignedTeamId: null,
      assignedTeamName: null,
      assignedAt: null,
      batchTag,
    });
  }

  const result = await TeamIdPool.insertMany(docs, { ordered: false });

  if (adminId) {
    await AuditLog.create({
      action: "TEAM_IDS_BULK_GENERATED",
      actorRole: "ADMIN",
      actorId: adminId,
      details: JSON.stringify({
        count,
        fromSeq: startSeq,
        toSeq: startSeq + count - 1,
        fromId: docs[0].teamId,
        toId: docs[docs.length - 1].teamId,
        batchTag,
      }),
    });
  }

  return {
    generatedCount: result.length,
    fromTeamId: docs[0].teamId,
    toTeamId: docs[docs.length - 1].teamId,
    startSequence: startSeq,
    endSequence: startSeq + count - 1,
  };
}

/**
 * Concurrency-safe atomic allocation of the next available Team ID.
 * If the pool contains AVAILABLE IDs, it claims the lowest sequence number atomically.
 * If the pool is empty, it dynamically generates and assigns the next sequence number.
 */
export async function allocateNextAvailableTeamId(
  teamObjectId: string,
  teamName: string
): Promise<string> {
  await connectToDatabase();

  // 1. Try atomic claim of lowest AVAILABLE id
  const claimed = await TeamIdPool.findOneAndUpdate(
    { status: "AVAILABLE" },
    {
      $set: {
        status: "ASSIGNED",
        assignedTeamId: teamObjectId,
        assignedTeamName: teamName,
        assignedAt: new Date(),
      },
    },
    { sort: { sequenceNumber: 1 }, new: true }
  );

  if (claimed) {
    return claimed.teamId;
  }

  // 2. Pool is empty: dynamically create and claim the next sequence number with concurrency retry
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nextSeq = (await getHighestSequenceNumber()) + 1;
    const teamIdStr = formatTeamId(nextSeq);

    try {
      const newPoolEntry = await TeamIdPool.create({
        teamId: teamIdStr,
        sequenceNumber: nextSeq,
        status: "ASSIGNED",
        assignedTeamId: teamObjectId,
        assignedTeamName: teamName,
        assignedAt: new Date(),
        batchTag: "AUTO_ON_DEMAND",
      });

      return newPoolEntry.teamId;
    } catch (err: unknown) {
      // E11000 duplicate key error means another concurrent request claimed this sequenceNumber. Retry!
      const isDuplicate =
        err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000;
      if (!isDuplicate) {
        throw err;
      }
    }
  }

  // If retries exhausted, perform atomic findOneAndUpdate one more time
  const fallbackClaim = await TeamIdPool.findOneAndUpdate(
    { status: "AVAILABLE" },
    {
      $set: {
        status: "ASSIGNED",
        assignedTeamId: teamObjectId,
        assignedTeamName: teamName,
        assignedAt: new Date(),
      },
    },
    { sort: { sequenceNumber: 1 }, new: true }
  );

  if (fallbackClaim) {
    return fallbackClaim.teamId;
  }

  throw new Error("Failed to allocate unique Team ID under high concurrency. Please try again.");
}

/**
 * Assigns a specific available Team ID to a team (for Admin manual or spot assignment).
 */
export async function assignSpecificTeamId(
  teamIdStr: string,
  teamObjectId: string,
  teamName: string
): Promise<string> {
  await connectToDatabase();

  const cleanTeamId = teamIdStr.trim().toUpperCase();

  const assigned = await TeamIdPool.findOneAndUpdate(
    { teamId: cleanTeamId, status: "AVAILABLE" },
    {
      $set: {
        status: "ASSIGNED",
        assignedTeamId: teamObjectId,
        assignedTeamName: teamName,
        assignedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!assigned) {
    // Check if it exists and what its status is
    const existing = await TeamIdPool.findOne({ teamId: cleanTeamId }).lean();
    if (!existing) {
      // Create it as assigned if it doesn't exist
      const seq = parseTeamIdSequence(cleanTeamId) || (await getHighestSequenceNumber()) + 1;
      const created = await TeamIdPool.create({
        teamId: cleanTeamId,
        sequenceNumber: seq,
        status: "ASSIGNED",
        assignedTeamId: teamObjectId,
        assignedTeamName: teamName,
        assignedAt: new Date(),
        batchTag: "MANUAL_SPECIFIC",
      });
      return created.teamId;
    }
    throw new Error(`Team ID "${cleanTeamId}" is already ${existing.status.toLowerCase()} and cannot be assigned.`);
  }

  return assigned.teamId;
}

/**
 * Retrieves aggregate statistics about Team IDs.
 */
export async function getTeamIdStats() {
  await connectToDatabase();

  const [total, available, assigned, disabled, reserved] = await Promise.all([
    TeamIdPool.countDocuments(),
    TeamIdPool.countDocuments({ status: "AVAILABLE" }),
    TeamIdPool.countDocuments({ status: "ASSIGNED" }),
    TeamIdPool.countDocuments({ status: "DISABLED" }),
    TeamIdPool.countDocuments({ status: "RESERVED" }),
  ]);

  return {
    totalGenerated: total,
    totalPool: total,
    available,
    assigned,
    disabled,
    reserved,
  };
}

/**
 * Lists Team IDs with status and pagination for the Admin Dashboard.
 */
export async function listTeamIds(options?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  await connectToDatabase();

  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};

  if (options?.status && options.status !== "ALL") {
    query.status = options.status;
  }

  if (options?.search) {
    const s = options.search.trim();
    query.$or = [
      { teamId: { $regex: s, $options: "i" } },
      { assignedTeamName: { $regex: s, $options: "i" } },
    ];
  }

  const [items, totalCount] = await Promise.all([
    TeamIdPool.find(query).sort({ sequenceNumber: 1 }).skip(skip).limit(limit).lean(),
    TeamIdPool.countDocuments(query),
  ]);

  return {
    items: items.map((item) => ({
      id: String(item._id),
      teamId: item.teamId,
      sequenceNumber: item.sequenceNumber,
      status: item.status,
      assignedTeamId: item.assignedTeamId,
      assignedTeamName: item.assignedTeamName,
      assignedAt: item.assignedAt,
      batchTag: item.batchTag,
      createdAt: item.createdAt,
    })),
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit),
  };
}

/**
 * Toggles status of an unassigned Team ID (e.g. enable or disable).
 */
export async function toggleTeamIdStatus(
  teamIdStr: string,
  newStatus: "AVAILABLE" | "DISABLED" | "RESERVED",
  adminId: string
) {
  await connectToDatabase();

  const cleanId = teamIdStr.trim();
  const query: Record<string, unknown>[] = [{ teamId: cleanId.toUpperCase() }];
  if (/^[0-9a-fA-F]{24}$/.test(cleanId)) {
    query.push({ _id: cleanId });
  }

  const entry = await TeamIdPool.findOne({ $or: query });

  if (!entry) {
    throw new Error(`Team ID "${cleanId}" not found in pool.`);
  }

  if (entry.status === "ASSIGNED") {
    throw new Error(`Cannot change status of "${cleanId}" because it is already assigned to a team.`);
  }

  const oldStatus = entry.status;
  entry.status = newStatus;
  await entry.save();

  await AuditLog.create({
    action: "TEAM_ID_STATUS_CHANGED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({ teamId: cleanId, oldStatus, newStatus }),
  });

  return {
    teamId: entry.teamId,
    oldStatus,
    newStatus: entry.status,
  };
}
