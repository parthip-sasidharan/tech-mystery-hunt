"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Play, 
  Pause,
  RotateCcw,
  Sliders, 
  Users, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  MapPin, 
  Printer,
  Hash,
  PlusCircle,
  FileText,
  UserCheck,
  UserX,
  XCircle,
  Search,
  KeyRound,
  Copy,
  Check,
  Award,
  HelpCircle,
  Eye,
  Edit,
  Trash2,
  Download,
  UserPlus,
  Route as RouteIcon,
  AlertTriangle,
  Shuffle,
  Package,
  ShieldAlert,
  Video,
  Zap
} from "lucide-react";

interface TeamItem {
  id: string;
  teamId: string;
  name: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  memberCount: number;
  status: string;
  routeId?: string | null;
  routeSequence?: number[];
  currentCheckpointIndex: number;
  currentStage: string;
  routeName: string;
  isRouteValid?: boolean;
  completedCount: number;
  totalCount: number;
  prizeClaim: { boxNumber: number; claimCode: string; status: string } | null;
  createdAt: string;
}

interface CheckpointQr {
  id: string;
  sequenceNumber: number;
  name: string;
  campusArea: string;
  locationHint: string;
  qrCodeToken: string;
  isFinalTreasure: boolean;
  qrDataUrl: string;
}

interface TeamIdItem {
  id: string;
  teamId: string;
  sequenceNumber: number;
  status: "AVAILABLE" | "ASSIGNED" | "RESERVED" | "DISABLED";
  assignedTeamId: string | null;
  assignedTeamName: string | null;
  assignedAt: string | null;
  batchTag: string;
  createdAt: string;
}

interface TeamIdStats {
  totalPool: number;
  available: number;
  assigned: number;
  disabled: number;
  reserved: number;
  activeTeamsCount: number;
  nextSequenceNumber: number;
}

interface RegistrationItem {
  id: string;
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  registrationType: "ONLINE" | "SPOT";
  allocatedTeamId: string | null;
  approvedTeamId: string | null;
  rejectionNote?: string;
  members: Array<{ name: string; collegeId: string; phone?: string }>;
  createdAt: string;
}

interface AdminCheckpointItem {
  id: string;
  sequenceNumber: number;
  name: string;
  campusArea: string;
  locationHint: string;
  qrCodeToken: string;
  isFinalTreasure: boolean;
  treasureBoxNumber: number | null;
  active: boolean;
  penaltyTask?: string;
  stats: {
    teamsScanned: number;
    teamsSolved: number;
  };
  question: {
    id: string;
    prompt: string;
    type: string;
    options: string[];
    points: number;
    hint: string | null;
    hasAnswerSet: boolean;
  } | null;
}

interface AdminRouteItem {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  checkpointSequence: number[];
  steps: Array<{
    sequenceNumber: number;
    checkpoint: {
      name: string;
      campusArea: string;
      isFinalTreasure: boolean;
    };
  }>;
  assignedTeams?: Array<{
    teamId: string;
    name: string;
    leaderName?: string;
    status: string;
    currentStage: string;
    currentCheckpointIndex?: number;
  }>;
  teamCount: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface RouteValidationSummary {
  allValid: boolean;
  totalConfigured: number;
  finalTreasureSeqNumber: number;
  regularCheckpointsCount: number;
  activeRoutesCount: number;
  totalRegisteredTeams: number;
  capacityWarnings: string[];
  routes: Array<{
    routeId: string;
    routeName: string;
    sequence: number[];
    isValid: boolean;
    errors: string[];
    warnings: string[];
    teamCount: number;
  }>;
}

interface VolunteerItem {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  assignedCheckpointId: string | null;
  createdAt: string;
}

interface OverviewData {
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
    unassigned?: number;
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
  allBoxesClaimed?: boolean;
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

interface ReadinessData {
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

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "checkpoints" | "routes" | "volunteers" | "team-ids" | "registrations" | "teams" | "reports" | "qrcodes"
  >("overview");

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Overview Data from MongoDB
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);

  // Event Config
  const [gameStatus, setGameStatus] = useState("WAITING");
  const [checkpointCount, setCheckpointCount] = useState(8);
  const [customCheckpointCountInput, setCustomCheckpointCountInput] = useState("8");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [registrationWorkflow, setRegistrationWorkflow] = useState<"AUTO_APPROVE" | "MANUAL_APPROVAL">("AUTO_APPROVE");
  const [whatsappHelplineInput, setWhatsappHelplineInput] = useState("+91 98765 43210");
  const [pendingPenaltyTasks, setPendingPenaltyTasks] = useState<any[]>([]);
  const [approvingPenaltyId, setApprovingPenaltyId] = useState<string | null>(null);

  // Roster Data
  const [teams, setTeams] = useState<TeamItem[]>([]);

  // Checkpoints Data
  const [checkpoints, setCheckpoints] = useState<AdminCheckpointItem[]>([]);
  const [checkpointsLoading, setCheckpointsLoading] = useState(false);

  // Routes Data
  const [routes, setRoutes] = useState<AdminRouteItem[]>([]);
  const [routesSummary, setRoutesSummary] = useState<RouteValidationSummary | null>(null);
  const [routesLoading, setRoutesLoading] = useState(false);

  // Volunteers Data
  const [volunteers, setVolunteers] = useState<VolunteerItem[]>([]);
  const [volunteersLoading, setVolunteersLoading] = useState(false);

  // Team IDs Data
  const [teamIds, setTeamIds] = useState<TeamIdItem[]>([]);
  const [teamIdStats, setTeamIdStats] = useState<TeamIdStats | null>(null);
  const [teamIdFilter, setTeamIdFilter] = useState("ALL");
  const [teamIdSearch, setTeamIdSearch] = useState("");
  const [teamIdsLoading, setTeamIdsLoading] = useState(false);

  // Registrations Data
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [regFilter, setRegFilter] = useState("ALL");
  const [regsLoading, setRegsLoading] = useState(false);

  // QR Codes Data
  const [qrCodes, setQrCodes] = useState<CheckpointQr[]>([]);

  // Reports Data
  const [reportsData, setReportsData] = useState<any>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Physical Box Clues & Global Broadcast
  const [boxClues, setBoxCluesState] = useState<{ 1: string; 2: string; 3: string }>({
    1: "",
    2: "",
    3: "",
  });
  const [savingClues, setSavingClues] = useState(false);
  const [cluesSuccessMsg, setCluesSuccessMsg] = useState<string | null>(null);

  const [activeBroadcastState, setActiveBroadcastState] = useState<any>(null);
  const [broadcastTitleInput, setBroadcastTitleInput] = useState("🚨 THE TREASURE HUNT IS OFFICIALLY OVER!");
  const [broadcastMessageInput, setBroadcastMessageInput] = useState("All 3 physical treasure boxes have been successfully found and verified! The winners have been determined.");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSuccessMsg, setBroadcastSuccessMsg] = useState<string | null>(null);

  // Modals
  const [confirmGameAction, setConfirmGameAction] = useState<{
    targetStatus: string;
    title: string;
    description: string;
    isDestructive?: boolean;
  } | null>(null);

  // Checkpoint Modals
  const [showAddCheckpointModal, setShowAddCheckpointModal] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState<AdminCheckpointItem | null>(null);
  const [previewingCheckpoint, setPreviewingCheckpoint] = useState<AdminCheckpointItem | null>(null);
  const [cpSubmitting, setCpSubmitting] = useState(false);

  // New Checkpoint Form State
  const [cpFormName, setCpFormName] = useState("");
  const [cpFormArea, setCpFormArea] = useState("");
  const [cpFormHint, setCpFormHint] = useState("");
  const [cpFormIsFinal, setCpFormIsFinal] = useState(false);
  const [cpFormPrompt, setCpFormPrompt] = useState("");
  const [cpFormType, setCpFormType] = useState<"MULTIPLE_CHOICE" | "NUMERIC" | "TEXT" | "CODE_CIPHER">("MULTIPLE_CHOICE");
  const [cpFormOptions, setCpFormOptions] = useState("Alpha, Beta, Gamma, Delta");
  const [cpFormAnswer, setCpFormAnswer] = useState("");
  const [cpFormQuestionHint, setCpFormQuestionHint] = useState("");
  const [cpFormPoints, setCpFormPoints] = useState(100);
  const [cpFormPenaltyTask, setCpFormPenaltyTask] = useState("");

  // Route Modals
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<AdminRouteItem | null>(null);
  const [routeNameInput, setRouteNameInput] = useState("");
  const [routeDescInput, setRouteDescInput] = useState("");
  const [routeSequenceInput, setRouteSequenceInput] = useState("");
  const [routeSubmitting, setRouteSubmitting] = useState(false);

  // Volunteer Modals
  const [showAddVolunteerModal, setShowAddVolunteerModal] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<VolunteerItem | null>(null);
  const [volUsername, setVolUsername] = useState("");
  const [volName, setVolName] = useState("");
  const [volEmail, setVolEmail] = useState("");
  const [volPassword, setVolPassword] = useState("");
  const [volAssignedCp, setVolAssignedCp] = useState("");
  const [volSubmitting, setVolSubmitting] = useState(false);

