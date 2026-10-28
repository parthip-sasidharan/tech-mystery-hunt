import { connectToDatabase } from "../db";
import { Route, Checkpoint, Team, TeamProgress, AuditLog } from "../models";
import { getCheckpointCount, getGameStatus } from "./gameService";
import { invalidateRouteCache } from "./checkpointService";

export interface RouteValidationResult {
  routeId: string;
  routeName: string;
  sequence: number[];
  isValid: boolean;
  errors: string[];
  warnings: string[];
  teamCount: number;
}

/**
 * Validates a single route sequence against configured checkpoints.
 * Rule 1: Must match total configured count (including final treasure).
 * Rule 2: Must end at the shared final treasure checkpoint.
 * Rule 3: Must visit each active regular checkpoint exactly once (no duplicates, no omissions).
 */
export function validateRouteSequence(
  sequence: number[],
  totalConfigured: number,
  regularSeqNumbers: number[],
  finalTreasureSeqNumber: number
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Length check
  if (sequence.length !== totalConfigured) {
    errors.push(
      `Sequence length (${sequence.length}) does not match configured total checkpoints (${totalConfigured}).`
    );
  }

  // Final checkpoint check
  const lastStep = sequence[sequence.length - 1];
  if (lastStep !== finalTreasureSeqNumber) {
    errors.push(
      `Route must conclude at final treasure checkpoint #${finalTreasureSeqNumber}. Found checkpoint #${lastStep} instead.`
    );
  }

  // Duplicate check
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const num of sequence) {
    if (seen.has(num)) {
      duplicates.add(num);
    }
    seen.add(num);
  }
  if (duplicates.size > 0) {
    errors.push(`Duplicate checkpoint(s) in sequence: ${Array.from(duplicates).join(", ")}`);
  }

  // Missing regular checkpoints check
  const nonFinalInSequence = new Set(sequence.slice(0, -1));
  const missingRegular = regularSeqNumbers.filter((num) => !nonFinalInSequence.has(num));
  if (missingRegular.length > 0) {
    errors.push(`Missing regular checkpoint(s): ${missingRegular.join(", ")}`);
  }

  // Extra unknown checkpoints
  const allKnown = new Set([...regularSeqNumbers, finalTreasureSeqNumber]);
  const unknownInSeq = sequence.filter((num) => !allKnown.has(num));
  if (unknownInSeq.length > 0) {
    errors.push(`Sequence contains non-existent or inactive checkpoint(s): ${unknownInSeq.join(", ")}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates all routes against current database checkpoints and team assignments.
 * Detects missing checkpoints, invalid ordering, and route capacity bottlenecks.
 */
export async function validateAllRoutesReport() {
  await connectToDatabase();

  const totalConfigured = await getCheckpointCount();
  const allCheckpoints = await Checkpoint.find({ active: { $ne: false } })
    .sort({ sequenceNumber: 1 })
    .lean();

  const activeCheckpoints = allCheckpoints.filter((c) => c.sequenceNumber <= totalConfigured);
  const finalCp = activeCheckpoints.find((c) => c.isFinalTreasure) || allCheckpoints.find((c) => c.sequenceNumber === totalConfigured);
  const finalSeq = finalCp ? finalCp.sequenceNumber : totalConfigured;

  const regularSeqNumbers = activeCheckpoints
    .filter((c) => c.sequenceNumber !== finalSeq && !c.isFinalTreasure)
    .map((c) => c.sequenceNumber);

  const routes = await Route.find({}).lean();
  const totalRegisteredTeams = await Team.countDocuments({});

  let allValid = true;
  let totalActiveRoutes = 0;

  const results: RouteValidationResult[] = [];

  for (const r of routes) {
    const routeId = String(r._id);
    let parsedSeq: number[] = [];
    try {
      parsedSeq = JSON.parse(r.checkpointSequence);
    } catch {
      parsedSeq = [];
    }

    const teamCount = await Team.countDocuments({ routeId });
    if (r.active) totalActiveRoutes++;

    const val = validateRouteSequence(parsedSeq, totalConfigured, regularSeqNumbers, finalSeq);

    // Route capacity warning if one route is overburdened
    if (totalRegisteredTeams > 10 && teamCount > totalRegisteredTeams * 0.6 && totalActiveRoutes > 1) {
      val.warnings.push(
        `High route concentration: This route holds ${teamCount} of ${totalRegisteredTeams} teams (${Math.round(
          (teamCount / totalRegisteredTeams) * 100
        )}%). Consider rebalancing.`
      );
    }

    if (!val.isValid && r.active) {
      allValid = false;
    }

    results.push({
      routeId,
      routeName: r.name,
      sequence: parsedSeq,
      isValid: val.isValid,
      errors: val.errors,
      warnings: val.warnings,
      teamCount,
    });
  }

  // Capacity check
  const capacityWarnings: string[] = [];
  if (totalActiveRoutes === 0) {
    capacityWarnings.push("CRITICAL: No active routes exist. New teams cannot be balanced or assigned.");
    allValid = false;
  } else if (totalRegisteredTeams > 50 && totalActiveRoutes < 3) {
    capacityWarnings.push(
      `Insufficient route capacity: Only ${totalActiveRoutes} active routes for ${totalRegisteredTeams} registered teams. Recommended at least 4 routes to prevent checkpoint bottlenecks.`
    );
  }

  return {
    allValid,
    totalConfigured,
    finalTreasureSeqNumber: finalSeq,
    regularCheckpointsCount: regularSeqNumbers.length,
    activeRoutesCount: totalActiveRoutes,
    totalRegisteredTeams,
    capacityWarnings,
    routes: results,
  };
}

/**
 * Lists routes with step details for Admin.
 */
export async function listRoutesForAdmin() {
  await connectToDatabase();

  const [routes, report, allTeams] = await Promise.all([
    Route.find({}).sort({ createdAt: 1 }).lean(),
    validateAllRoutesReport(),
    Team.find({})
      .select("teamId name leaderName routeId status currentStage currentCheckpointIndex")
      .sort({ teamId: 1 })
      .lean(),
  ]);

  const checkpoints = await Checkpoint.find({ active: { $ne: false } }).lean();
  const cpMap = new Map<number, { name: string; campusArea: string; isFinalTreasure: boolean }>();
  for (const c of checkpoints) {
    cpMap.set(c.sequenceNumber, {
      name: c.name,
      campusArea: c.campusArea,
      isFinalTreasure: c.isFinalTreasure,
    });
  }

  const enriched = routes.map((r) => {
    const routeId = String(r._id);
    let sequence: number[] = [];
    try {
      sequence = JSON.parse(r.checkpointSequence);
    } catch {
      sequence = [];
    }

    const valResult = report.routes.find((res) => res.routeId === routeId);

    const steps = sequence.map((seq) => ({
      sequenceNumber: seq,
      checkpoint: cpMap.get(seq) || {
        name: `Checkpoint #${seq}`,
        campusArea: "Unknown Area",
        isFinalTreasure: seq === report.finalTreasureSeqNumber,
      },
    }));

    const assignedTeams = allTeams
      .filter((t) => t.routeId && (String(t.routeId) === routeId || String(t.routeId) === r.name))
      .map((t) => ({
        teamId: t.teamId,
        name: t.name,
        leaderName: t.leaderName,
        status: t.status,
        currentStage: t.currentStage,
        currentCheckpointIndex: t.currentCheckpointIndex ?? 0,
      }));

    return {
      id: routeId,
      name: r.name,
      description: r.description,
      active: r.active,
      checkpointSequence: sequence,
      steps,
      assignedTeams,
      teamCount: assignedTeams.length,
      isValid: valResult?.isValid ?? true,
      errors: valResult?.errors || [],
      warnings: valResult?.warnings || [],
    };
  });

  return {
    summary: report,
    routes: enriched,
  };
}

