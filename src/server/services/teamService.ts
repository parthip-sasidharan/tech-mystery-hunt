import { connectToDatabase } from "../db";
import { Team, Registration, Route, Checkpoint, AuditLog, PrizeClaim, TeamProgress } from "../models";
import { hashPassword } from "../auth";
import { getCheckpointCount, getConfig } from "./gameService";
import { allocateNextAvailableTeamId, assignSpecificTeamId } from "./teamIdService";
import { validateRouteSequence } from "./routeAdminService";

/**
 * Gets the current registration workflow mode.
 * "AUTO_APPROVE" (default) or "MANUAL_APPROVAL"
 */
export async function getRegistrationWorkflow(): Promise<"AUTO_APPROVE" | "MANUAL_APPROVAL"> {
  const mode = await getConfig("REGISTRATION_WORKFLOW", "AUTO_APPROVE");
  return mode === "MANUAL_APPROVAL" ? "MANUAL_APPROVAL" : "AUTO_APPROVE";
}

export interface ValidRouteInfo {
  id: string;
  name: string;
  sequence: number[];
  teamCount: number;
}

/**
 * Discovers and validates all active routes against current checkpoint definitions.
 * Filters out incomplete, deactivated, or invalid routes.
 */
export async function getValidActiveRoutes(): Promise<ValidRouteInfo[]> {
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

  const activeRoutes = await Route.find({ active: true }).lean();
  const validRoutes: ValidRouteInfo[] = [];

  for (const r of activeRoutes) {
    let parsedSeq: number[] = [];
    try {
      parsedSeq = JSON.parse(r.checkpointSequence);
    } catch {
      continue;
    }

    const val = validateRouteSequence(parsedSeq, totalConfigured, regularSeqNumbers, finalSeq);
    if (val.isValid) {
      const teamCount = await Team.countDocuments({ routeId: String(r._id) });
      validRoutes.push({
        id: String(r._id),
        name: r.name,
        sequence: parsedSeq,
        teamCount,
      });
    }
  }

  return validRoutes;
}

/**
 * Assigns an optimal route to balance crowd distribution across campus checkpoints.
 * Finds the valid active route with the lowest currently assigned team count.
 * Uses deterministic tie-breaking (route ID string) when counts are equal.
 */
export async function assignBalancedRoute(): Promise<{ id: string; name: string } | null> {
  const validRoutes = await getValidActiveRoutes();
  if (validRoutes.length === 0) return null;

  // Deterministic sort: lowest assigned count first, then by route ID
  validRoutes.sort((a, b) => {
    if (a.teamCount !== b.teamCount) {
      return a.teamCount - b.teamCount;
    }
    return a.id.localeCompare(b.id);
  });

  return { id: validRoutes[0].id, name: validRoutes[0].name };
}

/**
 * Previews automatic route assignments for all unassigned teams.
 * Calculates projected balance before applying changes.
 */
export async function previewAutoAssignUnassignedTeams() {
  await connectToDatabase();
  const validRoutes = await getValidActiveRoutes();
  if (validRoutes.length === 0) {
    throw new Error("No valid active routes exist. Please configure and validate routes before assigning teams.");
  }

  const validRouteIds = new Set(validRoutes.map((r) => r.id));
  const allTeams = await Team.find({}).sort({ teamId: 1, createdAt: 1 }).lean();

  const unassignedTeams = allTeams.filter(
    (t) => !t.routeId || !validRouteIds.has(String(t.routeId))
  );

  // Clone route counts for simulation
  const simulatedRoutes = validRoutes.map((r) => ({
    id: r.id,
    name: r.name,
    currentCount: r.teamCount,
    projectedCount: r.teamCount,
  }));

  const proposedAssignments = unassignedTeams.map((team) => {
    // Pick route with lowest projected count, tie-breaker by ID
    simulatedRoutes.sort((a, b) => {
      if (a.projectedCount !== b.projectedCount) {
        return a.projectedCount - b.projectedCount;
      }
      return a.id.localeCompare(b.id);
    });

    const chosen = simulatedRoutes[0];
    chosen.projectedCount++;

    return {
      teamObjectId: String(team._id),
      teamId: team.teamId,
      teamName: team.name,
      currentRouteId: team.routeId ? String(team.routeId) : null,
      proposedRouteId: chosen.id,
      proposedRouteName: chosen.name,
    };
  });

  return {
    unassignedCount: unassignedTeams.length,
    proposedAssignments,
    availableRoutes: simulatedRoutes,
  };
}

