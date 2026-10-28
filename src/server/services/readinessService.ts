import { connectToDatabase } from "../db";
import { Checkpoint, Question, Route, Team, User } from "../models";
import { comparePassword } from "../auth";
import { getCheckpointCount, getGameStatus, isRegistrationOpen } from "./gameService";
import { validateAllRoutesReport } from "./routeAdminService";
import { getRegistrationWorkflow } from "./teamService";

export interface SystemReadinessReport {
  canStart: boolean;
  gameStatus: string;
  registrationOpen: boolean;
  registrationWorkflow: string;
  checkpointCount: number;
  blockingReasons: string[];
  warnings: string[];
  checks: {
    checkpoints: {
      passed: boolean;
      totalConfigured: number;
      activeCount: number;
      finalTreasureConfigured: boolean;
      questionsReadyCount: number;
      issues: string[];
    };
    routes: {
      passed: boolean;
      activeCount: number;
      allValid: boolean;
      issues: string[];
    };
    teams: {
      passed: boolean;
      totalRegistered: number;
      approvedCount: number;
      unassignedCount: number;
      issues: string[];
    };
    volunteers: {
      passed: boolean;
      totalCount: number;
      vaultMarshallsCount: number;
      issues: string[];
    };
  };
}

/**
 * Performs a comprehensive audit of event readiness before the hunt is launched.
 * Blocks event launch only for genuine structural defects (e.g. invalid routes,
 * missing questions, missing final treasure checkpoint).
 */
export async function checkEventLaunchReadiness(): Promise<SystemReadinessReport> {
  await connectToDatabase();

  const [
    gameStatus,
    registrationOpen,
    registrationWorkflow,
    checkpointCount,
    checkpoints,
    questions,
    routeReport,
    teams,
    users,
  ] = await Promise.all([
    getGameStatus(),
    isRegistrationOpen(),
    getRegistrationWorkflow(),
    getCheckpointCount(),
    Checkpoint.find({ active: { $ne: false } }).sort({ sequenceNumber: 1 }).lean(),
    Question.find({}).lean(),
    validateAllRoutesReport(),
    Team.find({}).lean(),
    User.find({ role: { $in: ["ADMIN", "VOLUNTEER"] } }).lean(),
  ]);

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // 1. Checkpoint & Question Audit
  const cpIssues: string[] = [];
  const activeSeqNumbers = checkpoints.map((c) => c.sequenceNumber);
  const finalTreasureCp = checkpoints.find((c) => c.isFinalTreasure);

  if (!finalTreasureCp) {
    cpIssues.push("No active checkpoint is designated as the Final Treasure Vault.");
  }

  if (checkpoints.length < checkpointCount) {
    cpIssues.push(
      `Insufficient active checkpoints: Configured count is ${checkpointCount}, but only ${checkpoints.length} active checkpoints exist.`
    );
  }

  // Check each regular checkpoint has an attached riddle with an answer hash
  let questionsReadyCount = 0;
  const regularCps = checkpoints.filter((c) => !c.isFinalTreasure && c.sequenceNumber <= checkpointCount);
  for (const cp of regularCps) {
    const q = questions.find((item) => item.checkpointId === String(cp._id));
    if (!q || !q.prompt || !q.correctAnswerHash) {
      cpIssues.push(`Checkpoint #${cp.sequenceNumber} ("${cp.name}") is missing an active puzzle riddle or answer hash.`);
    } else {
      questionsReadyCount++;
    }
  }

  const cpPassed = cpIssues.length === 0;
  if (!cpPassed) {
    blockingReasons.push(...cpIssues);
  }

  // 2. Route Validation Audit
  const routeIssues: string[] = [];
  if (routeReport.activeRoutesCount === 0) {
    routeIssues.push("No active campus routes configured. At least one valid active route is required.");
  } else if (!routeReport.allValid) {
    const brokenRoutes = routeReport.routes.filter((r) => !r.isValid);
    for (const br of brokenRoutes) {
      routeIssues.push(`Route "${br.routeName}" has validation errors: ${br.errors.join("; ")}`);
    }
  }

  const routePassed = routeIssues.length === 0;
  if (!routePassed) {
    blockingReasons.push(...routeIssues);
  }

  // 3. Team Assignment Audit
  const teamIssues: string[] = [];
  const approvedTeams = teams.filter((t) => (t.status as string) !== "DISQUALIFIED");
  const unassignedApprovedTeams = approvedTeams.filter((t) => !t.routeId);

  if (unassignedApprovedTeams.length > 0) {
    // If teams have registered and are approved but lack a route, this blocks launching until balanced
    teamIssues.push(
      `${unassignedApprovedTeams.length} approved team(s) do not have a campus route assigned. Run auto-route assignment before launching.`
    );
    blockingReasons.push(teamIssues[teamIssues.length - 1]);
  }

  if (approvedTeams.length === 0) {
    warnings.push("No approved teams currently registered. Ensure teams are registered before mission start.");
  }

  const teamsPassed = teamIssues.length === 0;

  // 4. Staff & Volunteer Audit
  const volIssues: string[] = [];
  const vaultMarshalls = users.filter((u) => u.role === "ADMIN" || !u.assignedCheckpointId);

  if (vaultMarshalls.length === 0) {
    volIssues.push("No roving Marshall or Admin available to verify final treasure physical prizes.");
    blockingReasons.push(volIssues[volIssues.length - 1]);
  }

  if (users.filter((u) => u.role === "VOLUNTEER").length === 0) {
    warnings.push("No volunteers registered. Event staff may be limited during physical checkpoint coordination.");
  }

  const volPassed = volIssues.length === 0;

  // 5. Production Credentials Security Audit
  const adminUser = users.find((u) => u.username === "admin");
  if (adminUser) {
    const isDefaultAdminPass = await comparePassword("Admin#TechHunt2026", adminUser.passwordHash);
    if (isDefaultAdminPass) {
      if (process.env.STRICT_PROD === "true") {
        blockingReasons.push(
          "CRITICAL SECURITY BLOCKER: Default Administrator password ('Admin#TechHunt2026') is active. You must change the administrator password before launching in production."
        );
      } else {
        warnings.push(
          "Security Notice: Default Administrator password ('Admin#TechHunt2026') is still configured. Ensure this is updated for event day."
        );
      }
    }
  }

  const canStart = blockingReasons.length === 0;

  return {
    canStart,
    gameStatus,
    registrationOpen,
    registrationWorkflow,
    checkpointCount,
    blockingReasons,
    warnings,
    checks: {
      checkpoints: {
        passed: cpPassed,
        totalConfigured: checkpointCount,
        activeCount: checkpoints.length,
        finalTreasureConfigured: !!finalTreasureCp,
        questionsReadyCount,
        issues: cpIssues,
      },
      routes: {
        passed: routePassed,
        activeCount: routeReport.activeRoutesCount,
        allValid: routeReport.allValid,
        issues: routeIssues,
      },
      teams: {
        passed: teamsPassed,
        totalRegistered: teams.length,
        approvedCount: approvedTeams.length,
        unassignedCount: unassignedApprovedTeams.length,
        issues: teamIssues,
      },
      volunteers: {
        passed: volPassed,
        totalCount: users.length,
        vaultMarshallsCount: vaultMarshalls.length,
        issues: volIssues,
      },
    },
  };
}