/**
 * Creates a new route with sequence validation.
 */
export async function createRoute(
  input: { name: string; description?: string; checkpointSequence: number[]; active?: boolean },
  adminId: string
) {
  await connectToDatabase();

  const cleanName = input.name.trim();
  const existing = await Route.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, "i") } });
  if (existing) {
    throw new Error(`A route named "${cleanName}" already exists.`);
  }

  const report = await validateAllRoutesReport();
  const regularCp = await Checkpoint.find({ isFinalTreasure: false, active: { $ne: false } }).select("sequenceNumber").lean();
  const regularSeqs = regularCp.map((c) => c.sequenceNumber);

  const val = validateRouteSequence(
    input.checkpointSequence,
    report.totalConfigured,
    regularSeqs,
    report.finalTreasureSeqNumber
  );

  if (!val.isValid) {
    throw new Error(`Invalid route sequence: ${val.errors.join("; ")}`);
  }

  const route = await Route.create({
    name: cleanName,
    description: input.description?.trim() || null,
    checkpointSequence: JSON.stringify(input.checkpointSequence),
    active: input.active !== false,
  });

  await AuditLog.create({
    action: "ROUTE_CREATED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({ routeId: String(route._id), name: route.name, sequence: input.checkpointSequence }),
  });

  return {
    success: true,
    route: {
      id: String(route._id),
      name: route.name,
      checkpointSequence: input.checkpointSequence,
    },
  };
}