/**
 * Automatically assigns or repairs balanced routes for all unassigned teams in bulk.
 */
export async function autoAssignUnassignedTeams(adminId: string) {
  await connectToDatabase();
  const preview = await previewAutoAssignUnassignedTeams();

  if (preview.unassignedCount === 0) {
    return {
      success: true,
      assignedCount: 0,
      message: "All teams already have valid active routes assigned.",
      assignments: [],
    };
  }

  const assignmentsApplied: Array<{ teamId: string; teamName: string; routeName: string }> = [];

  for (const item of preview.proposedAssignments) {
    await Team.findByIdAndUpdate(item.teamObjectId, {
      $set: { routeId: item.proposedRouteId },
    });

    await AuditLog.create({
      action: "TEAM_ROUTE_AUTO_ASSIGNED",
      actorRole: "ADMIN",
      actorId: adminId,
      details: JSON.stringify({
        teamObjectId: item.teamObjectId,
        teamId: item.teamId,
        teamName: item.teamName,
        routeId: item.proposedRouteId,
        routeName: item.proposedRouteName,
      }),
    });

    assignmentsApplied.push({
      teamId: item.teamId,
      teamName: item.teamName,
      routeName: item.proposedRouteName,
    });
  }

  return {
    success: true,
    assignedCount: assignmentsApplied.length,
    message: `Successfully balanced and assigned routes for ${assignmentsApplied.length} teams.`,
    assignments: assignmentsApplied,
  };
}

/**
 * Assigns or reassigns a specific route to an individual team.
 * Strictly blocks reassignment if mission has already started, unless an override reason is provided.
 */
export async function assignRouteToTeam(
  teamObjectId: string,
  routeId: string,
  adminId: string,
  recoveryReason?: string
) {
  await connectToDatabase();

  const team = await Team.findById(teamObjectId);
  if (!team) throw new Error("Team not found.");

  const targetRoute = await Route.findOne({ _id: routeId }).lean();
  if (!targetRoute || !targetRoute.active) {
    throw new Error("Target route does not exist or is inactive.");
  }

  // Validate the target route meets current checkpoint configuration
  const validRoutes = await getValidActiveRoutes();
  const isValid = validRoutes.some((r) => r.id === String(targetRoute._id));
  if (!isValid) {
    throw new Error(`Route "${targetRoute.name}" does not satisfy the current event checkpoint configuration.`);
  }

  // Check if team has already started mission
  const hasProgress = await TeamProgress.countDocuments({
    teamId: String(team._id),
    $or: [{ qrValidated: true }, { attemptsCount: { $gt: 0 } }],
  });

  const hasStarted = team.status === "IN_PROGRESS" || team.currentCheckpointIndex > 0 || hasProgress > 0;

  if (hasStarted) {
    const trimmedReason = recoveryReason?.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      throw new Error(
        "Team has already commenced its mission. Route modification is strictly blocked unless an authorized emergency recovery reason (at least 5 characters) is provided."
      );
    }

    const previousRouteId = team.routeId;
    team.routeId = String(targetRoute._id);
    await team.save();

    await AuditLog.create({
      action: "TEAM_ROUTE_REASSIGNMENT_OVERRIDE",
      actorRole: "ADMIN",
      actorId: adminId,
      details: JSON.stringify({
        teamId: team.teamId,
        teamName: team.name,
        previousRouteId,
        newRouteId: String(targetRoute._id),
        newRouteName: targetRoute.name,
        recoveryReason: trimmedReason,
      }),
    });

    return {
      success: true,
      teamId: team.teamId,
      routeName: targetRoute.name,
      overrideApplied: true,
      message: `Emergency route reassignment applied to ${team.teamId} ("${targetRoute.name}"). Reason logged to audit trail.`,
    };
  }

  // Team has not started: normal safe assignment
  const previousRouteId = team.routeId;
  team.routeId = String(targetRoute._id);
  await team.save();

  await AuditLog.create({
    action: "TEAM_ROUTE_ASSIGNED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({
      teamId: team.teamId,
      teamName: team.name,
      previousRouteId,
      newRouteId: String(targetRoute._id),
      newRouteName: targetRoute.name,
    }),
  });

  return {
    success: true,
    teamId: team.teamId,
    routeName: targetRoute.name,
    overrideApplied: false,
    message: `Route "${targetRoute.name}" successfully assigned to ${team.teamId}.`,
  };
}

