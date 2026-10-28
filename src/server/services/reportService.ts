import { connectToDatabase } from "../db";
import {
  Team,
  Registration,
  Checkpoint,
  Question,
  TeamProgress,
  PrizeClaim,
  Route,
  User,
  TeamIdPool,
} from "../models";
import { getGameStatus, getCheckpointCount } from "./gameService";
import { getTeamIdStats } from "./teamIdService";

export interface MasterOverviewStats {
  gameStatus: string;
  checkpointCount: number;
  teams: {
    total: number;
    pending: number;
    approved: number;
    waiting: number;
    inProgress: number;
    treasureSearch: number;
    completed: number;
    disqualified: number;
    unassigned: number;
  };
  teamIds: {
    totalPool: number;
    available: number;
    assigned: number;
    disabled: number;
    reserved: number;
  };
  prizeBoxes: Array<{
    boxNumber: number;
    status: "AVAILABLE" | "PENDING_VERIFICATION" | "CONFIRMED";
    teamId: string | null;
    teamName: string | null;
    claimCode: string | null;
    claimedAt: string | null;
    verifiedBy: string | null;
  }>;
  allBoxesClaimed: boolean;
  prizeHistory: Array<{
    id: string;
    boxNumber: number;
    claimCode: string;
    status: string;
    claimedAt: string | null;
    verifiedBy: string | null;
    verifiedAt: string | null;
    notes: string | null;
    teamId: string;
    teamName: string;
  }>;
  checkpointStats: Array<{
    sequenceNumber: number;
    name: string;
    campusArea: string;
    isFinalTreasure: boolean;
    active: boolean;
    teamsVisited: number;
    teamsSolved: number;
    teamsCurrentlyHere: number;
    solveRatePercent: number;
  }>;
}

/**
 * Aggregates all master event statistics in real-time directly from MongoDB.
 */
export async function getMasterOverviewStats(): Promise<MasterOverviewStats> {
  await connectToDatabase();

  const [
    gameStatus,
    checkpointCount,
    allTeams,
    pendingRegistrationsCount,
    idStats,
    checkpoints,
    prizeClaims,
    allProgress,
    allUsers,
  ] = await Promise.all([
    getGameStatus(),
    getCheckpointCount(),
    Team.find({}).lean(),
    Registration.countDocuments({ status: "PENDING" }),
    getTeamIdStats(),
    Checkpoint.find({}).sort({ sequenceNumber: 1 }).lean(),
    PrizeClaim.find({}).lean(),
    TeamProgress.find({}).lean(),
    User.find({}).select("username name").lean(),
  ]);

  const userMap = new Map<string, string>();
  for (const u of allUsers) {
    userMap.set(String(u._id), u.name ? `${u.name} (@${u.username})` : u.username);
  }

  // Team metrics
  const teams = {
    total: allTeams.length,
    pending: pendingRegistrationsCount,
    approved: allTeams.filter((t) => t.status !== "DISQUALIFIED").length,
    waiting: allTeams.filter((t) => t.status === "WAITING" || t.status === "REGISTERED").length,
    inProgress: allTeams.filter((t) => t.status === "IN_PROGRESS").length,
    treasureSearch: allTeams.filter((t) => t.currentStage === "TREASURE_SEARCH").length,
    completed: allTeams.filter((t) => t.status === "COMPLETED" || t.currentStage === "FINISHED").length,
    disqualified: allTeams.filter((t) => t.status === "DISQUALIFIED").length,
    unassigned: allTeams.filter((t) => !t.routeId && t.status !== "DISQUALIFIED").length,
  };

  // Prize Boxes (1, 2, 3)
  const prizeBoxes = [1, 2, 3].map((boxNumber) => {
    // Prefer CONFIRMED claim, fallback to PENDING_VERIFICATION
    const confirmedClaim = prizeClaims.find((c) => c.boxNumber === boxNumber && c.status === "CONFIRMED");
    const pendingClaim = prizeClaims.find((c) => c.boxNumber === boxNumber && c.status === "PENDING_VERIFICATION");
    const activeClaim = confirmedClaim || pendingClaim;

    if (!activeClaim) {
      return {
        boxNumber,
        status: "AVAILABLE" as const,
        teamId: null,
        teamName: null,
        claimCode: null,
        claimedAt: null,
        verifiedBy: null,
        verifiedAt: null,
        notes: null,
      };
    }

    const claimingTeam = allTeams.find((t) => String(t._id) === String(activeClaim.teamId));

    return {
      boxNumber,
      status: activeClaim.status as "PENDING_VERIFICATION" | "CONFIRMED",
      claimId: String(activeClaim._id),
      teamId: claimingTeam ? claimingTeam.teamId : null,
      teamName: claimingTeam ? claimingTeam.name : "Unknown Team",
      claimCode: activeClaim.claimCode,
      claimedAt: activeClaim.claimedAt ? new Date(activeClaim.claimedAt).toISOString() : null,
      verifiedBy: activeClaim.volunteerId ? userMap.get(activeClaim.volunteerId) || "Authorized Staff" : null,
      verifiedAt: activeClaim.verifiedAt ? new Date(activeClaim.verifiedAt).toISOString() : null,
      notes: activeClaim.volunteerNotes || null,
    };
  });

  const allBoxesClaimed = prizeBoxes.every((b) => b.status === "CONFIRMED");

  const prizeHistory = prizeClaims.map((c) => {
    const t = allTeams.find((team) => String(team._id) === String(c.teamId));
    return {
      id: String(c._id),
      boxNumber: c.boxNumber,
      claimCode: c.claimCode,
      status: c.status,
      claimedAt: c.claimedAt ? new Date(c.claimedAt).toISOString() : null,
      verifiedBy: c.volunteerId ? userMap.get(c.volunteerId) || "Authorized Staff" : null,
      verifiedAt: c.verifiedAt ? new Date(c.verifiedAt).toISOString() : null,
      notes: c.volunteerNotes || c.releaseReason || null,
      teamId: t?.teamId || "UNKNOWN",
      teamName: t?.name || "Unknown Team",
    };
  });

  // Checkpoint statistics
  const checkpointStats = checkpoints.map((cp) => {
    const cpId = String(cp._id);
    const relatedProgress = allProgress.filter((p) => p.checkpointId === cpId);
    const teamsVisited = relatedProgress.filter((p) => p.qrValidated).length;
    const teamsSolved = relatedProgress.filter((p) => p.isAnswerCorrect).length;

    // Teams currently active at this checkpoint sequence
    const teamsCurrentlyHere = allTeams.filter((t) => {
      if (t.status !== "IN_PROGRESS") return false;
      return t.currentCheckpointIndex + 1 === cp.sequenceNumber;
    }).length;

    const solveRatePercent =
      teamsVisited > 0 ? Math.round((teamsSolved / teamsVisited) * 100) : 0;

    return {
      sequenceNumber: cp.sequenceNumber,
      name: cp.name,
      campusArea: cp.campusArea,
      isFinalTreasure: cp.isFinalTreasure,
      active: cp.active !== false,
      teamsVisited,
      teamsSolved,
      teamsCurrentlyHere,
      solveRatePercent,
    };
  });

  return {
    gameStatus,
    checkpointCount,
    teams,
    teamIds: {
      totalPool: idStats.totalPool,
      available: idStats.available,
      assigned: idStats.assigned,
      disabled: idStats.disabled,
      reserved: idStats.reserved,
    },
    prizeBoxes,
    allBoxesClaimed,
    prizeHistory,
    checkpointStats,
  };
}