/**
 * Updates an existing route. Protects against silently modifying sequences of active teams.
 */
export async function updateRoute(
  routeId: string,
  input: { name?: string; description?: string; checkpointSequence?: number[]; active?: boolean },
  adminId: string
) {
  await connectToDatabase();

  const route = await Route.findOne({ _id: routeId });
  if (!route) throw new Error("Route not found.");

  const gameStatus = await getGameStatus();

  // If changing sequence, verify game is not active with progress
  if (input.checkpointSequence) {
    if (gameStatus === "ACTIVE" || gameStatus === "PAUSED") {
      const activeProgress = await TeamProgress.countDocuments({ qrValidated: true });
      if (activeProgress > 0) {
        throw new Error(
          "Cannot alter checkpoint sequence of routes while a hunt is actively in progress with team progress."
        );
      }
    }

    const report = await validateAllRoutesReport();
    const regularCp = await Checkpoint.find({ isFinalTreasure: false, active: { $ne: false } }).select("sequenceNumber").lean();
    const regularSeqs = regularCp.map((c) => c.sequenceNumber);

    const val = validateRouteSequence(
      input.checkpointSequence,
      report.totalConfigured,
      regularSeqs,
      report.finalTreasureSeqNumber
    );

    if (!val.isValid) {
      throw new Error(`Invalid route sequence: ${val.errors.join("; ")}`);
    }

    route.checkpointSequence = JSON.stringify(input.checkpointSequence);
  }

  if (input.name !== undefined) route.name = input.name.trim();
  if (input.description !== undefined) route.description = input.description?.trim() || null;
  if (input.active !== undefined) route.active = input.active;

  await route.save();

  await AuditLog.create({
    action: "ROUTE_UPDATED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({ routeId, name: route.name, active: route.active }),
  });

  return {
    success: true,
    message: `Route "${route.name}" updated successfully.`,
    route: {
      id: String(route._id),
      name: route.name,
      active: route.active,
    },
  };
}

/**
 * Deletes a route if no teams are currently assigned to it.
 */
export async function deleteRoute(routeId: string, adminId: string) {
  await connectToDatabase();

  const route = await Route.findOne({ _id: routeId });
  if (!route) throw new Error("Route not found.");

  const assignedTeamsCount = await Team.countDocuments({ routeId });
  if (assignedTeamsCount > 0) {
    throw new Error(
      `Cannot delete route "${route.name}": It has ${assignedTeamsCount} teams assigned. Reassign them first or deactivate the route.`
    );
  }

  await Route.deleteOne({ _id: routeId });

  await AuditLog.create({
    action: "ROUTE_DELETED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({ routeId, name: route.name }),
  });

  return {
    success: true,
    message: `Route "${route.name}" deleted.`,
  };
}