  // Team ID Bulk Modal
  const [showBulkGenModal, setShowBulkGenModal] = useState(false);
  const [bulkCount, setBulkCount] = useState(25);
  const [bulkBatchTag, setBulkBatchTag] = useState("BATCH_MAIN");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showPrintSlipsModal, setShowPrintSlipsModal] = useState(false);
  const [printSlipPasscode, setPrintSlipPasscode] = useState("hunt123");
  const [printSlipFilter, setPrintSlipFilter] = useState<"ALL" | "AVAILABLE" | "ASSIGNED">("AVAILABLE");

  // Spot Registration Modal
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [spotSubmitting, setSpotSubmitting] = useState(false);
  const [spotTeamName, setSpotTeamName] = useState("");
  const [spotLeaderName, setSpotLeaderName] = useState("");
  const [spotLeaderEmail, setSpotLeaderEmail] = useState("");
  const [spotLeaderPhone, setSpotLeaderPhone] = useState("");
  const [spotPassword, setSpotPassword] = useState("");
  const [spotSpecificTeamId, setSpotSpecificTeamId] = useState("");
  const [spotRouteId, setSpotRouteId] = useState("");
  const [spotMembers, setSpotMembers] = useState([{ name: "", collegeId: "", phone: "" }]);

  // Spot Credential Handover Slip Modal
  const [issuedSlip, setIssuedSlip] = useState<{
    teamId: string;
    teamName: string;
    leaderName: string;
    leaderEmail: string;
    leaderPhone: string;
    routeName: string;
    initialPassword: string;
  } | null>(null);
  const [slipCopied, setSlipCopied] = useState(false);

  // Approval / Rejection Prompt Dialogs
  const [approvingReg, setApprovingReg] = useState<RegistrationItem | null>(null);
  const [overrideTeamId, setOverrideTeamId] = useState("");
  const [rejectingReg, setRejectingReg] = useState<RegistrationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Team Status Change Confirmation
  const [teamStatusTarget, setTeamStatusTarget] = useState<TeamItem | null>(null);
  const [teamTargetNewStatus, setTeamTargetNewStatus] = useState<string>("DISQUALIFIED");
  const [statusChangeReason, setStatusChangeReason] = useState("");

  // Route Auto-Assign Preview State
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [autoAssignPreview, setAutoAssignPreview] = useState<{
    unassignedCount: number;
    proposedAssignments: Array<{
      teamObjectId: string;
      teamId: string;
      teamName: string;
      proposedRouteId: string;
      proposedRouteName: string;
    }>;
    availableRoutes: Array<{ id: string; name: string; currentCount: number; projectedCount: number }>;
  } | null>(null);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  const [autoAssignApplying, setAutoAssignApplying] = useState(false);
  const [autoScaleLoading, setAutoScaleLoading] = useState(false);

  // Individual Team Route Assignment Modal
  const [routeAssignTargetTeam, setRouteAssignTargetTeam] = useState<TeamItem | null>(null);
  const [selectedTargetRouteId, setSelectedTargetRouteId] = useState("");
  const [routeOverrideReason, setRouteOverrideReason] = useState("");
  const [routeAssignSubmitting, setRouteAssignSubmitting] = useState(false);
  const [routeAssignError, setRouteAssignError] = useState<string | null>(null);

  // Restart / Reset Game Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMode, setResetMode] = useState<"FRESH" | "REPLAY">("FRESH");
  const [resettingGame, setResettingGame] = useState(false);

  const handleResetGame = async () => {
    setResettingGame(true);
    try {
      const res = await fetch("/api/admin/reset-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: resetMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");

      showNotification(data.message || "Game reset successfully!");
      setShowResetModal(false);
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      showNotification(msg, true);
    } finally {
      setResettingGame(false);
    }
  };

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    } else {
      setActionMessage(msg);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const fetchOverviewData = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [authRes, overviewRes, teamsRes, readinessRes] = await Promise.all([
        fetch("/api/auth/me", { headers, credentials: "include" }),
        fetch("/api/admin/overview", { headers, credentials: "include" }),
        fetch("/api/teams", { headers, credentials: "include" }),
        fetch("/api/admin/readiness", { headers, credentials: "include" }),
      ]);

      if (!authRes.ok && authRes.status !== 401) {
        console.error("Auth check returned non-401 error:", authRes.status);
        showNotification("Syncing with game console...", false);
      } else {
        const authData = await authRes.json();
        if (!authData.authenticated || authData.role !== "ADMIN") {
          if (typeof window !== "undefined") localStorage.removeItem("techhunt_token");
          router.replace("/staff-login");
          return;
        }
      }

      const ovData = await overviewRes.json();
      if (ovData && !ovData.error) {
        setOverview(ovData);
        setGameStatus(ovData.gameStatus);
        setCheckpointCount(ovData.checkpointCount);
        setCustomCheckpointCountInput(String(ovData.checkpointCount));
      }

      const teamsData = await teamsRes.json();
      if (teamsData.teams) setTeams(teamsData.teams);

      if (readinessRes.ok) {
        const readData = await readinessRes.json();
        setReadiness(readData);
      }

      // Fetch Box Clues & Broadcast
      try {
        const [cluesRes, bcRes, cfgRes, tasksRes] = await Promise.all([
          fetch("/api/admin/box-clues", { headers, credentials: "include" }),
          fetch("/api/admin/broadcast", { headers, credentials: "include" }),
          fetch("/api/config", { headers, credentials: "include" }),
          fetch("/api/volunteer/verify-task", { headers, credentials: "include" }),
        ]);
        if (cluesRes.ok) {
          const cData = await cluesRes.json();
          if (cData.clues) setBoxCluesState(cData.clues);
        }
        if (bcRes.ok) {
          const bData = await bcRes.json();
          if (bData.broadcast) {
            setActiveBroadcastState(bData.broadcast);
            if (bData.broadcast.title) setBroadcastTitleInput(bData.broadcast.title);
            if (bData.broadcast.message) setBroadcastMessageInput(bData.broadcast.message);
          } else {
            setActiveBroadcastState(null);
          }
        }
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          if (cfgData.whatsappHelpline) setWhatsappHelplineInput(cfgData.whatsappHelpline);
        }
        if (tasksRes.ok) {
          const tData = await tasksRes.json();
          if (tData.pendingPenaltyTasks) setPendingPenaltyTasks(tData.pendingPenaltyTasks);
        }
      } catch (err) {
        console.error("Failed to load clues/broadcast/penalty", err);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBoxClues = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingClues(true);
    setCluesSuccessMsg(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/box-clues", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          clue1: boxClues[1],
          clue2: boxClues[2],
          clue3: boxClues[3],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update clues");
      setCluesSuccessMsg("Physical box clues successfully saved!");
      if (data.clues) setBoxCluesState(data.clues);
      setTimeout(() => setCluesSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save box clues");
    } finally {
      setSavingClues(false);
    }
  };

  const handleAdminApprovePenalty = async (teamObjectId: string, checkpointId?: string) => {
    setApprovingPenaltyId(teamObjectId);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/volunteer/verify-task", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          approvePenalty: true,
          teamObjectId,
          checkpointId,
          notes: "Approved by Admin on Overview Console",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showNotification("✓ Video penalty task approved! Next checkpoint unlocked for team.");
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve task";
      showNotification(msg, true);
    } finally {
      setApprovingPenaltyId(null);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingBroadcast(true);
    setBroadcastSuccessMsg(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          title: broadcastTitleInput,
          message: broadcastMessageInput,
          type: "ALERT",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send broadcast");
      setBroadcastSuccessMsg("Global broadcast alert successfully published to all player screens!");
      if (data.broadcast) setActiveBroadcastState(data.broadcast);
      setTimeout(() => setBroadcastSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send broadcast");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleClearBroadcast = async () => {
    setSendingBroadcast(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ clear: true }),
      });
      if (!res.ok) throw new Error("Failed to clear broadcast");
      setActiveBroadcastState(null);
      setBroadcastSuccessMsg("Active global broadcast cleared.");
      setTimeout(() => setBroadcastSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to clear broadcast");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const fetchCheckpoints = async () => {
    setCheckpointsLoading(true);
    try {
      const res = await fetch("/api/admin/checkpoints");
      const data = await res.json();
      if (data.checkpoints) setCheckpoints(data.checkpoints);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckpointsLoading(false);
    }
  };

  const fetchRoutes = async () => {
    setRoutesLoading(true);
    try {
      const res = await fetch("/api/admin/routes");
      const data = await res.json();
      if (data.routes) setRoutes(data.routes);
      if (data.summary) setRoutesSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setRoutesLoading(false);
    }
  };

  const fetchVolunteers = async () => {
    setVolunteersLoading(true);
    try {
      const res = await fetch("/api/admin/volunteers");
      const data = await res.json();
      if (data.volunteers) setVolunteers(data.volunteers);
    } catch (err) {
      console.error(err);
    } finally {
      setVolunteersLoading(false);
    }
  };

  const fetchTeamIds = async () => {
    setTeamIdsLoading(true);
    try {
      const params = new URLSearchParams();
      if (teamIdFilter) params.set("status", teamIdFilter);
      if (teamIdSearch) params.set("search", teamIdSearch);
      params.set("limit", "100");

      const res = await fetch(`/api/admin/team-ids?${params.toString()}`);
      const data = await res.json();
      if (data.items) setTeamIds(data.items);
      if (data.stats) setTeamIdStats(data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setTeamIdsLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    setRegsLoading(true);
    try {
      const res = await fetch(`/api/admin/registrations?status=${regFilter}`);
      const data = await res.json();
      if (data.registrations) setRegistrations(data.registrations);
    } catch (err) {
      console.error(err);
    } finally {
      setRegsLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await fetch("/api/admin/reports");
      const data = await res.json();
      setReportsData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchQrCodes = async () => {
    try {
      const res = await fetch("/api/admin/qrcodes");
      const data = await res.json();
      if (data.checkpoints) setQrCodes(data.checkpoints);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  useEffect(() => {
    if (activeTab === "overview") fetchOverviewData();
    if (activeTab === "checkpoints") fetchCheckpoints();
    if (activeTab === "routes") fetchRoutes();
    if (activeTab === "volunteers") fetchVolunteers();
    if (activeTab === "team-ids") fetchTeamIds();
    if (activeTab === "registrations") fetchRegistrations();
    if (activeTab === "reports") fetchReports();
    if (activeTab === "qrcodes") fetchQrCodes();
  }, [activeTab, teamIdFilter, regFilter]);

  const updateConfig = async (updates: {
    gameStatus?: string;
    checkpointCount?: string | number;
    registrationOpen?: boolean;
    registrationWorkflow?: "AUTO_APPROVE" | "MANUAL_APPROVAL";
    whatsappHelpline?: string;
  }) => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.gameStatus) setGameStatus(data.gameStatus);
      if (data.checkpointCount) {
        setCheckpointCount(data.checkpointCount);
        setCustomCheckpointCountInput(String(data.checkpointCount));
      }
      if (data.registrationOpen !== undefined) setRegistrationOpen(data.registrationOpen);
      if (data.registrationWorkflow) setRegistrationWorkflow(data.registrationWorkflow);
      if (data.whatsappHelpline) setWhatsappHelplineInput(data.whatsappHelpline);

      showNotification("Configuration updated successfully.");
      fetchOverviewData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Update failed";
      showNotification(message, true);
    }
  };

  const handleGameLifecycleChange = (targetStatus: string) => {
    if (targetStatus === "ACTIVE") {
      setConfirmGameAction({
        targetStatus,
        title: "START MYSTERY HUNT",
        description: "Are you sure you want to START the hunt? Active checkpoints will be unlocked, QR scans will be accepted, and live mission clues will become visible to all registered teams.",
      });
    } else if (targetStatus === "CONCLUDED") {
      setConfirmGameAction({
        targetStatus,
        title: "CONCLUDE MYSTERY HUNT",
        description: "Are you sure you want to FINISH and conclude the event? All active riddle submissions and checkpoint scans will be permanently locked.",
        isDestructive: true,
      });
    } else if (targetStatus === "PAUSED") {
      setConfirmGameAction({
        targetStatus,
        title: "PAUSE MYSTERY HUNT",
        description: "Are you sure you want to PAUSE the hunt? Teams will temporarily be blocked from scanning QR codes and submitting answers until resumed.",
      });
    } else {
      updateConfig({ gameStatus: targetStatus });
    }
  };

  const executeConfirmedGameAction = async () => {
    if (!confirmGameAction) return;
    await updateConfig({ gameStatus: confirmGameAction.targetStatus });
    setConfirmGameAction(null);
  };

  // Checkpoint Management Actions
  const handleSaveNewCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpSubmitting(true);
    try {
      const opts = cpFormType === "MULTIPLE_CHOICE"
        ? cpFormOptions.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

      const payload = {
        name: cpFormName.trim(),
        campusArea: cpFormArea.trim() || cpFormName.trim(),
        locationHint: cpFormHint.trim(),
        isFinalTreasure: cpFormIsFinal,
        penaltyTask: cpFormPenaltyTask.trim(),
        question: {
          prompt: cpFormPrompt.trim(),
          type: cpFormType,
          options: opts,
          acceptedAnswer: cpFormAnswer.trim(),
          points: 100,
          hint: cpFormQuestionHint.trim() || null,
        },
      };

      const res = await fetch("/api/admin/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Checkpoint #${data.checkpoint.sequenceNumber} "${data.checkpoint.name}" created.`);
      setShowAddCheckpointModal(false);
      // Reset form
      setCpFormName("");
      setCpFormArea("");
      setCpFormHint("");
      setCpFormIsFinal(false);
      setCpFormPrompt("");
      setCpFormAnswer("");
      setCpFormQuestionHint("");
      fetchCheckpoints();
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create checkpoint.";
      showNotification(msg, true);
    } finally {
      setCpSubmitting(false);
    }
  };

  const handleUpdateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheckpoint) return;
    setCpSubmitting(true);
    try {
      const opts = cpFormType === "MULTIPLE_CHOICE"
        ? cpFormOptions.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

      const payload: any = {
        name: cpFormName.trim(),
        campusArea: cpFormArea.trim() || cpFormName.trim(),
        locationHint: cpFormHint.trim(),
        isFinalTreasure: cpFormIsFinal,
        penaltyTask: cpFormPenaltyTask.trim(),
        question: {
          prompt: cpFormPrompt.trim(),
          type: cpFormType,
          options: opts,
          points: 100,
          hint: cpFormQuestionHint.trim() || null,
        },
      };

      if (cpFormAnswer.trim().length > 0) {
        payload.question.acceptedAnswer = cpFormAnswer.trim();
      }

      const res = await fetch(`/api/admin/checkpoints/${editingCheckpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Checkpoint updated: ${data.message || ""}`);
      setEditingCheckpoint(null);
      fetchCheckpoints();
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update checkpoint.";
      showNotification(msg, true);
    } finally {
      setCpSubmitting(false);
    }
  };

  const handleToggleCheckpointActive = async (cp: AdminCheckpointItem) => {
    try {
      const nextActive = !cp.active;
      const res = await fetch(`/api/admin/checkpoints/${cp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Checkpoint #${cp.sequenceNumber} is now ${nextActive ? "Active" : "Deactivated"}.`);
      fetchCheckpoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle checkpoint.";
      showNotification(msg, true);
    }
  };

  const handleDeleteCheckpoint = async (cp: AdminCheckpointItem) => {
    if (!confirm(`Are you sure you want to permanently delete checkpoint #${cp.sequenceNumber} "${cp.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/checkpoints/${cp.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(data.message || "Checkpoint deleted.");
      fetchCheckpoints();
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      showNotification(msg, true);
    }
  };

  // Route Management Actions
  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setRouteSubmitting(true);
    try {
      const seq = routeSequenceInput
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      const payload = {
        name: routeNameInput.trim(),
        description: routeDescInput.trim() || undefined,
        checkpointSequence: seq,
      };

      const res = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Route "${data.route.name}" created and verified.`);
      setShowAddRouteModal(false);
      setRouteNameInput("");
      setRouteDescInput("");
      setRouteSequenceInput("");
      fetchRoutes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create route.";
      showNotification(msg, true);
    } finally {
      setRouteSubmitting(false);
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;
    setRouteSubmitting(true);
    try {
      const seq = routeSequenceInput
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      const payload = {
        name: routeNameInput.trim(),
        description: routeDescInput.trim() || undefined,
        checkpointSequence: seq,
      };

      const res = await fetch(`/api/admin/routes/${editingRoute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(data.message || `Route "${editingRoute.name}" updated.`);
      setEditingRoute(null);
      fetchRoutes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update route.";
      showNotification(msg, true);
    } finally {
      setRouteSubmitting(false);
    }
  };

  const handleDeleteRoute = async (r: AdminRouteItem) => {
    if (!confirm(`Delete route "${r.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/routes/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(data.message || "Route deleted.");
      fetchRoutes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete route.";
      showNotification(msg, true);
    }
  };

  // Volunteer Actions
  const handleSaveVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    setVolSubmitting(true);
    try {
      const payload = {
        username: volUsername.trim(),
        name: volName.trim(),
        email: volEmail.trim(),
        password: volPassword,
        assignedCheckpointId: volAssignedCp || undefined,
      };

      const res = await fetch("/api/admin/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Volunteer account "${data.volunteer.username}" created.`);
      setShowAddVolunteerModal(false);
      setVolUsername("");
      setVolName("");
      setVolEmail("");
      setVolPassword("");
      setVolAssignedCp("");
      fetchVolunteers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create volunteer.";
      showNotification(msg, true);
    } finally {
      setVolSubmitting(false);
    }
  };

  const handleUpdateVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVolunteer) return;
    setVolSubmitting(true);
    try {
      const payload: any = {
        name: volName.trim(),
        email: volEmail.trim(),
        assignedCheckpointId: volAssignedCp || null,
      };
      if (volPassword.trim().length >= 8) {
        payload.newPassword = volPassword.trim();
      }

      const res = await fetch(`/api/admin/volunteers/${editingVolunteer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Volunteer "${editingVolunteer.username}" updated.`);
      setEditingVolunteer(null);
      fetchVolunteers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update volunteer.";
      showNotification(msg, true);
    } finally {
      setVolSubmitting(false);
    }
  };

  const handleToggleVolunteerActive = async (v: VolunteerItem) => {
    try {
      const nextActive = !v.active;
      const res = await fetch(`/api/admin/volunteers/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Volunteer "${v.username}" is now ${nextActive ? "Active" : "Disabled"}.`);
      fetchVolunteers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle volunteer.";
      showNotification(msg, true);
    }
  };

  // Team ID Management Actions
  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/admin/team-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Number(bulkCount), batchTag: bulkBatchTag.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(data.message || `Generated ${bulkCount} Team IDs.`);
      setShowBulkGenModal(false);
      fetchTeamIds();
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bulk generation failed.";
      showNotification(msg, true);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleToggleTeamId = async (id: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === "DISABLED" ? "AVAILABLE" : "DISABLED";
      const res = await fetch(`/api/admin/team-ids/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Team ID ${data.teamId} is now ${data.newStatus || nextStatus}.`);
      fetchTeamIds();
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle status.";
      showNotification(msg, true);
    }
  };

  // Spot registration
  const handleSpotRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpotSubmitting(true);
    try {
      const validMembers = spotMembers.filter(
        (m) => m.name.trim().length > 0 && m.collegeId.trim().length > 0
      );
      if (validMembers.length === 0) {
        throw new Error("At least 1 teammate (name & roll ID) is required.");
      }

      const payload = {
        teamName: spotTeamName.trim(),
        leaderName: spotLeaderName.trim(),
        leaderEmail: spotLeaderEmail.trim(),
        leaderPhone: spotLeaderPhone.trim(),
        password: spotPassword.trim() || undefined,
        specificTeamId: spotSpecificTeamId.trim() || undefined,
        routeId: spotRouteId || undefined,
        members: validMembers,
      };

      const res = await fetch("/api/admin/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIssuedSlip({
        teamId: data.teamId,
        teamName: data.teamName,
        leaderName: data.leaderName,
        leaderEmail: data.leaderEmail,
        leaderPhone: data.leaderPhone,
        routeName: data.routeName,
        initialPassword: data.initialPassword,
      });

      setShowSpotModal(false);
      setSpotTeamName("");
      setSpotLeaderName("");
      setSpotLeaderEmail("");
      setSpotLeaderPhone("");
      setSpotPassword("");
      setSpotSpecificTeamId("");
      setSpotRouteId("");
      setSpotMembers([{ name: "", collegeId: "", phone: "" }]);

      showNotification(`Spot registration created: ${data.teamId}`);
      fetchRegistrations();
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Spot registration failed.";
      showNotification(msg, true);
    } finally {
      setSpotSubmitting(false);
    }
  };

  // Registration Approvals
  const handleApprove = async () => {
    if (!approvingReg) return;
    try {
      const payload: { specificTeamId?: string } = {};
      if (overrideTeamId.trim()) {
        payload.specificTeamId = overrideTeamId.trim().toUpperCase();
      }

      const res = await fetch(`/api/admin/registrations/${approvingReg.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(data.message || `Approved ${approvingReg.teamName}.`);
      setApprovingReg(null);
      setOverrideTeamId("");
      fetchRegistrations();
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed.";
      showNotification(msg, true);
    }
  };

  const handleReject = async () => {
    if (!rejectingReg) return;
    try {
      const res = await fetch(`/api/admin/registrations/${rejectingReg.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionNote: rejectionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(data.message || `Registration for ${rejectingReg.teamName} rejected.`);
      setRejectingReg(null);
      setRejectionReason("");
      fetchRegistrations();
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rejection failed.";
      showNotification(msg, true);
    }
  };

  // Team Disqualification / Reinstatement
  const handleUpdateTeamStatus = async () => {
    if (!teamStatusTarget) return;
    try {
      const res = await fetch(`/api/admin/teams/${teamStatusTarget.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: teamTargetNewStatus,
          reason: statusChangeReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Team ${teamStatusTarget.teamId} status changed to ${teamTargetNewStatus}.`);
      setTeamStatusTarget(null);
      setStatusChangeReason("");
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update team status.";
      showNotification(msg, true);
    }
  };

  const handleDeleteTeam = async (t: TeamItem) => {
    if (!window.confirm(`Are you sure you want to completely delete team ${t.teamId} (${t.name})? This will remove them from the roster. Remaining competing teams will NOT be affected.`)) {
      return;
    }
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/admin/teams/${t.id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete team");

      showNotification(`✓ Team ${t.teamId} deleted successfully. Remaining teams are unaffected.`);
      fetchOverviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete team";
      showNotification(msg, true);
    }
  };

  const handleFetchAutoAssignPreview = async () => {
    setAutoAssignLoading(true);
    try {
      const res = await fetch("/api/admin/routes/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load preview.");
      setAutoAssignPreview(data);
      setShowAutoAssignModal(true);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : "Error generating preview", true);
    } finally {
      setAutoAssignLoading(false);
    }
  };

  const handleApplyAutoAssign = async () => {
    setAutoAssignApplying(true);
    try {
      const res = await fetch("/api/admin/routes/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply route assignments.");
      showNotification(data.message || "Routes successfully assigned and balanced!");
      setShowAutoAssignModal(false);
      setAutoAssignPreview(null);
      await Promise.all([fetchOverviewData(), fetchRoutes()]);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : "Error applying assignments", true);
    } finally {
      setAutoAssignApplying(false);
    }
  };

  const handleAutoScalePairRoutes = async () => {
    if (!confirm("⚡ AUTO-SCALE ROUTES (MAX 2 TEAMS / ROUTE):\n\nThis will count all registered teams and dynamically generate balanced routes so that AT MOST 2 TEAMS share any route!\n\nEvery route will finish with Checkpoint 9, then Checkpoint 10.\n\nProceed?")) {
      return;
    }
    setAutoScaleLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/routes/auto-scale", {
        method: "POST",
        headers,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to auto-scale routes");
      showNotification(data.message || "Routes auto-scaled successfully!");
      await Promise.all([fetchOverviewData(), fetchRoutes()]);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : "Error auto-scaling routes", true);
    } finally {
      setAutoScaleLoading(false);
    }
  };

  const handleIndividualRouteAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeAssignTargetTeam || !selectedTargetRouteId) return;

    setRouteAssignSubmitting(true);
    setRouteAssignError(null);

    try {
      const res = await fetch(`/api/admin/teams/${routeAssignTargetTeam.id}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: selectedTargetRouteId,
          recoveryReason: routeOverrideReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign route.");

      showNotification(data.message || "Route updated successfully!");
      setRouteAssignTargetTeam(null);
      setSelectedTargetRouteId("");
      setRouteOverrideReason("");
      await Promise.all([fetchOverviewData(), fetchRoutes()]);
    } catch (err: unknown) {
      setRouteAssignError(err instanceof Error ? err.message : "Failed to assign route");
    } finally {
      setRouteAssignSubmitting(false);
    }
  };

  const copySlipToClipboard = () => {
    if (!issuedSlip) return;
    const text = `TECH MYSTERY HUNT - OFFICIAL TEAM PASS
Team ID: ${issuedSlip.teamId}
Team Name: ${issuedSlip.teamName}
Campus Route: ${issuedSlip.routeName}
Leader: ${issuedSlip.leaderName} (${issuedSlip.leaderPhone})
Login Password: ${issuedSlip.initialPassword}
URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setSlipCopied(true);
    setTimeout(() => setSlipCopied(false), 2000);
  };

  const exportReportJson = () => {
    if (!reportsData) return;
    const blob = new Blob([JSON.stringify(reportsData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tech-mystery-hunt-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 font-mono text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mr-2" />
        Authenticating Master Console...
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> MASTER CONTROL TERMINAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            ADMIN DASHBOARD
          </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap bg-surface-100 p-1 rounded-xl border border-surface-border text-xs font-mono gap-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === "overview"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Overview & Stats
          </button>
          <button
            onClick={() => setActiveTab("checkpoints")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "checkpoints"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> Checkpoints ({overview?.checkpointStats.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("routes")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "routes"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5" /> Routes
          </button>
          <button
            onClick={() => setActiveTab("volunteers")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "volunteers"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Volunteers
          </button>
          <button
            onClick={() => setActiveTab("team-ids")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "team-ids"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Hash className="w-3.5 h-3.5" /> Team IDs ({overview?.teamIds.available ?? "–"})
          </button>
          <button
            onClick={() => setActiveTab("registrations")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "registrations"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Signups ({overview?.teams.pending ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("teams")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "teams"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Teams ({overview?.teams.total ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "reports"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Award className="w-3.5 h-3.5" /> Reports
          </button>
          <button
            onClick={() => setActiveTab("qrcodes")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "qrcodes"
                ? "bg-amber-400 text-black shadow-glow-amber"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> Print QRs
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW & MASTER EVENT SWITCHBOARD
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Metrics from MongoDB */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="glow-card rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-mono">Total Teams</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {overview?.teams.total ?? 0}
              </div>
            </div>
            <div className="glow-card rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-mono">Pending Approval</div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {overview?.teams.pending ?? 0}
              </div>
            </div>
            <div className="glow-card rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-mono">Waiting Room</div>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                {overview?.teams.waiting ?? 0}
              </div>
            </div>
            <div className="glow-card rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-mono">Active Hunting</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {overview?.teams.inProgress ?? 0}
              </div>
            </div>
            <div className="glow-card rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-mono">Treasure Vault</div>
              <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                {overview?.teams.treasureSearch ?? 0}
              </div>
            </div>
            <div className="glow-card rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-mono">Completed Event</div>
              <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
                {overview?.teams.completed ?? 0}
              </div>
            </div>
          </div>

          

          {/* Event Launch Readiness Audit Card */}
          <div className="glow-card rounded-2xl p-6 border-surface-border mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  Event Launch Readiness Audit
                </h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 self-start ${
                  readiness?.canStart
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                }`}
              >
                {readiness?.canStart ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> READY FOR LAUNCH
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> ACTION REQUIRED BEFORE LAUNCH
                  </>
                )}
              </span>
            </div>

            {/* Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-surface-50 border border-surface-border text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Checkpoints &amp; Vault</span>
                  {readiness?.checks.checkpoints.passed ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div className="font-bold text-white">
                  {readiness?.checks.checkpoints.activeCount || 0}/{readiness?.checks.checkpoints.totalConfigured || 8} Active
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {readiness?.checks.checkpoints.questionsReadyCount || 0} Questions Ready
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 border border-surface-border text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Campus Routes</span>
                  {readiness?.checks.routes.passed ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div className="font-bold text-white">
                  {readiness?.checks.routes.activeCount || 0} Active Routes
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {readiness?.checks.routes.allValid ? "100% Sequence Valid" : "Errors Detected"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 border border-surface-border text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Team Allocation</span>
                  {readiness?.checks.teams.passed ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div className="font-bold text-white">
                  {readiness?.checks.teams.approvedCount || 0} Approved Teams
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {readiness?.checks.teams.unassignedCount === 0
                    ? "0 Unassigned Teams"
                    : `${readiness?.checks.teams.unassignedCount} Unassigned`}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 border border-surface-border text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Staff &amp; Dais Vault</span>
                  {readiness?.checks.volunteers.passed ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="font-bold text-white">
                  {readiness?.checks.volunteers.vaultMarshallsCount || 0} Vault Marshalls
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {readiness?.checks.volunteers.totalCount || 0} Total Staff
                </div>
              </div>
            </div>

            {/* Blocking issues alert */}
            {readiness?.blockingReasons && readiness.blockingReasons.length > 0 && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-1 mb-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-200">
                  <AlertTriangle className="w-4 h-4" /> Launch Blockers:
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {readiness.blockingReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {readiness?.warnings && readiness.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono space-y-0.5">
                <div className="font-bold flex items-center gap-1 text-amber-200">
                  <AlertCircle className="w-3.5 h-3.5" /> Advisory Notices:
                </div>
                <ul className="list-disc pl-5">
                  {readiness.warnings.map((warn, idx) => (
                    <li key={idx}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Master Lifecycle & Config Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Lifecycle Controls */}
            <div className="glow-card rounded-2xl p-6 border-surface-border">
              <h3 className="text-base font-bold text-white mb-2 font-mono flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" /> Event Lifecycle Control
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Controls game progression. Teams cannot start missions until the game is Started. When Paused, riddle submissions are blocked.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => updateConfig({ gameStatus: "WAITING" })}
                  className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition-all ${
                    gameStatus === "WAITING"
                      ? "bg-cyan-400 text-black border-cyan-300 shadow-glow-cyan"
                      : "bg-surface-50 text-slate-300 border-surface-border hover:bg-surface-100"
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Prepare
                </button>

                <button
                  type="button"
                  onClick={() => handleGameLifecycleChange("ACTIVE")}
                  className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition-all ${
                    gameStatus === "ACTIVE"
                      ? "bg-emerald-400 text-black border-emerald-300 shadow-glow-emerald"
                      : "bg-surface-50 text-emerald-400 border-surface-border hover:bg-surface-100"
                  }`}
                >
                  <Play className="w-3.5 h-3.5 inline mr-1" /> Start
                </button>

                <button
                  type="button"
                  onClick={() => handleGameLifecycleChange("PAUSED")}
                  className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition-all ${
                    gameStatus === "PAUSED"
                      ? "bg-amber-400 text-black border-amber-300 shadow-glow-amber"
                      : "bg-surface-50 text-amber-400 border-surface-border hover:bg-surface-100"
                  }`}
                >
                  <Pause className="w-3.5 h-3.5 inline mr-1" /> Pause
                </button>

                <button
                  type="button"
                  onClick={() => handleGameLifecycleChange("CONCLUDED")}
                  className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition-all ${
                    gameStatus === "CONCLUDED"
                      ? "bg-purple-400 text-black border-purple-300"
                      : "bg-surface-50 text-purple-400 border-surface-border hover:bg-surface-100"
                  }`}
                >
                  Finish
                </button>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 border border-surface-border text-xs text-slate-300 flex items-center justify-between">
                <span>Current State:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                  gameStatus === "ACTIVE"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : gameStatus === "PAUSED"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-slate-700 text-slate-300"
                }`}>
                  {gameStatus}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-400 font-mono flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Restart / Reset Game
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Reset progress & start hunt fresh from beginning
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-mono font-bold transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restart Game
                </button>
              </div>
            </div>

            {/* Configurable Checkpoint Count & Registration Settings */}
            <div className="glow-card rounded-2xl p-6 border-surface-border">
              <h3 className="text-base font-bold text-white mb-2 font-mono flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" /> Event Length & Registration
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Total checkpoints includes the final treasure vault (e.g. 8 total = 7 regular + 1 final treasure).
              </p>

              {/* Dynamic Checkpoint Count Config */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  min="3"
                  max="30"
                  value={customCheckpointCountInput}
                  onChange={(e) => setCustomCheckpointCountInput(e.target.value)}
                  className="w-24 px-3 py-2 rounded-xl bg-surface-50 border border-surface-border text-white text-sm font-mono text-center"
                />
                <button
                  type="button"
                  onClick={() => updateConfig({ checkpointCount: customCheckpointCountInput })}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs font-mono hover:bg-amber-300"
                >
                  Set Total Checkpoints
                </button>
                <span className="text-xs text-slate-400 font-mono">
                  Current: <strong className="text-cyan-400">{checkpointCount} total</strong> ({checkpointCount - 1} regular + 1 final)
                </span>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-50 border border-surface-border text-xs">
                  <span className="text-slate-300 font-mono">Public Registration</span>
                  <button
                    onClick={() => updateConfig({ registrationOpen: !registrationOpen })}
                    className={`px-3 py-1 rounded-lg font-bold font-mono text-xs ${
                      registrationOpen
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {registrationOpen ? "OPEN (Accepting)" : "LOCKED (Closed)"}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-50 border border-surface-border text-xs">
                  <span className="text-slate-300 font-mono">Approval Mode</span>
                  <button
                    onClick={() =>
                      updateConfig({
                        registrationWorkflow:
                          registrationWorkflow === "AUTO_APPROVE"
                            ? "MANUAL_APPROVAL"
                            : "AUTO_APPROVE",
                      })
                    }
                    className="px-3 py-1 rounded-lg font-bold font-mono text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  >
                    {registrationWorkflow}
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-surface-50 border border-surface-border text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-300 font-mono flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp Helpline for Video Tasks:
                    </span>
                    <span className="text-emerald-400 font-bold font-mono text-[11px]">{whatsappHelplineInput || "+91 98765 43210"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={whatsappHelplineInput}
                      onChange={(e) => setWhatsappHelplineInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-border text-white text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => updateConfig({ whatsappHelpline: whatsappHelplineInput })}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono transition-all"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pending WhatsApp Video Task Verifications (Admin Quick Actions) */}
          {pendingPenaltyTasks.length > 0 && (
            <div className="glow-card rounded-2xl p-6 border-amber-500/50 bg-amber-950/20 shadow-glow-amber">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-base font-bold text-white font-mono">
                    Pending WhatsApp Video Tasks ({pendingPenaltyTasks.length} Awaiting Approval)
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ACTION REQUIRED
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-4 font-mono">
                Teams answered incorrectly and were assigned a video penalty task. Once you verify their WhatsApp submission on <strong className="text-emerald-400">{whatsappHelplineInput}</strong>, click approve to unlock their next checkpoint.
              </p>

              <div className="space-y-3">
                {pendingPenaltyTasks.map((task) => (
                  <div
                    key={task.teamObjectId}
                    className="p-4 rounded-xl bg-surface-50 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                          CP #{task.checkpointSequence}
                        </span>
                        <strong className="text-cyan-400 font-bold">{task.teamId}</strong>
                        <span className="text-slate-400">•</span>
                        <span className="text-white font-bold">{task.teamName || task.name}</span>
                        <span className="text-slate-400">• Leader: {task.leaderName} ({task.leaderPhone})</span>
                      </div>
                      <div className="text-xs text-slate-300 font-mono mt-1">
                        Task: <span className="text-amber-200">{task.taskText || task.penaltyTask?.taskText || "Video Penalty Task Assigned"}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={approvingPenaltyId === task.teamObjectId}
                      onClick={() => handleAdminApprovePenalty(task.teamObjectId, task.checkpointId)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs font-mono flex items-center justify-center gap-1.5 transition-all shadow-glow-emerald disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      {approvingPenaltyId === task.teamObjectId ? "Unlocking..." : "✓ Approve Video & Unlock"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          

          {/* Physical Prize Boxes Live Status Card */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            {overview?.allBoxesClaimed && (
              <div className="mb-4 p-4 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 flex items-center gap-3">
                <Award className="w-6 h-6 text-purple-400 shrink-0 animate-bounce" />
                <div>
                  <div className="font-bold text-sm font-mono">🏆 ALL THREE PHYSICAL PRIZE BOXES CLAIMED &amp; VERIFIED!</div>
                  <div className="text-xs text-purple-300">All podium positions (Box 1, 2, 3) have been officially awarded. The hunt is ready to be concluded.</div>
                </div>
              </div>
            )}
            <h3 className="text-base font-bold text-white mb-2 font-mono flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> Physical Treasure Boxes (3 Vault Boxes)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Real-time claim and volunteer verification status for the physical prizes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {overview?.prizeBoxes.map((box) => (
                <div
                  key={box.boxNumber}
                  className={`p-4 rounded-xl border transition-all ${
                    box.status === "CONFIRMED"
                      ? "bg-purple-500/10 border-purple-500/30"
                      : box.status === "PENDING_VERIFICATION"
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-surface-50 border-surface-border"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono font-bold text-base text-white">
                      Treasure Box #{box.boxNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        box.status === "CONFIRMED"
                          ? "bg-purple-500/20 text-purple-300"
                          : box.status === "PENDING_VERIFICATION"
                          ? "bg-amber-500/20 text-amber-300 animate-pulse"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {box.status}
                    </span>
                  </div>

                  {box.teamName ? (
                    <div className="text-xs font-mono space-y-1 text-slate-300">
                      <div>
                        Team: <strong className="text-white">{box.teamName}</strong> ({box.teamId})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Code: <span className="text-amber-400 font-bold">{box.claimCode}</span>
                      </div>
                      {box.verifiedBy && (
                        <div className="text-[11px] text-emerald-400">
                          Verified by: {box.verifiedBy}
                        </div>
                      )}
                      {box.claimedAt && (
                        <div className="text-[10px] text-slate-500">
                          {new Date(box.claimedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic font-mono">
                      Awaiting first qualifying team...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          

          

          {/* Physical Treasure Box Clues Configuration Card */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" /> Sequential Physical Box Clues (Checkpoint #10)
              </h3>
              {cluesSuccessMsg && (
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
                  ✓ {cluesSuccessMsg}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-6">
              When teams scan Checkpoint #10, they automatically see the clue for the active prize box. As soon as a box is verified by the Marshall, the clue transitions sequentially (Box 1 → Box 2 → Box 3).
            </p>

            <form onSubmit={handleSaveBoxClues} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Box 1 */}
                <div className="p-4 rounded-xl bg-surface-50 border border-amber-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                      🥇 BOX #1 CLUE (1ST PLACE)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={boxClues[1] || ""}
                    onChange={(e) => setBoxCluesState((prev) => ({ ...prev, 1: e.target.value }))}
                    placeholder="Enter physical location clue for Box 1..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    Displayed to all teams until Box #1 is confirmed by Marshall.
                  </div>
                </div>

                {/* Box 2 */}
                <div className="p-4 rounded-xl bg-surface-50 border border-cyan-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                      🥈 BOX #2 CLUE (2ND PLACE)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={boxClues[2] || ""}
                    onChange={(e) => setBoxCluesState((prev) => ({ ...prev, 2: e.target.value }))}
                    placeholder="Enter physical location clue for Box 2..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    Displayed once Box #1 is won, until Box #2 is confirmed.
                  </div>
                </div>

                {/* Box 3 */}
                <div className="p-4 rounded-xl bg-surface-50 border border-purple-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-purple-400 flex items-center gap-1.5">
                      🥉 BOX #3 CLUE (3RD PLACE)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={boxClues[3] || ""}
                    onChange={(e) => setBoxCluesState((prev) => ({ ...prev, 3: e.target.value }))}
                    placeholder="Enter physical location clue for Box 3..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-purple-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    Displayed once Box #2 is won, until 3rd place is confirmed.
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingClues}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold font-mono text-xs shadow-glow-amber transition-all disabled:opacity-50"
                >
                  {savingClues ? "Saving Clues..." : "Save Physical Box Clues"}
                </button>
              </div>
            </form>
          </div>

          {/* Global Tournament Broadcast Alert Control Card */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" /> Global Tournament Broadcast Alert System
              </h3>
              {activeBroadcastState && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> LIVE BROADCAST ACTIVE
                  </span>
                  <button
                    type="button"
                    onClick={handleClearBroadcast}
                    disabled={sendingBroadcast}
                    className="text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded border border-surface-border bg-surface-50"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Publish an unmissable warning/alert popup to all logged-in teams and mobile devices. Use this to declare the hunt officially over, announce winners, or issue urgent directives.
            </p>

            {broadcastSuccessMsg && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                ✓ {broadcastSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Broadcast Alert Title:
                </label>
                <input
                  type="text"
                  value={broadcastTitleInput}
                  onChange={(e) => setBroadcastTitleInput(e.target.value)}
                  placeholder="e.g. 🚨 THE TREASURE HUNT IS OFFICIALLY OVER!"
                  className="w-full px-3 py-2 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Broadcast Message Body:
                </label>
                <textarea
                  rows={3}
                  value={broadcastMessageInput}
                  onChange={(e) => setBroadcastMessageInput(e.target.value)}
                  placeholder="Enter detailed announcement message..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastTitleInput.trim() || !broadcastMessageInput.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-black font-extrabold font-mono text-xs transition-all shadow-glow-amber disabled:opacity-50 flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {sendingBroadcast ? "Broadcasting..." : "Publish Global Warning Broadcast to All Screens"}
                </button>
              </div>
            </form>
          </div>

          {/* Checkpoint Completion Breakdown Table */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <h3 className="text-base font-bold text-white mb-2 font-mono flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" /> Checkpoint Completion & Traffic Heatmap
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Live statistics showing visits, solves, and active bottleneck counts across all physical checkpoints.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400">
                    <th className="py-2 px-3">STAGE</th>
                    <th className="py-2 px-3">CHECKPOINT</th>
                    <th className="py-2 px-3">LOCATION</th>
                    <th className="py-2 px-3">CURRENT TEAMS</th>
                    <th className="py-2 px-3">QR VISITS</th>
                    <th className="py-2 px-3">SOLVES</th>
                    <th className="py-2 px-3">SOLVE RATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {overview?.checkpointStats.map((cp) => (
                    <tr key={cp.sequenceNumber} className="hover:bg-surface-50/50">
                      <td className="py-2.5 px-3 font-bold text-cyan-400">
                        #{cp.sequenceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {cp.name}
                        {cp.isFinalTreasure && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                            FINAL VAULT
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{cp.campusArea}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-surface-100 text-cyan-300 font-bold">
                          {cp.teamsCurrentlyHere} teams
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{cp.teamsVisited}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">{cp.teamsSolved}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${cp.solveRatePercent}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400">{cp.solveRatePercent}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: CHECKPOINT & QUESTION MANAGEMENT
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "checkpoints" && (
        <div className="space-y-6">
          <div className="glow-card rounded-2xl p-4 sm:p-6 border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" /> Checkpoint, Clue & Question Management
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure physical checkpoints, location clues, riddle questions, and bcrypt-hashed answers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setCpFormName("");
                  setCpFormArea("");
                  setCpFormHint("");
                  setCpFormIsFinal(false);
                  setCpFormPrompt("");
                  setCpFormType("MULTIPLE_CHOICE");
                  setCpFormOptions("Option A, Option B, Option C, Option D");
                  setCpFormAnswer("");
                  setCpFormQuestionHint("");
                  setCpFormPoints(100);
                  setShowAddCheckpointModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-cipher-cyan text-black font-bold text-xs font-mono hover:bg-cyan-300 transition-all flex items-center gap-1.5 shadow-glow-cyan"
              >
                <PlusCircle className="w-4 h-4" /> Add New Checkpoint
              </button>

              <button
                onClick={fetchCheckpoints}
                className="p-2 rounded-xl bg-surface-50 border border-surface-border text-slate-300 hover:text-white"
                title="Refresh checkpoints"
              >
                <RefreshCw className={`w-4 h-4 ${checkpointsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          

          {/* Checkpoint Cards / Table */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400">
                    <th className="py-2.5 px-3">SEQ #</th>
                    <th className="py-2.5 px-3">NAME & LOCATION</th>
                    <th className="py-2.5 px-3">PHYSICAL CLUE</th>
                    <th className="py-2.5 px-3">ATTACHED RIDDLE</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {checkpoints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        {checkpointsLoading ? "Loading checkpoints..." : "No checkpoints configured."}
                      </td>
                    </tr>
                  ) : (
                    checkpoints.map((cp) => (
                      <tr key={cp.id} className="hover:bg-surface-50/50">
                        <td className="py-3 px-3 font-bold text-cyan-400">
                          #{cp.sequenceNumber}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-white font-semibold">{cp.name}</div>
                          {cp.isFinalTreasure && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                              FINAL TREASURE VAULT
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                          {cp.locationHint}
                        </td>
                        <td className="py-3 px-3">
                          {cp.question ? (
                            <div>
                              <div className="text-slate-200 truncate max-w-xs">{cp.question.prompt}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                <span>{cp.question.type}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-400 italic">No Question Set</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cp.active
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {cp.active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => setPreviewingCheckpoint(cp)}
                            className="p-1.5 rounded-lg bg-surface-50 text-slate-300 hover:text-white"
                            title="Preview Question"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCheckpoint(cp);
                              setCpFormName(cp.name);
                              setCpFormArea(cp.campusArea);
                              setCpFormHint(cp.locationHint);
                              setCpFormIsFinal(cp.isFinalTreasure);
                              setCpFormPrompt(cp.question?.prompt || "");
                              setCpFormType((cp.question?.type as any) || "MULTIPLE_CHOICE");
                              setCpFormOptions(cp.question?.options?.join(", ") || "");
                              setCpFormAnswer("");
                              setCpFormQuestionHint(cp.question?.hint || "");
                              setCpFormPoints(cp.question?.points || 100);
                              setCpFormPenaltyTask(cp.penaltyTask || "");
                            }}
                            className="p-1.5 rounded-lg bg-surface-50 text-cyan-400 hover:text-cyan-300"
                            title="Edit Checkpoint & Riddle"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleCheckpointActive(cp)}
                            className={`p-1.5 rounded-lg ${
                              cp.active
                                ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                            title={cp.active ? "Deactivate" : "Activate"}
                          >
                            {cp.active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteCheckpoint(cp)}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                            title="Delete Checkpoint"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: ROUTE MANAGEMENT & VALIDATION
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "routes" && (
        <div className="space-y-6">
          <div className="glow-card rounded-2xl p-4 sm:p-6 border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-purple-400" /> Route Sequences & Anti-Bottleneck Auditor
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Validate that all routes visit each regular checkpoint exactly once and terminate at the final treasure box.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAutoScalePairRoutes}
                disabled={autoScaleLoading}
                className="px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs font-mono hover:bg-amber-300 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-glow-amber"
                title="Counts registered teams and creates N/2 routes so at most 2 teams share any route!"
              >
                <Zap className={`w-4 h-4 ${autoScaleLoading ? "animate-spin" : ""}`} />
                Auto-Scale (2 Teams / Route)
              </button>

              <button
                onClick={handleFetchAutoAssignPreview}
                disabled={autoAssignLoading}
                className="px-4 py-2 rounded-xl bg-cipher-cyan text-black font-bold text-xs font-mono hover:bg-cyan-300 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Shuffle className={`w-4 h-4 ${autoAssignLoading ? "animate-spin" : ""}`} />
                Auto-Assign Unassigned Teams
              </button>

              <button
                onClick={() => {
                  setRouteNameInput("");
                  setRouteDescInput("");
                  setRouteSequenceInput("1, 2, 3, 4, 5, 6, 7, 8");
                  setShowAddRouteModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-purple-500 text-white font-bold text-xs font-mono hover:bg-purple-600 transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" /> Add Route
              </button>

              <button
                onClick={fetchRoutes}
                className="p-2 rounded-xl bg-surface-50 border border-surface-border text-slate-300 hover:text-white"
                title="Audit & refresh routes"
              >
                <RefreshCw className={`w-4 h-4 ${routesLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          

          {/* Validation Report Banner */}
          {routesSummary && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                routesSummary.allValid
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {routesSummary.allValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs font-mono space-y-1">
                <div className="font-bold text-sm">
                  {routesSummary.allValid
                    ? "ALL ROUTES AUDITED & VERIFIED READY FOR LAUNCH"
                    : "ROUTE SEQUENCE VALIDATION WARNINGS DETECTED"}
                </div>
                <div>
                  Active routes: {routesSummary.activeRoutesCount} • Total Configured Checkpoints: {routesSummary.totalConfigured} • Shared Final Treasure: Checkpoint #{routesSummary.finalTreasureSeqNumber}
                </div>
                {routesSummary.capacityWarnings.map((w, idx) => (
                  <div key={idx} className="text-amber-300">
                    ⚠ {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Routes Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routes.map((r) => (
              <div
                key={r.id}
                className={`glow-card rounded-2xl p-5 border ${
                  !r.isValid
                    ? "border-rose-500/40"
                    : "border-surface-border"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-mono font-bold text-base text-white">{r.name}</h4>
                    {r.description && <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        r.isValid
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      {r.isValid ? "VALID" : "INVALID"}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-surface-100 text-slate-300 font-mono">
                      {r.teamCount} teams assigned
                    </span>
                  </div>
                </div>

                {/* Sequence Badges */}
                <div className="my-4">
                  <div className="text-[11px] text-slate-400 font-mono mb-1.5">Checkpoint Sequence:</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.checkpointSequence.map((seq, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span
                          className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                            idx === r.checkpointSequence.length - 1
                              ? "bg-amber-400 text-black shadow-glow-amber"
                              : "bg-surface-50 text-cyan-300 border border-surface-border"
                          }`}
                        >
                          CP#{seq}
                        </span>
                        {idx < r.checkpointSequence.length - 1 && (
                          <span className="text-slate-600 text-xs">&rarr;</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assigned Teams Section */}
                <div className="my-3 pt-3 border-t border-surface-border/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] text-slate-400 font-mono font-bold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-cipher-cyan" />
                      <span>Assigned Teams ({r.assignedTeams?.length || 0}):</span>
                    </div>
                  </div>

                  {r.assignedTeams && r.assignedTeams.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {r.assignedTeams.map((team) => (
                        <div
                          key={team.teamId}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-50 border border-surface-border text-xs font-mono"
                        >
                          <span className="font-bold text-cipher-cyan">{team.teamId}</span>
                          <span className="text-slate-200 font-medium">{team.name}</span>
                          {team.leaderName && (
                            <span className="text-slate-400 text-[10px]">({team.leaderName})</span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase ${
                              team.status === "COMPLETED"
                                ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                                : team.currentStage === "HUNTING"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-700/50 text-slate-400 border border-slate-600/30"
                            }`}
                          >
                            {team.status === "COMPLETED"
                              ? "FINISHED"
                              : team.currentStage === "HUNTING"
                              ? `CP ${(team.currentCheckpointIndex ?? 0) + 1}/${r.checkpointSequence.length}`
                              : team.currentStage}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 font-mono italic">
                      No teams assigned to this route yet.
                    </div>
                  )}
                </div>

                {/* Errors & Warnings */}
                {r.errors.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-mono mb-3 space-y-0.5">
                    {r.errors.map((e, idx) => (
                      <div key={idx}>✕ {e}</div>
                    ))}
                  </div>
                )}

                {r.warnings.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono mb-3 space-y-0.5">
                    {r.warnings.map((w, idx) => (
                      <div key={idx}>⚠ {w}</div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
                  <button
                    onClick={() => {
                      setEditingRoute(r);
                      setRouteNameInput(r.name);
                      setRouteDescInput(r.description || "");
                      setRouteSequenceInput(r.checkpointSequence.join(", "));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-50 hover:bg-surface-100 text-xs font-mono text-cyan-400"
                  >
                    Edit Sequence
                  </button>
                  <button
                    onClick={() => handleDeleteRoute(r)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs font-mono text-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: VOLUNTEER ACCOUNTS & CHECKPOINT ASSIGNMENTS
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "volunteers" && (
        <div className="space-y-6">
          <div className="glow-card rounded-2xl p-4 sm:p-6 border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" /> Volunteer Marshalls & Station Assignments
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Assign volunteers to oversee physical checkpoints or manage prize box handovers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setVolUsername("");
                  setVolName("");
                  setVolEmail("");
                  setVolPassword("");
                  setVolAssignedCp("");
                  setShowAddVolunteerModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-cipher-emerald text-black font-bold text-xs font-mono hover:bg-emerald-400 transition-all flex items-center gap-1.5 shadow-glow-emerald"
              >
                <UserPlus className="w-4 h-4" /> Add Volunteer
              </button>

              <button
                onClick={fetchVolunteers}
                className="p-2 rounded-xl bg-surface-50 border border-surface-border text-slate-300 hover:text-white"
                title="Refresh volunteers"
              >
                <RefreshCw className={`w-4 h-4 ${volunteersLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          

          {/* Volunteers Table */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400">
                    <th className="py-2.5 px-3">USERNAME</th>
                    <th className="py-2.5 px-3">FULL NAME</th>
                    <th className="py-2.5 px-3">EMAIL</th>
                    <th className="py-2.5 px-3">ASSIGNED CHECKPOINT</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {volunteers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        {volunteersLoading ? "Loading volunteers..." : "No volunteer accounts registered."}
                      </td>
                    </tr>
                  ) : (
                    volunteers.map((v) => (
                      <tr key={v.id} className="hover:bg-surface-50/50">
                        <td className="py-3 px-3 font-bold text-cyan-400">{v.username}</td>
                        <td className="py-3 px-3 text-white font-semibold">{v.name}</td>
                        <td className="py-3 px-3 text-slate-400">{v.email}</td>
                        <td className="py-3 px-3 text-emerald-400">
                          {v.assignedCheckpointId ? `CP ${v.assignedCheckpointId}` : "All / Roving Marshall"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.active
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {v.active ? "ACTIVE" : "DISABLED"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingVolunteer(v);
                              setVolName(v.name);
                              setVolEmail(v.email);
                              setVolAssignedCp(v.assignedCheckpointId || "");
                              setVolPassword("");
                            }}
                            className="p-1.5 rounded-lg bg-surface-50 text-cyan-400 hover:text-cyan-300"
                            title="Edit Volunteer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleVolunteerActive(v)}
                            className={`p-1.5 rounded-lg ${
                              v.active
                                ? "bg-rose-500/10 text-rose-400"
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}
                            title={v.active ? "Disable" : "Enable"}
                          >
                            {v.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 5: TEAM ID POOL & BULK GENERATION
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "team-ids" && (
        <div className="space-y-6">
          <div className="glow-card rounded-2xl p-4 sm:p-6 border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowBulkGenModal(true)}
                className="px-4 py-2 rounded-xl bg-cipher-cyan text-black font-bold text-xs font-mono hover:bg-cyan-300 transition-all flex items-center gap-1.5 shadow-glow-cyan"
              >
                <PlusCircle className="w-4 h-4" /> Bulk Generate Team IDs
              </button>

              <button
                onClick={() => setShowPrintSlipsModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs font-mono hover:bg-amber-300 transition-all flex items-center gap-1.5 shadow-glow-amber"
              >
                <Printer className="w-4 h-4" /> Print Team Slips / Badges
              </button>

              <button
                onClick={fetchTeamIds}
                className="p-2 rounded-xl bg-surface-50 border border-surface-border text-slate-300 hover:text-white"
                title="Refresh pool"
              >
                <RefreshCw className={`w-4 h-4 ${teamIdsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-surface-50 p-1 rounded-xl border border-surface-border text-xs font-mono">
                {(["ALL", "AVAILABLE", "ASSIGNED", "DISABLED"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTeamIdFilter(filter)}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      teamIdFilter === filter
                        ? "bg-amber-400 text-black font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter TEAM###..."
                  value={teamIdSearch}
                  onChange={(e) => setTeamIdSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchTeamIds()}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-surface-50 border border-surface-border text-xs font-mono text-white focus:outline-none focus:border-cyan-400 w-44"
                />
              </div>
            </div>
          </div>

          

          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400">
                    <th className="py-2.5 px-3">TEAM ID</th>
                    <th className="py-2.5 px-3">SEQ #</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">ASSIGNED TO</th>
                    <th className="py-2.5 px-3">BATCH TAG</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {teamIds.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        {teamIdsLoading ? "Loading Team IDs..." : "No Team IDs found."}
                      </td>
                    </tr>
                  ) : (
                    teamIds.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-50/50">
                        <td className="py-3 px-3 text-cyan-400 font-bold">{item.teamId}</td>
                        <td className="py-3 px-3 text-slate-400">#{item.sequenceNumber}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.status === "AVAILABLE"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : item.status === "ASSIGNED"
                                ? "bg-cyan-500/20 text-cyan-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {item.assignedTeamName || "—"}
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">{item.batchTag}</td>
                        <td className="py-3 px-3 text-right">
                          {item.status !== "ASSIGNED" ? (
                            <button
                              onClick={() => handleToggleTeamId(item.id, item.status)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] ${
                                item.status === "DISABLED"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-rose-500/10 text-rose-400"
                              }`}
                            >
                              {item.status === "DISABLED" ? "Enable" : "Disable"}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[11px]">Locked (Active)</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 6: REGISTRATION APPROVALS & SPOT ENTRY
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "registrations" && (
        <div className="space-y-6">
          <div className="glow-card rounded-2xl p-4 sm:p-6 border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" /> Incoming Applications & On-Site Spot Desk
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowSpotModal(true)}
                className="px-4 py-2 rounded-xl bg-cipher-emerald text-black font-bold text-xs font-mono hover:bg-emerald-400 transition-all flex items-center gap-1.5 shadow-glow-emerald"
              >
                <PlusCircle className="w-4 h-4" /> + Authorized Spot Registration
              </button>

              <div className="flex bg-surface-50 p-1 rounded-xl border border-surface-border text-xs font-mono">
                {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setRegFilter(filter)}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      regFilter === filter
                        ? "bg-amber-400 text-black font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          

          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400">
                    <th className="py-2.5 px-3">TEAM NAME</th>
                    <th className="py-2.5 px-3">LEADER CONTACT</th>
                    <th className="py-2.5 px-3">CREW</th>
                    <th className="py-2.5 px-3">TYPE</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">ALLOCATED ID</th>
                    <th className="py-2.5 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        {regsLoading ? "Loading registrations..." : "No registrations found in this category."}
                      </td>
                    </tr>
                  ) : (
                    registrations.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-50/50">
                        <td className="py-3 px-3 text-white font-semibold">{r.teamName}</td>
                        <td className="py-3 px-3 text-slate-300">
                          <div>{r.leaderName}</div>
                          <div className="text-[11px] text-slate-500">{r.leaderEmail}</div>
                          <div className="text-[11px] text-slate-500">{r.leaderPhone}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {r.members.length + 1} members
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.registrationType === "SPOT"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {r.registrationType}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              r.status === "APPROVED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : r.status === "PENDING"
                                ? "bg-amber-500/20 text-amber-400 animate-pulse"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-cyan-400">
                          {r.allocatedTeamId || "—"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {r.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setApprovingReg(r)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectingReg(r)}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[11px]"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 7: TEAMS ROSTER
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "teams" && (
        <div className="glow-card rounded-2xl p-6 border-surface-border">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono">
                Live Team Roster ({teams.length} Teams Registered)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage team participation status, monitor live route assignments, and resolve routing anomalies.
              </p>
            </div>
            <button
              onClick={fetchOverviewData}
              className="p-2 rounded-lg bg-surface-50 text-slate-300 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Unassigned Teams Warning Banner */}
          {teams.filter((t) => !t.routeId || t.routeName === "Unassigned" || t.routeName === "None" || t.isRouteValid === false).length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5 text-xs font-mono text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>{teams.filter((t) => !t.routeId || t.routeName === "Unassigned" || t.routeName === "None" || t.isRouteValid === false).length} approved team(s)</strong> do not have a valid route assigned!
                </span>
              </div>
              <button
                onClick={handleFetchAutoAssignPreview}
                disabled={autoAssignLoading}
                className="px-3 py-1.5 rounded-lg bg-cipher-cyan text-black font-bold text-xs font-mono hover:bg-cyan-300 transition-all flex items-center gap-1.5 shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Auto-Assign All
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-surface-border text-slate-400">
                  <th className="py-2.5 px-3">TEAM ID</th>
                  <th className="py-2.5 px-3">TEAM NAME</th>
                  <th className="py-2.5 px-3">LEADER CONTACT</th>
                  <th className="py-2.5 px-3">ROUTE</th>
                  <th className="py-2.5 px-3">PROGRESS</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {teams.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-50/50">
                    <td className="py-3 px-3 text-cyan-400 font-bold">{t.teamId}</td>
                    <td className="py-3 px-3 text-white font-semibold">{t.name}</td>
                    <td className="py-3 px-3 text-slate-300">
                      <div>{t.leaderName}</div>
                      <div className="text-[11px] text-slate-500">{t.leaderPhone}</div>
                    </td>
                    <td className="py-3 px-3">
                      {!t.routeId || t.routeName === "Unassigned" || t.routeName === "None" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          UNASSIGNED
                        </span>
                      ) : t.isRouteValid === false ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          INVALID ROUTE
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">{t.routeName}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-cyan-400 font-bold font-mono">
                          {t.completedCount} / {checkpointCount} CPs
                        </span>
                        {t.status === "COMPLETED" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            100% DONE
                          </span>
                        )}
                      </div>

                      {t.routeSequence && t.routeSequence.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1 max-w-sm">
                          {t.routeSequence.map((seq, idx) => {
                            const isCompleted =
                              t.status === "COMPLETED" ||
                              t.currentStage === "FINISHED" ||
                              idx < t.currentCheckpointIndex;
                            const isCurrent =
                              !isCompleted &&
                              (t.currentStage === "HUNTING" || t.status === "IN_PROGRESS") &&
                              idx === t.currentCheckpointIndex;
                            const isFinal = idx === t.routeSequence!.length - 1;

                            return (
                              <span
                                key={idx}
                                title={`Checkpoint #${seq} - ${
                                  isCompleted
                                    ? "Completed ✓"
                                    : isCurrent
                                    ? "Active In Progress ⏳"
                                    : "Locked 🔒"
                                }`}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 transition-all ${
                                  isCompleted
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : isCurrent
                                    ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.3)] animate-pulse"
                                    : "bg-surface-50 text-slate-500 border border-surface-border/60 opacity-60"
                                }`}
                              >
                                CP#{seq}
                                {isCompleted ? (
                                  <span className="text-emerald-400 font-black text-[10px]">✓</span>
                                ) : isCurrent ? (
                                  <span className="text-cyan-300 text-[10px]">⏳</span>
                                ) : isFinal ? (
                                  <span className="text-amber-500 text-[9px]">🏆</span>
                                ) : (
                                  <span className="text-slate-600 text-[9px]">🔒</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic">No route assigned</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          t.status === "COMPLETED"
                            ? "bg-purple-500/20 text-purple-300"
                            : t.status === "DISQUALIFIED"
                            ? "bg-rose-500/20 text-rose-400"
                            : t.status === "IN_PROGRESS"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setRouteAssignTargetTeam(t);
                            setSelectedTargetRouteId(t.routeId || (routes.find((r) => r.isValid)?.id || ""));
                            setRouteOverrideReason("");
                            setRouteAssignError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-mono flex items-center gap-1"
                          title="Assign or reassign route"
                        >
                          <RouteIcon className="w-3 h-3" />
                          Route
                        </button>

                        {t.status === "DISQUALIFIED" ? (
                          <button
                            onClick={() => {
                              setTeamStatusTarget(t);
                              setTeamTargetNewStatus("WAITING");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px]"
                          >
                            Reinstate
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setTeamStatusTarget(t);
                              setTeamTargetNewStatus("DISQUALIFIED");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[11px]"
                          >
                            Disqualify
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteTeam(t)}
                          className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-mono flex items-center gap-1 transition-all"
                          title="Permanently remove team from roster"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 8: MASTER EVENT REPORTS & DATA EXPORTS
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="glow-card rounded-2xl p-4 sm:p-6 border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Event Reporting & Data Exports
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Download real-time audit reports for team progress, checkpoint completions, and prize claims.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportReportJson}
                className="px-4 py-2 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono flex items-center gap-1.5 hover:bg-surface-100"
              >
                <Download className="w-3.5 h-3.5" /> Export Full JSON Report
              </button>
              <button
                onClick={fetchReports}
                className="p-2 rounded-xl bg-surface-50 border border-surface-border text-slate-300 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${reportsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          

          {/* Standings Report Table */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <h4 className="font-mono font-bold text-white text-sm mb-3">Live Team Standings</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400">
                    <th className="py-2 px-3">RANK</th>
                    <th className="py-2 px-3">TEAM ID</th>
                    <th className="py-2 px-3">TEAM NAME</th>
                    <th className="py-2 px-3">ROUTE</th>
                    <th className="py-2 px-3">COMPLETED</th>
                    <th className="py-2 px-3">DURATION</th>
                    <th className="py-2 px-3">PRIZE CLAIM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {reportsData?.teamProgress.map((tp: any) => (
                    <tr key={tp.id} className="hover:bg-surface-50/50">
                      <td className="py-2.5 px-3 font-bold text-amber-400">#{tp.rank}</td>
                      <td className="py-2.5 px-3 text-cyan-400 font-bold">{tp.teamId}</td>
                      <td className="py-2.5 px-3 font-semibold text-white">{tp.name}</td>
                      <td className="py-2.5 px-3 text-slate-300">{tp.routeName}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">{tp.completedCheckpoints} CPs</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {tp.durationMinutes ? `${tp.durationMinutes} mins` : "In Progress"}
                      </td>
                      <td className="py-2.5 px-3">
                        {tp.prizeClaim ? (
                          <span className="text-amber-400 font-bold">Box #{tp.prizeClaim.boxNumber}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 9: CAMPUS QR CODES & PRINTABLE SHEETS
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "qrcodes" && (
        <div className="space-y-6">
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-cyan-400" /> Physical Checkpoint QR Deployments
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Cryptographic QR codes for all physical checkpoints. Print and mount at campus locations.
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-surface-50 border border-surface-border text-slate-200 hover:text-white text-xs font-mono flex items-center gap-2 self-start"
              >
                <Printer className="w-4 h-4" /> Print Checkpoint Sheets
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
              {qrCodes.map((cp) => (
                <div
                  key={cp.id}
                  className="bg-white text-slate-900 rounded-xl p-5 shadow-lg border-2 border-slate-300 flex flex-col items-center text-center font-sans"
                >
                  <div className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase">
                    TECH MYSTERY HUNT • CHECKPOINT #{cp.sequenceNumber}
                  </div>
                  <h4 className="text-lg font-bold text-slate-950 mt-1 mb-3">{cp.name}</h4>

                  <div className="p-2 bg-white rounded-lg border border-slate-300 mb-3">
                    <img
                      src={cp.qrDataUrl}
                      alt={`QR code for ${cp.name}`}
                      className="w-48 h-48 object-contain"
                    />
                  </div>

                  <div className="text-[11px] font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded w-full break-all mb-2">
                    TOKEN: {cp.qrCodeToken}
                  </div>

                  <div className="text-xs text-slate-600 italic">
                    Location: {cp.campusArea}
                  </div>
                </div>
              ))}
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: GAME STATE CONFIRMATION (START / FINISH / PAUSE)
          ═══════════════════════════════════════════════════════════════════════ */}
      {confirmGameAction && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-amber-500/40 shadow-glow-amber space-y-4">
            <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" /> {confirmGameAction.title}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmGameAction.description}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmGameAction(null)}
                className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedGameAction}
                className={`px-5 py-2 rounded-xl font-bold text-xs font-mono ${
                  confirmGameAction.isDestructive
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-cipher-cyan text-black hover:bg-cyan-300"
                }`}
              >
                Confirm & Proceed
              </button>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT CHECKPOINT & RIDDLE
          ═══════════════════════════════════════════════════════════════════════ */}
      {(showAddCheckpointModal || editingCheckpoint) && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-xl w-full glow-card rounded-2xl p-6 border-surface-border space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                {editingCheckpoint ? `Edit Checkpoint #${editingCheckpoint.sequenceNumber}` : "Create New Checkpoint"}
              </h3>
              <button
                onClick={() => {
                  setShowAddCheckpointModal(false);
                  setEditingCheckpoint(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={editingCheckpoint ? handleUpdateCheckpoint : handleSaveNewCheckpoint}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Checkpoint Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Cryptic Server Vault"
                  value={cpFormName}
                  onChange={(e) => setCpFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Physical Clue / Location Hint (Shown before QR scan) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Cryptic clue guiding the team to locate the physical checkpoint on campus..."
                  value={cpFormHint}
                  onChange={(e) => setCpFormHint(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-50 border border-surface-border text-xs">
                <input
                  type="checkbox"
                  id="finalVaultCheckbox"
                  checked={cpFormIsFinal}
                  onChange={(e) => setCpFormIsFinal(e.target.checked)}
                  className="rounded bg-surface-100 border-surface-border text-amber-400"
                />
                <label htmlFor="finalVaultCheckbox" className="text-slate-300 font-mono">
                  Designate as Final Treasure Vault Checkpoint
                </label>
              </div>

              {/* Riddle / Question Details */}
              <div className="border-t border-surface-border pt-3 space-y-3">
                <h4 className="text-xs font-bold text-cyan-400 font-mono">RIDDLE & QUESTION</h4>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Riddle Prompt *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter the riddle puzzle prompt presented to the team upon scanning the QR code..."
                    value={cpFormPrompt}
                    onChange={(e) => setCpFormPrompt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Question Type</label>
                  <select
                    value={cpFormType}
                    onChange={(e) => setCpFormType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                  >
                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                    <option value="TEXT">Direct Text Answer</option>
                    <option value="NUMERIC">Numeric Answer</option>
                    <option value="CODE_CIPHER">Code Cipher</option>
                  </select>
                </div>

                {cpFormType === "MULTIPLE_CHOICE" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Options (Comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="Choice 1, Choice 2, Choice 3, Choice 4"
                      value={cpFormOptions}
                      onChange={(e) => setCpFormOptions(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {editingCheckpoint
                      ? "New Accepted Answer (Leave blank to keep existing bcrypt hash)"
                      : "Accepted Answer (Hashed with bcrypt upon saving) *"}
                  </label>
                  <input
                    type="text"
                    required={!editingCheckpoint}
                    placeholder="Correct answer string"
                    value={cpFormAnswer}
                    onChange={(e) => setCpFormAnswer(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs font-mono uppercase"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Answers are securely hashed with bcrypt cost factor 10. The plaintext is never stored or returned in APIs.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Emergency Hint (Unlocks after threshold failed attempts)
                  </label>
                  <input
                    type="text"
                    placeholder="Optional clue hint..."
                    value={cpFormQuestionHint}
                    onChange={(e) => setCpFormQuestionHint(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                  />
                </div>

                {/* Video Penalty Task on Wrong Answer */}
                <div className="pt-3 border-t border-surface-border">
                  <label className="block text-xs font-semibold text-amber-300 mb-1 flex items-center gap-1.5 font-mono">
                    🎬 Video Penalty Task (Assigned if team submits wrong answer)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. All team members do 10 jumping jacks together while shouting team name, and send video to WhatsApp helpline..."
                    value={cpFormPenaltyTask}
                    onChange={(e) => setCpFormPenaltyTask(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-amber-500/30 text-amber-200 text-xs focus:border-amber-400 placeholder:text-slate-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    When teams answer incorrectly, they must record this video task and submit via WhatsApp. Volunteer/Admin verifies it to unlock their next coordinate.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCheckpointModal(false);
                    setEditingCheckpoint(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cpSubmitting}
                  className="px-5 py-2 rounded-xl bg-cipher-cyan text-black font-bold text-xs font-mono hover:bg-cyan-300 disabled:opacity-50"
                >
                  {cpSubmitting ? "Saving..." : editingCheckpoint ? "Update Checkpoint" : "Create Checkpoint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: SECURE CLUE & QUESTION PREVIEW
          ═══════════════════════════════════════════════════════════════════════ */}
      {previewingCheckpoint && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-surface-border space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                Checkpoint #{previewingCheckpoint.sequenceNumber} Preview
              </h3>
              <button
                onClick={() => setPreviewingCheckpoint(null)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-surface-50 border border-surface-border">
                <div className="text-slate-400 text-[10px] uppercase">Physical Clue (Before Scan)</div>
                <div className="text-white mt-1 italic">&ldquo;{previewingCheckpoint.locationHint}&rdquo;</div>
              </div>

              {previewingCheckpoint.question ? (
                <div className="p-3 rounded-lg bg-surface-50 border border-surface-border space-y-2">
                  <div className="text-slate-400 text-[10px] uppercase">Riddle Puzzle (After Scan)</div>
                  <div className="text-white font-semibold">{previewingCheckpoint.question.prompt}</div>

                  {previewingCheckpoint.question.options.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {previewingCheckpoint.question.options.map((opt, i) => (
                        <div key={i} className="p-1.5 rounded bg-surface-100 text-slate-300 text-[11px]">
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {previewingCheckpoint.question.hint && (
                    <div className="text-amber-300 text-[11px] pt-1">
                      💡 Emergency Hint: {previewingCheckpoint.question.hint}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-rose-400">No question set for this checkpoint.</div>
              )}
            </div>

            <button
              onClick={() => setPreviewingCheckpoint(null)}
              className="w-full py-2.5 rounded-xl bg-surface-100 text-white font-bold text-xs font-mono hover:bg-surface-50"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT ROUTE
          ═══════════════════════════════════════════════════════════════════════ */}
      {(showAddRouteModal || editingRoute) && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-surface-border space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-purple-400" />
                {editingRoute ? `Edit Route: ${editingRoute.name}` : "Create New Route"}
              </h3>
              <button
                onClick={() => {
                  setShowAddRouteModal(false);
                  setEditingRoute(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingRoute ? handleUpdateRoute : handleSaveRoute} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Route Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Route Epsilon"
                  value={routeNameInput}
                  onChange={(e) => setRouteNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Outer campus perimeter path"
                  value={routeDescInput}
                  onChange={(e) => setRouteDescInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Checkpoint Sequence (Comma-separated sequence numbers) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1, 3, 5, 2, 4, 6, 7, 8"
                  value={routeSequenceInput}
                  onChange={(e) => setRouteSequenceInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Must visit each regular checkpoint exactly once and terminate at the final treasure vault checkpoint.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRouteModal(false);
                    setEditingRoute(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={routeSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-500 text-white font-bold text-xs font-mono hover:bg-purple-600 disabled:opacity-50"
                >
                  {routeSubmitting ? "Validating..." : editingRoute ? "Save Route" : "Create Route"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT VOLUNTEER
          ═══════════════════════════════════════════════════════════════════════ */}
      {(showAddVolunteerModal || editingVolunteer) && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-surface-border space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                {editingVolunteer ? `Edit Volunteer: ${editingVolunteer.username}` : "Create Volunteer Account"}
              </h3>
              <button
                onClick={() => {
                  setShowAddVolunteerModal(false);
                  setEditingVolunteer(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingVolunteer ? handleUpdateVolunteer : handleSaveVolunteer} className="space-y-4">
              {!editingVolunteer && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. volunteer_vault"
                    value={volUsername}
                    onChange={(e) => setVolUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Kumar"
                  value={volName}
                  onChange={(e) => setVolName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="volunteer@techfest.college.edu"
                  value={volEmail}
                  onChange={(e) => setVolEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {editingVolunteer ? "New Password (Leave blank to keep unchanged)" : "Password *"}
                </label>
                <input
                  type="password"
                  required={!editingVolunteer}
                  placeholder="At least 8 characters"
                  value={volPassword}
                  onChange={(e) => setVolPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assigned Checkpoint (Optional)
                </label>
                <select
                  value={volAssignedCp}
                  onChange={(e) => setVolAssignedCp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                >
                  <option value="">Roving Marshall (All Checkpoints / Prize Vault)</option>
                  {checkpoints.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      CP #{cp.sequenceNumber}: {cp.name} ({cp.campusArea})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddVolunteerModal(false);
                    setEditingVolunteer(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={volSubmitting}
                  className="px-5 py-2 rounded-xl bg-cipher-emerald text-black font-bold text-xs font-mono hover:bg-emerald-400 disabled:opacity-50"
                >
                  {volSubmitting ? "Saving..." : editingVolunteer ? "Update Volunteer" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: BULK GENERATE TEAM IDS
          ═══════════════════════════════════════════════════════════════════════ */}
      {showBulkGenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-surface-border space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" /> Bulk Generate Team IDs
              </h3>
              <button onClick={() => setShowBulkGenModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Number of IDs to Generate (1 – 500)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={bulkCount}
                  onChange={(e) => setBulkCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Batch Tag</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ROUND1_BATCH"
                  value={bulkBatchTag}
                  onChange={(e) => setBulkBatchTag(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-sm font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkGenModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSubmitting}
                  className="px-5 py-2 rounded-xl bg-cipher-cyan text-black font-bold text-xs font-mono hover:bg-cyan-300 disabled:opacity-50"
                >
                  {bulkSubmitting ? "Generating..." : `Generate ${bulkCount} IDs`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: PRINT TEAM CREDENTIAL SLIPS
          ═══════════════════════════════════════════════════════════════════════ */}
      {showPrintSlipsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-start p-4 overflow-y-auto">
          <div className="max-w-4xl w-full glow-card rounded-2xl p-6 border-surface-border space-y-4 my-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-border pb-4 gap-3 print:hidden">
              <div>
                <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <Printer className="w-5 h-5 text-amber-400" /> Printable Team Credential Badges
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Print physical token slips to distribute to teams at desk registration. Teams use this ID and Passcode to log in on event day.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-extrabold text-xs font-mono transition-all shadow-glow-amber flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print Slips Now (Ctrl + P)
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintSlipsModal(false)}
                  className="p-2 rounded-xl bg-surface-50 text-slate-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Options Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface-50 border border-surface-border text-xs font-mono print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Filter:</span>
                {(["AVAILABLE", "ALL", "ASSIGNED"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPrintSlipFilter(mode)}
                    className={`px-3 py-1 rounded-lg ${
                      printSlipFilter === mode
                        ? "bg-amber-400 text-black font-bold"
                        : "bg-surface-100 text-slate-300 hover:text-white"
                    }`}
                  >
                    {mode} ({mode === "ALL" ? teamIds.length : teamIds.filter(t => t.status === mode).length})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">Slip Passcode:</span>
                <input
                  type="text"
                  value={printSlipPasscode}
                  onChange={(e) => setPrintSlipPasscode(e.target.value)}
                  className="px-3 py-1 rounded-lg bg-surface-100 border border-surface-border text-white text-xs font-mono w-28"
                  placeholder="Passcode"
                />
              </div>
            </div>

            {/* Printable Slips Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-2 print:gap-4 print:text-black max-h-[70vh] overflow-y-auto p-1">
              {teamIds
                .filter((t) => printSlipFilter === "ALL" || t.status === printSlipFilter)
                .map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl border-2 border-dashed border-slate-700 bg-surface-50/80 text-slate-200 relative print:border-black print:bg-white print:text-black flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-surface-border print:border-black pb-2 mb-2.5">
                        <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-cyan-400 print:text-black">
                          TECH MYSTERY HUNT 2026
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-100 print:bg-gray-200 text-slate-400 print:text-black">
                          #{t.sequenceNumber}
                        </span>
                      </div>

                      <div className="my-2 text-center">
                        <div className="text-[11px] text-slate-400 print:text-gray-600 font-mono">OFFICIAL TEAM ID</div>
                        <div className="text-2xl font-extrabold text-amber-400 print:text-black font-mono tracking-wider">
                          {t.teamId}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-surface-100 print:bg-gray-100 border border-surface-border print:border-gray-300 font-mono text-center my-2 space-y-0.5">
                        <div className="text-[10px] text-slate-400 print:text-gray-600">PORTAL LOGIN PASSCODE:</div>
                        <div className="text-sm font-bold text-white print:text-black tracking-widest">
                          {printSlipPasscode || "hunt123"}
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 print:text-gray-700 space-y-0.5 mt-2 font-mono">
                        <div>1. Visit portal on mobile: <strong className="text-cyan-400 print:text-black">{typeof window !== "undefined" ? window.location.origin : "http://college-hunt"}/login</strong></div>
                        <div>2. Enter this Team ID & Passcode.</div>
                        <div>3. Enter your Team Name & Leader Name.</div>
                        <div>4. Wait in Lobby until Admin starts hunt!</div>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-500 print:text-gray-500 pt-2 mt-2 border-t border-dashed border-slate-700 print:border-gray-400 flex justify-between items-center font-mono">
                      <span>✂️ Cut along dashed border</span>
                      <span className="font-bold text-emerald-400 print:text-black">{t.status}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      {showSpotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-xl w-full glow-card rounded-2xl p-6 border-surface-border space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" /> Authorized On-Site Spot Registration
              </h3>
              <button onClick={() => setShowSpotModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSpotRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Team Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Team Alpha"
                    value={spotTeamName}
                    onChange={(e) => setSpotTeamName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Leader Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Leader Name"
                    value={spotLeaderName}
                    onChange={(e) => setSpotLeaderName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Leader Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="leader@college.edu"
                    value={spotLeaderEmail}
                    onChange={(e) => setSpotLeaderEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Leader Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={spotLeaderPhone}
                    onChange={(e) => setSpotLeaderPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
                  />
                </div>
              </div>

              {/* Teammates */}
              <div className="border-t border-surface-border pt-3">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-slate-300">Teammates (1-3 members)</label>
                  {spotMembers.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setSpotMembers([...spotMembers, { name: "", collegeId: "", phone: "" }])}
                      className="text-[11px] text-cyan-400 hover:underline font-mono"
                    >
                      + Add Member
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {spotMembers.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2 bg-surface-50/50 p-2 rounded-lg border border-surface-border">
                      <input
                        type="text"
                        required
                        placeholder={`Member #${idx + 2} Name`}
                        value={m.name}
                        onChange={(e) => {
                          const updated = [...spotMembers];
                          updated[idx].name = e.target.value;
                          setSpotMembers(updated);
                        }}
                        className="px-2.5 py-1.5 rounded bg-surface-100 border border-surface-border text-white text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="College Roll ID"
                        value={m.collegeId}
                        onChange={(e) => {
                          const updated = [...spotMembers];
                          updated[idx].collegeId = e.target.value;
                          setSpotMembers(updated);
                        }}
                        className="px-2.5 py-1.5 rounded bg-surface-100 border border-surface-border text-white text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowSpotModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={spotSubmitting}
                  className="px-5 py-2 rounded-xl bg-cipher-emerald text-black font-bold text-xs font-mono hover:bg-emerald-400 disabled:opacity-50"
                >
                  {spotSubmitting ? "Registering..." : "Complete Spot Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: CREDENTIAL SLIP
          ═══════════════════════════════════════════════════════════════════════ */}
      {issuedSlip && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-surface-100 rounded-2xl p-6 border-2 border-cipher-emerald shadow-glow-emerald space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-cipher-emerald/20 border border-cipher-emerald/40 text-cipher-emerald flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-mono">SPOT REGISTRATION PASS</h3>
            </div>

            <div className="bg-surface-300 p-4 rounded-xl border border-surface-border space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">TEAM ID:</span>
                <span className="text-cyan-400 font-bold text-base">{issuedSlip.teamId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">TEAM NAME:</span>
                <span className="text-white font-semibold">{issuedSlip.teamName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">ROUTE:</span>
                <span className="text-emerald-400 font-semibold">{issuedSlip.routeName}</span>
              </div>
              <div className="border-t border-surface-border pt-2 flex justify-between items-center">
                <span className="text-amber-400 font-bold">PASSWORD:</span>
                <span className="text-amber-300 font-bold text-base bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  {issuedSlip.initialPassword}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={copySlipToClipboard}
                className="flex-1 py-2.5 rounded-xl bg-surface-50 border border-surface-border text-slate-200 hover:text-white text-xs font-mono flex items-center justify-center gap-1.5"
              >
                {slipCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {slipCopied ? "Copied!" : "Copy Pass"}
              </button>
              <button
                type="button"
                onClick={() => setIssuedSlip(null)}
                className="flex-1 py-2.5 rounded-xl bg-cipher-cyan text-black font-bold text-xs font-mono hover:bg-cyan-300"
              >
                Close
              </button>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: APPROVE PENDING REGISTRATION
          ═══════════════════════════════════════════════════════════════════════ */}
      {approvingReg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-surface-border space-y-4">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" /> Approve Team Registration
            </h3>
            <p className="text-xs text-slate-300">
              Approve <strong className="text-white font-mono">{approvingReg.teamName}</strong>?
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Specific Team ID (Optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank for next available ID"
                value={overrideTeamId}
                onChange={(e) => setOverrideTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs font-mono uppercase"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setApprovingReg(null);
                  setOverrideTeamId("");
                }}
                className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="px-5 py-2 rounded-xl bg-cipher-emerald text-black font-bold text-xs font-mono hover:bg-emerald-400"
              >
                Confirm Approval
              </button>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: REJECT REGISTRATION
          ═══════════════════════════════════════════════════════════════════════ */}
      {rejectingReg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-surface-border space-y-4">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <UserX className="w-4 h-4 text-rose-400" /> Reject Registration
            </h3>
            <p className="text-xs text-slate-300">
              Reject registration for <strong className="text-white font-mono">{rejectingReg.teamName}</strong>?
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Reason / Note</label>
              <input
                type="text"
                placeholder="Reason for rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingReg(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-5 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs font-mono hover:bg-rose-600"
              >
                Confirm Rejection
              </button>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: TEAM STATUS CHANGE CONFIRMATION
          ═══════════════════════════════════════════════════════════════════════ */}
      {teamStatusTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-surface-border space-y-4">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" /> Confirm Team Status Change
            </h3>
            <p className="text-xs text-slate-300">
              Change status of team <strong className="text-cyan-400 font-mono">{teamStatusTarget.teamId}</strong> ({teamStatusTarget.name}) to <span className="font-mono text-amber-300 font-bold">{teamTargetNewStatus}</span>?
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Reason</label>
              <input
                type="text"
                placeholder="Audit note"
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTeamStatusTarget(null);
                  setStatusChangeReason("");
                }}
                className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateTeamStatus}
                className={`px-5 py-2 rounded-xl font-bold text-xs font-mono ${
                  teamTargetNewStatus === "DISQUALIFIED"
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-cipher-cyan text-black hover:bg-cyan-300"
                }`}
              >
                Confirm Status
              </button>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: AUTO-ASSIGN UNASSIGNED TEAMS PREVIEW
          ═══════════════════════════════════════════════════════════════════════ */}
      {showAutoAssignModal && autoAssignPreview && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full glow-card rounded-2xl p-6 border-surface-border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-cyan-400" />
                Automatic Route Balancing Preview
              </h3>
              <button
                onClick={() => setShowAutoAssignModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Discovered <strong className="text-cyan-400 font-mono">{autoAssignPreview.unassignedCount} unassigned team(s)</strong>.
              Below is the projected load balancing distribution across valid active routes:
            </p>

            {/* Projected Distribution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {autoAssignPreview.availableRoutes.map((r) => (
                <div key={r.id} className="p-3 rounded-xl bg-surface-50 border border-surface-border font-mono text-xs">
                  <div className="font-bold text-white">{r.name}</div>
                  <div className="text-slate-400 mt-1 flex justify-between">
                    <span>Current: <strong className="text-slate-200">{r.currentCount}</strong></span>
                    <span>&rarr;</span>
                    <span>Projected: <strong className="text-emerald-400">{r.projectedCount}</strong> (+{r.projectedCount - r.currentCount})</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Proposed Assignments Table */}
            <div className="mt-4">
              <div className="text-xs font-mono font-bold text-slate-300 mb-2">
                Proposed Assignments ({autoAssignPreview.proposedAssignments.length}):
              </div>
              <div className="max-h-48 overflow-y-auto border border-surface-border rounded-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-surface-100 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">TEAM ID</th>
                      <th className="py-2 px-3">TEAM NAME</th>
                      <th className="py-2 px-3">PROPOSED ROUTE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {autoAssignPreview.proposedAssignments.map((p, idx) => (
                      <tr key={idx} className="hover:bg-surface-50/50">
                        <td className="py-2 px-3 text-cyan-400 font-bold">{p.teamId}</td>
                        <td className="py-2 px-3 text-white">{p.teamName}</td>
                        <td className="py-2 px-3 text-emerald-400 font-semibold">{p.proposedRouteName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setShowAutoAssignModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={autoAssignApplying || autoAssignPreview.unassignedCount === 0}
                onClick={handleApplyAutoAssign}
                className="px-5 py-2 rounded-xl bg-cipher-emerald text-black font-bold text-xs font-mono hover:bg-emerald-300 disabled:opacity-50"
              >
                {autoAssignApplying ? "Applying Assignments..." : "Confirm & Apply All Assignments"}
              </button>
            </div>
          </div>

          
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: INDIVIDUAL TEAM ROUTE ASSIGNMENT / REPAIR
          ═══════════════════════════════════════════════════════════════════════ */}
      {routeAssignTargetTeam && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-surface-border space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-purple-400" />
                Assign Route: {routeAssignTargetTeam.teamId}
              </h3>
              <button
                onClick={() => setRouteAssignTargetTeam(null)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIndividualRouteAssign} className="space-y-4">
              <div>
                <div className="text-xs text-slate-400 font-mono">Team:</div>
                <div className="text-sm font-bold text-white">{routeAssignTargetTeam.name} ({routeAssignTargetTeam.teamId})</div>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  Current Route: <span className="text-cyan-400">{routeAssignTargetTeam.routeName}</span>
                </div>
              </div>

              {/* Mission-Started Guard Warning */}
              {(routeAssignTargetTeam.status === "IN_PROGRESS" || routeAssignTargetTeam.completedCount > 0) && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-4 h-4" /> MISSION IN PROGRESS
                  </div>
                  <div>
                    This team has already started or completed checkpoints ({routeAssignTargetTeam.completedCount} solved).
                    Reassigning routes will alter their sequence. You MUST supply an authorized emergency recovery reason.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Route *</label>
                <select
                  value={selectedTargetRouteId}
                  onChange={(e) => setSelectedTargetRouteId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs font-mono"
                >
                  <option value="">-- Select Valid Campus Route --</option>
                  {routes.filter((r) => r.isValid).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.teamCount} teams assigned)
                    </option>
                  ))}
                </select>
              </div>

              {(routeAssignTargetTeam.status === "IN_PROGRESS" || routeAssignTargetTeam.completedCount > 0) && (
                <div>
                  <label className="block text-xs font-medium text-amber-300 mb-1">
                    Emergency Recovery Reason (Required) *
                  </label>
                  <textarea
                    required
                    minLength={5}
                    rows={2}
                    placeholder="e.g. Checkpoint #3 physical beacon damaged, re-routing team to alternate path."
                    value={routeOverrideReason}
                    onChange={(e) => setRouteOverrideReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-amber-500/40 text-white text-xs font-mono"
                  />
                </div>
              )}

              {routeAssignError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
                  {routeAssignError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRouteAssignTargetTeam(null)}
                  className="px-4 py-2 rounded-xl bg-surface-100 text-slate-300 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={routeAssignSubmitting || !selectedTargetRouteId}
                  className="px-5 py-2 rounded-xl bg-purple-500 text-white font-bold text-xs font-mono hover:bg-purple-600 disabled:opacity-50"
                >
                  {routeAssignSubmitting ? "Updating..." : "Save Route Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    



      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: RESTART / RESET GAME MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-6 border-rose-500/40 shadow-glow-rose space-y-4">
            <div className="flex items-center gap-3 text-rose-400 border-b border-surface-border pb-3">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-mono font-bold text-base text-white">RESTART MYSTERY HUNT</h3>
                <p className="text-xs text-rose-300/80">Reset game to play from the beginning</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Choose how you want to restart the hunt. Checkpoints, clues, riddles, routes, and admin/volunteer accounts will be preserved safely.
            </p>

            <div className="space-y-2.5">
              <label className={`block p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                resetMode === "FRESH"
                  ? "bg-rose-500/10 border-rose-500/50 text-white"
                  : "bg-surface-50 border-surface-border text-slate-400 hover:text-white"
              }`}>
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="resetMode"
                    checked={resetMode === "FRESH"}
                    onChange={() => setResetMode("FRESH")}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold font-mono text-rose-300">Option 1: Complete Fresh Start (Recommended)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Clears current test teams, resets Team ID pool (TEAM001-TEAM050) to available, and sets Game Status to WAITING.
                    </div>
                  </div>
                </div>
              </label>

              <label className={`block p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                resetMode === "REPLAY"
                  ? "bg-cyan-500/10 border-cyan-500/50 text-white"
                  : "bg-surface-50 border-surface-border text-slate-400 hover:text-white"
              }`}>
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="resetMode"
                    checked={resetMode === "REPLAY"}
                    onChange={() => setResetMode("REPLAY")}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold font-mono text-cyan-300">Option 2: Replay Existing Teams</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Preserves registered teams and their assigned routes, but resets their progress back to Checkpoint #1 and sets Game Status to WAITING.
                    </div>
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resettingGame}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-400 hover:text-white hover:bg-surface-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetGame}
                disabled={resettingGame}
                className="px-5 py-2 rounded-xl text-xs font-mono font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all flex items-center gap-1.5 shadow-lg shadow-rose-500/20"
              >
                {resettingGame ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Confirm Restart
                  </>
                )}
              </button>
            </div>
          </div>

          
        </div>
      )}
    </div>
  );
}