/**
 * Generates structured report tables for Admin review or data exports.
 */
export async function getMasterEventReports() {
  await connectToDatabase();

  const [allTeams, registrations, checkpoints, questions, prizeClaims, routes, volunteers] =
    await Promise.all([
      Team.find({}).sort({ currentCheckpointIndex: -1, completedAt: 1 }).lean(),
      Registration.find({}).sort({ createdAt: -1 }).lean(),
      Checkpoint.find({}).sort({ sequenceNumber: 1 }).lean(),
      Question.find({}).lean(),
      PrizeClaim.find({}).lean(),
      Route.find({}).lean(),
      User.find({ role: "VOLUNTEER" }).lean(),
    ]);

  const routeMap = new Map(routes.map((r) => [String(r._id), r.name]));
  const volunteerMap = new Map(volunteers.map((v) => [String(v._id), v.name || v.username]));

  // 1. Team Progress Report
  const teamProgressReport = allTeams.map((t, idx) => {
    const claim = prizeClaims.find((c) => String(c.teamId) === String(t._id));
    let members = [];
    try {
      members = JSON.parse(t.members);
    } catch {
      members = [];
    }

    const durationMinutes =
      t.startedAt && t.completedAt
        ? Math.round((new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime()) / 60000)
        : null;

    return {
      rank: idx + 1,
      id: String(t._id),
      teamId: t.teamId,
      name: t.name,
      leaderName: t.leaderName,
      leaderEmail: t.leaderEmail,
      leaderPhone: t.leaderPhone,
      memberCount: members.length + 1,
      routeName: t.routeId ? routeMap.get(t.routeId) || "Custom Route" : "Unassigned",
      status: t.status,
      currentStage: t.currentStage,
      completedCheckpoints:
        t.status === "COMPLETED" || t.currentStage === "FINISHED"
          ? checkpoints.length
          : (t.currentCheckpointIndex ?? 0),
      prizeClaim: claim
        ? {
            boxNumber: claim.boxNumber,
            claimCode: claim.claimCode,
            status: claim.status,
          }
        : null,
      startedAt: t.startedAt ? new Date(t.startedAt).toISOString() : null,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
      durationMinutes,
    };
  });

  // 2. Registrations Report
  const registrationsReport = registrations.map((r) => {
    let crew = [];
    try {
      crew = JSON.parse(r.membersJson);
    } catch {
      crew = [];
    }

    return {
      id: String(r._id),
      teamName: r.teamName,
      leaderName: r.leaderName,
      leaderEmail: r.leaderEmail,
      leaderPhone: r.leaderPhone,
      memberCount: crew.length + 1,
      status: r.status,
      registrationType: r.registrationType || "ONLINE",
      allocatedTeamId: r.allocatedTeamId || null,
      rejectionNote: r.rejectionNote || null,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  });

  // 3. Prize Claims Report
  const prizeClaimsReport = prizeClaims.map((c) => {
    const team = allTeams.find((t) => String(t._id) === String(c.teamId));
    return {
      id: String(c._id),
      boxNumber: c.boxNumber,
      claimCode: c.claimCode,
      status: c.status,
      teamId: team?.teamId || "N/A",
      teamName: team?.name || "Unknown Team",
      leaderPhone: team?.leaderPhone || "N/A",
      claimedAt: new Date(c.claimedAt).toISOString(),
      verifiedAt: c.verifiedAt ? new Date(c.verifiedAt).toISOString() : null,
      verifiedBy: c.volunteerId ? volunteerMap.get(String(c.volunteerId)) || "Volunteer" : null,
      notes: c.volunteerNotes || null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    teamProgress: teamProgressReport,
    registrations: registrationsReport,
    prizeClaims: prizeClaimsReport,
  };
}