/**
 * Generates N mathematically valid, distinct, circular-spaced routes for 10-checkpoint event.
 * Steps 1..8: Permutations of 1..8 using circular shifts and coprime step strides.
 * Step 9: Checkpoint 9.
 * Step 10: Checkpoint 10 (Final Treasure).
 */
export function generateDistinctRoutes(count: number): Array<{ name: string; sequence: number[] }> {
  const base = [1, 2, 3, 4, 5, 6, 7, 8];
  const routes: Array<{ name: string; sequence: number[] }> = [];
  const seen = new Set<string>();
  const strides = [1, 3, 5, 7, 2];
  const directions = [1, -1];

  for (const stride of strides) {
    for (const dir of directions) {
      for (let startIdx = 0; startIdx < 8; startIdx++) {
        if (routes.length >= count) break;
        const seq: number[] = [];
        const used = new Set<number>();
        let curr = startIdx;
        while (seq.length < 8) {
          const val = base[curr];
          if (!used.has(val)) {
            seq.push(val);
            used.add(val);
          }
          curr = (curr + dir * stride + 80) % 8;
        }
        for (const b of base) {
          if (!used.has(b)) seq.push(b);
        }
        const fullSequence = [...seq, 9, 10];
        const key = fullSequence.join(",");
        if (!seen.has(key)) {
          seen.add(key);
          const routeNum = String(routes.length + 1).padStart(2, "0");
          routes.push({
            name: `Route ${routeNum}`,
            sequence: fullSequence,
          });
        }
      }
      if (routes.length >= count) break;
    }
    if (routes.length >= count) break;
  }

  // Fallback seed generator if count > 80
  let seed = 42;
  while (routes.length < count) {
    const arr = [...base];
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const fullSequence = [...arr, 9, 10];
    const key = fullSequence.join(",");
    if (!seen.has(key)) {
      seen.add(key);
      const routeNum = String(routes.length + 1).padStart(2, "0");
      routes.push({
        name: `Route ${routeNum}`,
        sequence: fullSequence,
      });
    }
  }

  return routes;
}

/**
 * Dynamically scales routes so that at most 2 teams share any route.
 * Generates N/2 distinct, fair-distance, circular-shifted routes ending in [9, 10].
 * Automatically reassigns teams evenly across these routes.
 */
export async function autoScaleTwoTeamsPerRoute(adminId: string) {
  await connectToDatabase();
  const teams = await Team.find({ status: { $ne: "DISQUALIFIED" } }).sort({ createdAt: 1 });
  if (teams.length === 0) {
    throw new Error("No registered teams found. Please register teams before auto-scaling routes.");
  }

  const routeCount = Math.max(4, Math.ceil(teams.length / 2));
  const distinctRoutes = generateDistinctRoutes(routeCount);

  // Clear existing routes and recreate
  await Route.deleteMany({});

  const createdRoutes = [];
  for (const r of distinctRoutes) {
    const doc = await Route.create({
      name: r.name,
      description: `Auto-generated balanced pair route (Max 2 teams)`,
      checkpointSequence: JSON.stringify(r.sequence),
      active: true,
    });
    createdRoutes.push(doc);
  }

  // Assign exactly 2 teams per route
  for (let i = 0; i < teams.length; i++) {
    const routeIndex = Math.floor(i / 2) % createdRoutes.length;
    const targetRoute = createdRoutes[routeIndex];
    teams[i].routeId = String(targetRoute._id);
    await teams[i].save();
  }

  // Invalidate any in-memory route caches
  invalidateRouteCache();

  await AuditLog.create({
    action: "ROUTES_AUTO_SCALED_PAIR",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({
      totalTeams: teams.length,
      routeCount: createdRoutes.length,
      maxTeamsPerRoute: 2,
    }),
  });

  return {
    success: true,
    totalTeams: teams.length,
    routeCount: createdRoutes.length,
    message: `Generated ${createdRoutes.length} balanced routes for ${teams.length} teams. Exactly 2 teams per route!`,
  };
}