export interface RegisterTeamInput {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  password: string;
  members: Array<{ name: string; collegeId: string; phone?: string }>;
}

/**
 * Online team self-registration.
 * Respects REGISTRATION_WORKFLOW:
 * - If AUTO_APPROVE: creates Registration (APPROVED), allocates Team ID, creates Team.
 * - If MANUAL_APPROVAL: creates Registration (PENDING) awaiting organizer approval.
 */
export async function registerTeam(input: RegisterTeamInput) {
  await connectToDatabase();

  const cleanTeamName = input.teamName.trim();
  const cleanEmail = input.leaderEmail.trim().toLowerCase();

  // Check if team name or leader email already exists in Team or Registration
  const [existingTeam, existingReg] = await Promise.all([
    Team.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${cleanTeamName}$`, "i") } },
        { leaderEmail: cleanEmail },
      ],
    }).lean(),
    Registration.findOne({
      status: { $in: ["PENDING", "APPROVED"] },
      $or: [
        { teamName: { $regex: new RegExp(`^${cleanTeamName}$`, "i") } },
        { leaderEmail: cleanEmail },
      ],
    }).lean(),
  ]);

  if (existingTeam || existingReg) {
    const matchName =
      (existingTeam && existingTeam.name.toLowerCase() === cleanTeamName.toLowerCase()) ||
      (existingReg && existingReg.teamName.toLowerCase() === cleanTeamName.toLowerCase());

    if (matchName) {
      throw new Error("A team with this name is already registered or pending approval.");
    }
    throw new Error("A team with this leader email is already registered or pending approval.");
  }

  const passwordHash = await hashPassword(input.password);
  const workflow = await getRegistrationWorkflow();

  // If MANUAL_APPROVAL: store as PENDING Registration
  if (workflow === "MANUAL_APPROVAL") {
    const reg = await Registration.create({
      teamName: cleanTeamName,
      leaderName: input.leaderName.trim(),
      leaderEmail: cleanEmail,
      leaderPhone: input.leaderPhone.trim(),
      membersJson: JSON.stringify(input.members),
      passwordHash,
      status: "PENDING",
      registrationType: "ONLINE",
      allocatedTeamId: null,
      approvedTeamId: null,
    });

    await AuditLog.create({
      action: "REGISTRATION_SUBMITTED_PENDING",
      actorRole: "TEAM",
      actorId: String(reg._id),
      details: JSON.stringify({ teamName: reg.teamName, leaderEmail: reg.leaderEmail }),
    });

    return {
      autoApproved: false,
      pendingApproval: true,
      registrationId: String(reg._id),
      teamName: reg.teamName,
      leaderName: reg.leaderName,
      leaderEmail: reg.leaderEmail,
      message: "Registration submitted successfully! Your team is pending organizer approval.",
    };
  }

  // AUTO_APPROVE workflow:
  const routeInfo = await assignBalancedRoute();

  // First create the Team document to acquire its ObjectId
  const newTeam = new Team({
    teamId: "PENDING_ALLOCATION",
    name: cleanTeamName,
    leaderName: input.leaderName.trim(),
    leaderEmail: cleanEmail,
    leaderPhone: input.leaderPhone.trim(),
    members: JSON.stringify(input.members),
    passwordHash,
    routeId: routeInfo ? routeInfo.id : null,
    status: "WAITING",
    currentCheckpointIndex: 0,
    currentStage: "WAITING_ROOM",
  });

  await newTeam.save();

  // Concurrency-safe atomic Team ID allocation
  const teamId = await allocateNextAvailableTeamId(String(newTeam._id), cleanTeamName);
  newTeam.teamId = teamId;
  await newTeam.save();

  // Create Registration record for auditing and records
  await Registration.create({
    teamName: cleanTeamName,
    leaderName: input.leaderName.trim(),
    leaderEmail: cleanEmail,
    leaderPhone: input.leaderPhone.trim(),
    membersJson: JSON.stringify(input.members),
    passwordHash,
    status: "APPROVED",
    registrationType: "ONLINE",
    allocatedTeamId: teamId,
    approvedTeamId: String(newTeam._id),
  });

  await AuditLog.create({
    action: "TEAM_REGISTERED_AUTO_APPROVED",
    actorRole: "TEAM",
    actorId: String(newTeam._id),
    details: JSON.stringify({ teamId, name: newTeam.name, route: routeInfo?.name }),
  });

  return {
    autoApproved: true,
    pendingApproval: false,
    id: String(newTeam._id),
    teamId: newTeam.teamId,
    name: newTeam.name,
    leaderName: newTeam.leaderName,
    leaderEmail: newTeam.leaderEmail,
    routeName: routeInfo?.name ?? "Pending Assignment",
  };
}

/**
 * Approves a pending team registration (Admin action).
 */
export async function approvePendingRegistration(
  registrationId: string,
  adminId: string,
  specificTeamId?: string
) {
  await connectToDatabase();

  const reg = await Registration.findById(registrationId);
  if (!reg) throw new Error("Registration record not found.");

  if (reg.status !== "PENDING") {
    throw new Error(`Registration is already ${reg.status.toLowerCase()}.`);
  }

  // Check if team name or email was taken in the meantime
  const collision = await Team.findOne({
    $or: [{ name: reg.teamName }, { leaderEmail: reg.leaderEmail }],
  });
  if (collision) {
    throw new Error("Cannot approve: A team with this name or leader email is already active.");
  }

  const routeInfo = await assignBalancedRoute();

  const team = new Team({
    teamId: "PENDING_ALLOCATION",
    name: reg.teamName,
    leaderName: reg.leaderName,
    leaderEmail: reg.leaderEmail,
    leaderPhone: reg.leaderPhone,
    members: reg.membersJson,
    passwordHash: reg.passwordHash,
    routeId: routeInfo ? routeInfo.id : null,
    status: "WAITING",
    currentCheckpointIndex: 0,
    currentStage: "WAITING_ROOM",
  });
  await team.save();

  // Allocate Team ID (specific or next available)
  const teamId = specificTeamId
    ? await assignSpecificTeamId(specificTeamId, String(team._id), team.name)
    : await allocateNextAvailableTeamId(String(team._id), team.name);

  team.teamId = teamId;
  await team.save();

  reg.status = "APPROVED";
  reg.allocatedTeamId = teamId;
  reg.approvedTeamId = String(team._id);
  reg.approvedBy = adminId;
  await reg.save();

  await AuditLog.create({
    action: "REGISTRATION_APPROVED_BY_ADMIN",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({ registrationId, teamId, teamName: team.name }),
  });

  return {
    success: true,
    teamId: team.teamId,
    teamName: team.name,
    leaderEmail: team.leaderEmail,
    routeName: routeInfo?.name ?? "Assigned",
  };
}

/**
 * Rejects a pending team registration (Admin action).
 */
export async function rejectPendingRegistration(
  registrationId: string,
  adminId: string,
  rejectionNote?: string
) {
  await connectToDatabase();

  const reg = await Registration.findById(registrationId);
  if (!reg) throw new Error("Registration record not found.");

  if (reg.status !== "PENDING") {
    throw new Error(`Registration is already ${reg.status.toLowerCase()}.`);
  }

  reg.status = "REJECTED";
  reg.rejectionNote = rejectionNote || "Registration not approved by organizer.";
  reg.approvedBy = adminId;
  await reg.save();

  await AuditLog.create({
    action: "REGISTRATION_REJECTED_BY_ADMIN",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({ registrationId, teamName: reg.teamName, reason: reg.rejectionNote }),
  });

  return {
    success: true,
    registrationId,
    teamName: reg.teamName,
    status: "REJECTED",
  };
}

export interface SpotRegistrationInput {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  password?: string;
  specificTeamId?: string;
  routeId?: string;
  members: Array<{ name: string; collegeId: string; phone?: string }>;
}

/**
 * Authorized Spot Registration performed by Admin / Volunteer on-site.
 * Instantly issues credentials and assigns a Team ID.
 */
export async function createSpotRegistration(input: SpotRegistrationInput, staffUserId: string) {
  await connectToDatabase();

  const cleanTeamName = input.teamName.trim();
  const cleanEmail = input.leaderEmail.trim().toLowerCase();

  const existingTeam = await Team.findOne({
    $or: [{ name: cleanTeamName }, { leaderEmail: cleanEmail }],
  });
  if (existingTeam) {
    throw new Error("A team with this name or leader email is already registered.");
  }

  // Use provided password or generate a secure temporary password
  const rawPassword = input.password && input.password.length >= 6
    ? input.password
    : `Hunt#${Math.floor(1000 + Math.random() * 9000)}`;

  const passwordHash = await hashPassword(rawPassword);

  let routeId = input.routeId;
  let routeName = "Auto Assigned";
  if (!routeId) {
    const routeInfo = await assignBalancedRoute();
    if (routeInfo) {
      routeId = routeInfo.id;
      routeName = routeInfo.name;
    }
  } else {
    const r = await Route.findOne({ _id: routeId }).lean();
    if (r) routeName = r.name;
  }

  const team = new Team({
    teamId: "PENDING_ALLOCATION",
    name: cleanTeamName,
    leaderName: input.leaderName.trim(),
    leaderEmail: cleanEmail,
    leaderPhone: input.leaderPhone.trim(),
    members: JSON.stringify(input.members),
    passwordHash,
    routeId: routeId || null,
    status: "WAITING",
    currentCheckpointIndex: 0,
    currentStage: "WAITING_ROOM",
  });
  await team.save();

  // Concurrency-safe Team ID allocation
  const teamId = input.specificTeamId
    ? await assignSpecificTeamId(input.specificTeamId, String(team._id), team.name)
    : await allocateNextAvailableTeamId(String(team._id), team.name);

  team.teamId = teamId;
  await team.save();

  // Create Registration record for auditing
  await Registration.create({
    teamName: cleanTeamName,
    leaderName: input.leaderName.trim(),
    leaderEmail: cleanEmail,
    leaderPhone: input.leaderPhone.trim(),
    membersJson: JSON.stringify(input.members),
    passwordHash,
    status: "APPROVED",
    registrationType: "SPOT",
    allocatedTeamId: teamId,
    approvedTeamId: String(team._id),
    approvedBy: staffUserId,
  });

  await AuditLog.create({
    action: "SPOT_REGISTRATION_CREATED",
    actorRole: "ADMIN",
    actorId: staffUserId,
    details: JSON.stringify({ teamId, teamName: cleanTeamName, routeName }),
  });

  return {
    success: true,
    teamId,
    teamName: cleanTeamName,
    leaderName: team.leaderName,
    leaderEmail: cleanEmail,
    leaderPhone: team.leaderPhone,
    routeName,
    initialPassword: rawPassword, // returned once for physical printout / handover slip
  };
}

/**
 * Changes team operational status (e.g. WAITING, IN_PROGRESS, DISQUALIFIED).
 */
export async function updateTeamStatus(
  teamObjectId: string,
  newStatus: "REGISTERED" | "WAITING" | "IN_PROGRESS" | "COMPLETED" | "DISQUALIFIED",
  adminId: string,
  reason?: string
) {
  await connectToDatabase();

  const team = await Team.findById(teamObjectId);
  if (!team) throw new Error("Team not found.");

  const oldStatus = team.status;
  team.status = newStatus;
  await team.save();

  await AuditLog.create({
    action: "TEAM_STATUS_UPDATED",
    actorRole: "ADMIN",
    actorId: adminId,
    details: JSON.stringify({
      teamId: team.teamId,
      teamName: team.name,
      oldStatus,
      newStatus,
      reason,
    }),
  });

  return {
    success: true,
    teamId: team.teamId,
    oldStatus,
    newStatus,
  };
}

/**
 * Lists registrations with status filter for the Admin Dashboard.
 */
export async function listRegistrations(status?: string) {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (status && status !== "ALL") {
    query.status = status;
  }

  const registrations = await Registration.find(query).sort({ createdAt: -1 }).lean();

  return registrations.map((r) => {
    let parsedMembers: unknown[] = [];
    try {
      parsedMembers = JSON.parse(r.membersJson);
    } catch {
      parsedMembers = [];
    }

    return {
      id: String(r._id),
      teamName: r.teamName,
      leaderName: r.leaderName,
      leaderEmail: r.leaderEmail,
      leaderPhone: r.leaderPhone,
      members: parsedMembers,
      status: r.status,
      registrationType: r.registrationType || "ONLINE",
      allocatedTeamId: r.allocatedTeamId || null,
      approvedTeamId: r.approvedTeamId || null,
      rejectionNote: r.rejectionNote || null,
      createdAt: r.createdAt,
    };
  });
}

export async function getTeamProfile(id: string) {
  await connectToDatabase();

  const team = await Team.findById(id).lean();
  if (!team) return null;

  let routeName = "Unassigned";
  if (team.routeId) {
    const route = await Route.findOne({ _id: team.routeId }).lean();
    if (route) {
      routeName = route.name;
    } else {
      routeName = "Invalid Route";
    }
  }

  const prizeClaim = await PrizeClaim.findOne({ teamId: String(team._id) }).lean();
  const completedCheckpointsCount = await TeamProgress.countDocuments({
    teamId: String(team._id),
    isAnswerCorrect: true,
  });

  const totalCheckpoints = await getCheckpointCount();
  let parsedMembers: Array<{ name: string; collegeId: string; phone?: string }> = [];
  try {
    parsedMembers = JSON.parse(team.members);
  } catch {
    parsedMembers = [];
  }

  return {
    id: String(team._id),
    teamId: team.teamId,
    name: team.name,
    leaderName: team.leaderName,
    leaderEmail: team.leaderEmail,
    leaderPhone: team.leaderPhone,
    members: parsedMembers,
    status: team.status,
    routeId: team.routeId || null,
    currentCheckpointIndex: team.currentCheckpointIndex,
    currentStage: team.currentStage,
    routeName,
    completedCheckpointsCount,
    totalConfiguredCheckpoints: totalCheckpoints,
    prizeClaim: prizeClaim
      ? {
          boxNumber: prizeClaim.boxNumber,
          claimCode: prizeClaim.claimCode,
          status: prizeClaim.status,
          claimedAt: prizeClaim.claimedAt,
          verifiedAt: prizeClaim.verifiedAt,
        }
      : null,
  };
}

export async function listAllTeamsForAdmin() {
  await connectToDatabase();

  const teams = await Team.find({}).sort({ createdAt: -1 }).lean();
  const totalCheckpoints = await getCheckpointCount();

  const routes = await Route.find({}).lean();
  const routeMap = new Map<string, { name: string; active: boolean; sequence: number[] }>();
  for (const r of routes) {
    let seq: number[] = [];
    try {
      seq = JSON.parse(r.checkpointSequence);
    } catch {
      seq = [];
    }
    const item = { name: r.name, active: r.active, sequence: seq };
    routeMap.set(String(r._id), item);
    routeMap.set(r.name, item);
  }

  return Promise.all(
    teams.map(async (t) => {
      let parsedMembers: unknown[] = [];
      try {
        parsedMembers = JSON.parse(t.members);
      } catch {
        parsedMembers = [];
      }

      const completedCount = await TeamProgress.countDocuments({
        teamId: String(t._id),
        isAnswerCorrect: true,
      });

      const prizeClaim = await PrizeClaim.findOne({ teamId: String(t._id) }).lean();
      const routeInfo = t.routeId ? routeMap.get(String(t.routeId)) || routeMap.get(t.routeId) : null;
      const sequence = routeInfo ? routeInfo.sequence : [];

      const effectiveCompletedCount =
        t.status === "COMPLETED" || t.currentStage === "FINISHED"
          ? totalCheckpoints
          : Math.max(completedCount, t.currentCheckpointIndex ?? 0);

      return {
        id: String(t._id),
        teamId: t.teamId,
        name: t.name,
        leaderName: t.leaderName,
        leaderEmail: t.leaderEmail,
        leaderPhone: t.leaderPhone,
        memberCount: parsedMembers.length + 1,
        status: t.status,
        routeId: t.routeId || null,
        routeSequence: sequence,
        currentCheckpointIndex: t.currentCheckpointIndex ?? 0,
        currentStage: t.currentStage,
        routeName: routeInfo ? routeInfo.name : "Unassigned",
        isRouteValid: !!routeInfo?.active,
        completedCount: effectiveCompletedCount,
        totalCount: totalCheckpoints,
        prizeClaim: prizeClaim
          ? {
              boxNumber: prizeClaim.boxNumber,
              claimCode: prizeClaim.claimCode,
              status: prizeClaim.status,
            }
          : null,
        createdAt: t.createdAt,
      };
    })
  );
}
