"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Award, 
  Package, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Phone, 
  Users, 
  Search,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Video,
  ExternalLink,
  Check,
  MessageSquare
} from "lucide-react";

interface ClaimRecord {
  id: string;
  boxNumber: number;
  claimCode: string;
  status: string;
  claimedAt: string;
  volunteerNotes: string | null;
  releaseReason: string | null;
  team: {
    id: string;
    teamId: string;
    name: string;
    leaderName: string;
    leaderPhone: string;
  };
  volunteer: {
    username: string;
    name: string;
    role?: string;
  } | null;
}

interface BoxStatus {
  boxNumber: number;
  isAvailable: boolean;
  status: "AVAILABLE" | "PENDING_VERIFICATION" | "CONFIRMED";
  winningTeam: { teamId: string; name: string } | null;
  pendingTeam: { teamId: string; name: string } | null;
}

interface EligibleTeam {
  id: string;
  teamId: string;
  name: string;
  leaderName: string;
  leaderPhone: string;
}

interface PendingPenaltyTask {
  progressId?: string;
  teamObjectId: string;
  teamId: string;
  teamName?: string;
  name?: string;
  leaderName: string;
  leaderPhone: string;
  checkpointId: string;
  checkpointSequence: number;
  checkpointName: string;
  campusArea?: string;
  taskText?: string;
  attemptsCount?: number;
  assignedAt?: string;
  penaltyTask?: {
    taskText: string;
    whatsappNumber: string;
    status: string;
  };
}

export default function VolunteerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [boxesStatus, setBoxesStatus] = useState<BoxStatus[]>([]);
  const [eligibleTeams, setEligibleTeams] = useState<EligibleTeam[]>([]);
  const [allBoxesClaimed, setAllBoxesClaimed] = useState(false);
  const [activeBoxNumber, setActiveBoxNumber] = useState<number | null>(1);
  const [pendingPenaltyTasks, setPendingPenaltyTasks] = useState<PendingPenaltyTask[]>([]);
  const [approvingPenaltyId, setApprovingPenaltyId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Direct verification form state
  const [directTeamId, setDirectTeamId] = useState("");
  const [directBoxNumber, setDirectBoxNumber] = useState<number>(1);
  const [directNotes, setDirectNotes] = useState("");
  const [submittingDirect, setSubmittingDirect] = useState(false);

  // Release claim prompt state
  const [releaseModalClaim, setReleaseModalClaim] = useState<ClaimRecord | null>(null);
  const [releaseReasonInput, setReleaseReasonInput] = useState("");
  const [submittingRelease, setSubmittingRelease] = useState(false);

  const fetchClaims = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const authRes = await fetch("/api/auth/me", { headers, credentials: "include" });
      const authData = await authRes.json();

      if (!authData.authenticated || (authData.role !== "VOLUNTEER" && authData.role !== "ADMIN")) {
        if (!token) {
          router.replace("/staff-login");
          return;
        }
        if (typeof window !== "undefined") localStorage.removeItem("techhunt_token");
        router.replace("/staff-login");
        return;
      }

      const [res, taskRes] = await Promise.all([
        fetch("/api/volunteer/claims", { headers, credentials: "include" }),
        fetch("/api/volunteer/verify-task", { headers, credentials: "include" }),
      ]);
      const data = await res.json();
      if (data.claims) {
        setClaims(data.claims);
      }
      if (data.boxesStatus) {
        setBoxesStatus(data.boxesStatus);
      }
      if (data.eligibleTeams) {
        setEligibleTeams(data.eligibleTeams);
      }
      if (data.allBoxesClaimed !== undefined) {
        setAllBoxesClaimed(data.allBoxesClaimed);
      }
      if (data.activeBoxNumber !== undefined) {
        setActiveBoxNumber(data.activeBoxNumber);
        if (data.activeBoxNumber) {
          setDirectBoxNumber(data.activeBoxNumber);
        }
      }

      if (taskRes.ok) {
        const taskData = await taskRes.json();
        if (Array.isArray(taskData.pendingPenaltyTasks)) {
          setPendingPenaltyTasks(taskData.pendingPenaltyTasks);
        } else {
          setPendingPenaltyTasks([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePenalty = async (teamObjectId: string, checkpointId?: string) => {
    setApprovingPenaltyId(teamObjectId);
    setMessage(null);
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
          notes: "WhatsApp video verified by Marshall",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      setMessage({ type: "success", text: data.message || "✓ WhatsApp video task approved! Team advanced to next checkpoint." });
      await fetchClaims();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setApprovingPenaltyId(null);
    }
  };

  useEffect(() => {
    fetchClaims();
    const interval = setInterval(fetchClaims, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = async (claimId: string, status: "CONFIRMED" | "REJECTED") => {
    setVerifyingId(claimId);
    setMessage(null);

    try {
      const res = await fetch("/api/volunteer/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          status,
          volunteerNotes: notes[claimId] || "",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: "success", text: data.message });
      await fetchClaims();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification error";
      setMessage({ type: "error", text: msg });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDirectVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTeamId) {
      setMessage({ type: "error", text: "Please select an eligible team from the list." });
      return;
    }

    setSubmittingDirect(true);
    setMessage(null);

    try {
      const res = await fetch("/api/volunteer/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directVerify: true,
          teamObjectId: directTeamId,
          boxNumber: directBoxNumber,
          volunteerNotes: directNotes || "Direct Marshall physical verification",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: "success", text: data.message || `Box #${directBoxNumber} successfully confirmed & awarded!` });
      setDirectTeamId("");
      setDirectNotes("");
      await fetchClaims();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Direct verification error";
      setMessage({ type: "error", text: msg });
    } finally {
      setSubmittingDirect(false);
    }
  };

  const handleOpenReleaseModal = (claim: ClaimRecord) => {
    setReleaseModalClaim(claim);
    setReleaseReasonInput("Team requested box re-selection due to physical box mix-up");
  };

  const handleExecuteRelease = async () => {
    if (!releaseModalClaim || !releaseReasonInput.trim()) return;

    setSubmittingRelease(true);
    setMessage(null);

    try {
      const res = await fetch("/api/volunteer/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          release: true,
          claimId: releaseModalClaim.id,
          reason: releaseReasonInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: "success", text: data.message });
      setReleaseModalClaim(null);
      setReleaseReasonInput("");
      await fetchClaims();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Release error";
      setMessage({ type: "error", text: msg });
    } finally {
      setSubmittingRelease(false);
    }
  };

  const filteredClaims = claims.filter(
    (c) =>
      c.team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.team.teamId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.claimCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 font-mono text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-400 mr-2" />
        Connecting to Box Marshall Console...
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-xs font-mono text-purple-400 mb-2">
            <Award className="w-3.5 h-3.5" /> PHYSICAL TREASURE VAULT MARSHALL CONSOLE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            BOX MARSHALL PORTAL
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Validate physical claim tokens presented by teams at the dais and confirm physical box handovers.
          </p>
        </div>

        <button
          onClick={fetchClaims}
          className="px-4 py-2 rounded-xl bg-surface-50 border border-surface-border text-slate-300 hover:text-white text-xs font-mono flex items-center gap-2 transition-colors self-start"
        >
          <RefreshCw className="w-4 h-4" /> Live Refresh
        </button>
      </div>

      {/* Active Objective Banner */}
      <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 ${
        allBoxesClaimed
          ? "bg-purple-500/20 border-purple-500/40 text-purple-200"
          : "bg-amber-500/20 border-amber-500/40 text-amber-200"
      }`}>
        <div className="flex items-center gap-3">
          <Award className="w-6 h-6 text-amber-400 shrink-0 animate-bounce" />
          <div>
            <div className="font-bold text-sm font-mono">
              {allBoxesClaimed
                ? "🏆 ALL THREE PHYSICAL PRIZE BOXES CLAIMED & VERIFIED!"
                : `🎯 CURRENT ACTIVE TARGET: BOX #${activeBoxNumber || 1} (${activeBoxNumber === 1 ? "1ST PLACE" : activeBoxNumber === 2 ? "2ND PLACE" : "3RD PLACE"})`}
            </div>
            <div className="text-xs text-slate-300">
              {allBoxesClaimed
                ? "All podium positions have been officially finalized. The hunt is concluded and global broadcast was delivered."
                : `All teams reaching Checkpoint 10 are currently seeing the clue for Box #${activeBoxNumber || 1}. Once you confirm this handover, the clues automatically update to the next box!`}
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-3.5 rounded-xl text-xs border flex items-center gap-2 ${
          message.type === "success"
            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            : "bg-rose-500/10 text-rose-300 border-rose-500/30"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* WhatsApp Video Task Verifications (Penalty Tasks) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-mono text-white font-bold uppercase tracking-wider flex items-center gap-2">
            <Video className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp Video Task Verifications (പെനാൽറ്റി ടാസ്ക് വെരിഫിക്കേഷൻ)</span>
            {pendingPenaltyTasks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 animate-pulse">
                {pendingPenaltyTasks.length} PENDING REVIEW
              </span>
            )}
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Official WhatsApp: <span className="text-emerald-400 font-bold">+91 98765 43210</span>
          </span>
        </div>

        {pendingPenaltyTasks.length === 0 ? (
          <div className="glow-card rounded-2xl p-4 border-surface-border bg-surface-100/40 text-center">
            <p className="text-xs text-slate-400 font-mono">
              ✓ No pending video penalty tasks. Teams with wrong answers submitting video proof will appear here instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingPenaltyTasks.map((task) => (
              <div
                key={task.teamObjectId}
                className="glow-card rounded-2xl p-5 border-amber-500/50 bg-amber-950/10 shadow-glow-amber border transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30">
                        CHECKPOINT #{task.checkpointSequence}
                      </span>
                      <span className="text-sm font-mono font-bold text-cyan-400">
                        {task.teamId}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-sm font-bold text-white">
                        {task.teamName || task.name}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 font-mono">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> Leader: {task.leaderName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {task.leaderPhone}
                      </span>
                      {task.leaderPhone && (
                        <a
                          href={`https://wa.me/${task.leaderPhone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Leader <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-50 border border-surface-border text-xs">
                      <div className="font-bold text-amber-300 font-mono mb-1 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-amber-400" /> Assigned Task Challenge:
                      </div>
                      <div className="text-white font-mono leading-relaxed">
                        {task.taskText || task.penaltyTask?.taskText || "Video Penalty Task Assigned"}
                      </div>
                    </div>
                  </div>

                  <div className="lg:w-72 shrink-0 flex flex-col gap-2 justify-center">
                    <button
                      type="button"
                      disabled={approvingPenaltyId === task.teamObjectId}
                      onClick={() => handleApprovePenalty(task.teamObjectId, task.checkpointId)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black font-extrabold text-xs font-mono flex items-center justify-center gap-2 transition-all shadow-glow-emerald disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      {approvingPenaltyId === task.teamObjectId ? "Unlocking Next Stage..." : "✓ Approve Video & Unlock Clue"}
                    </button>
                    <div className="text-[10px] text-slate-400 font-mono text-center">
                      Auto-unlocks next clue on team phone within 3s!
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3 Physical Treasure Boxes Live Status Cards */}
      <div className="mb-8">
        <h2 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-purple-400" /> Physical Treasure Boxes Status (Podium 1, 2, 3)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((boxNum) => {
            const boxInfo = boxesStatus.find((b) => b.boxNumber === boxNum);
            const status = boxInfo?.status || "AVAILABLE";
            const winningTeam = boxInfo?.winningTeam;
            const pendingTeam = boxInfo?.pendingTeam;

            return (
              <div
                key={boxNum}
                className={`p-4 rounded-2xl border transition-all ${
                  status === "CONFIRMED"
                    ? "bg-emerald-500/10 border-emerald-500/30 shadow-glow-emerald"
                    : status === "PENDING_VERIFICATION"
                    ? "bg-amber-500/10 border-amber-500/30 shadow-glow-amber animate-pulse"
                    : "bg-surface-100 border-surface-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-white">
                      Box #{boxNum}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {boxNum === 1 ? "(1st Prize)" : boxNum === 2 ? "(2nd Prize)" : "(3rd Prize)"}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      status === "CONFIRMED"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : status === "PENDING_VERIFICATION"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                {status === "CONFIRMED" && winningTeam ? (
                  <div className="text-xs font-mono space-y-1 text-slate-300">
                    <div className="text-emerald-400 font-bold">🏆 Awarded Winner:</div>
                    <div>{winningTeam.name} ({winningTeam.teamId})</div>
                  </div>
                ) : status === "PENDING_VERIFICATION" && pendingTeam ? (
                  <div className="text-xs font-mono space-y-1 text-slate-300">
                    <div className="text-amber-400 font-bold">⏳ Verification in Progress:</div>
                    <div>{pendingTeam.name} ({pendingTeam.teamId})</div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic font-mono">
                    Available in physical vault for claim.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Direct Physical Verification Panel */}
      <div className="glow-card rounded-2xl p-6 border-surface-border mb-8">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white font-mono">
            Direct Physical Box Handover (Desk Verification)
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          When a team physically reaches the dais after deciphering the final clue, select the team and award the physical box directly.
        </p>

        <form onSubmit={handleDirectVerify} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Select Qualifying Team (In Final Stage):
              </label>
              <select
                value={directTeamId}
                onChange={(e) => setDirectTeamId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value="">-- Choose Qualifying Team ({eligibleTeams.length} Ready) --</option>
                {eligibleTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.teamId} — {t.name} (Leader: {t.leaderName})
                  </option>
                ))}
              </select>
              {eligibleTeams.length === 0 && (
                <p className="text-[11px] text-slate-500 italic mt-1 font-mono">
                  No teams currently in final treasure search. Teams will appear here as they solve all checkpoints.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Target Physical Box Number:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((num) => {
                  const isWon = boxesStatus.some((b) => b.boxNumber === num && b.status === "CONFIRMED");
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={isWon}
                      onClick={() => setDirectBoxNumber(num)}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                        directBoxNumber === num
                          ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-glow-cyan"
                          : isWon
                          ? "bg-surface-50/50 border-surface-border text-slate-600 line-through cursor-not-allowed"
                          : "bg-surface-50 border-surface-border text-slate-300 hover:text-white"
                      }`}
                    >
                      Box #{num} {isWon ? "(Won)" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Marshall Verification Notes:
            </label>
            <input
              type="text"
              placeholder="e.g. Identity ID cards verified, Box #1 physical seal handed over intact"
              value={directNotes}
              onChange={(e) => setDirectNotes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          <button
            type="submit"
            disabled={submittingDirect || !directTeamId || allBoxesClaimed}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs font-mono flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {submittingDirect ? "Verifying & Awarding..." : `Confirm Handover of Box #${directBoxNumber}`}
          </button>
        </form>
      </div>

      {/* Filter / Search input */}
      <div className="glow-card rounded-2xl p-4 sm:p-5 mb-6 border-surface-border">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Team ID (e.g. MH-2026-001), team name, or verification code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-purple-400"
          />
        </div>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {filteredClaims.length === 0 ? (
          <div className="glow-card rounded-2xl p-12 text-center border-surface-border">
            <Package className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white font-mono mb-1">
              No Prize Claims Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-mono">
              As soon as a team decrypts all campus checkpoints and initiates their box selection,
              their verification ticket will appear here in real time.
            </p>
          </div>
        ) : (
          filteredClaims.map((claim) => (
            <div
              key={claim.id}
              className={`glow-card rounded-2xl p-6 border transition-all ${
                claim.status === "CONFIRMED"
                  ? "border-emerald-500/30 bg-surface-100/60"
                  : claim.status === "REJECTED"
                  ? "border-rose-500/30 bg-surface-100/60"
                  : claim.status === "RELEASED"
                  ? "border-slate-500/30 bg-surface-100/60"
                  : "border-amber-500/40 bg-surface-100 shadow-glow-amber"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Team & Claim Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-cyan-400">
                      {claim.team.teamId}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-base font-bold text-white">
                      {claim.team.name}
                    </span>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                      claim.status === "CONFIRMED"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : claim.status === "REJECTED"
                        ? "bg-rose-500/20 text-rose-300"
                        : claim.status === "RELEASED"
                        ? "bg-slate-500/20 text-slate-300"
                        : "bg-amber-500/20 text-amber-300 animate-pulse"
                    }`}>
                      {claim.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Users className="w-3.5 h-3.5 text-slate-400" /> Leader: {claim.team.leaderName}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {claim.team.leaderPhone}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" /> Claimed: {new Date(claim.claimedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-50 border border-surface-border inline-block">
                    <div className="text-[11px] text-slate-400 font-mono">CLAIMING PHYSICAL ITEM:</div>
                    <div className="text-sm font-bold text-amber-400 font-mono flex items-center gap-1.5 mt-0.5">
                      <Package className="w-4 h-4" /> BOX #{claim.boxNumber} (Code: <span className="text-cyan-400 underline font-mono">{claim.claimCode}</span>)
                    </div>
                  </div>

                  {claim.releaseReason && (
                    <div className="text-xs text-slate-400 font-mono bg-slate-800/40 p-2 rounded-lg border border-slate-700/50">
                      Release Note: <span className="text-slate-300">{claim.releaseReason}</span>
                    </div>
                  )}
                </div>

                {/* Marshall Handover Actions */}
                <div className="lg:w-88 shrink-0 space-y-3">
                  {claim.status === "PENDING_VERIFICATION" ? (
                    <>
                      <div>
                        <input
                          type="text"
                          placeholder="Marshal notes (e.g. Identity verified)..."
                          value={notes[claim.id] || ""}
                          onChange={(e) =>
                            setNotes({ ...notes, [claim.id]: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-purple-400 mb-2"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={verifyingId === claim.id}
                          onClick={() => handleVerify(claim.id, "CONFIRMED")}
                          className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-glow-emerald disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm Box Handover
                        </button>

                        <button
                          type="button"
                          disabled={verifyingId === claim.id}
                          onClick={() => handleVerify(claim.id, "REJECTED")}
                          className="py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={verifyingId === claim.id}
                        onClick={() => handleOpenReleaseModal(claim)}
                        className="w-full py-2 px-3 rounded-xl bg-surface-50 hover:bg-surface-border text-slate-400 hover:text-white border border-surface-border text-[11px] font-mono flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        Release Claim (Allow Team Re-selection)
                      </button>
                    </>
                  ) : (
                    <div className="p-3 rounded-xl bg-surface-50 border border-surface-border text-xs font-mono text-slate-400">
                      <div>Handled by: <span className="text-slate-200">{claim.volunteer?.name || "Staff Marshall"}</span></div>
                      {claim.volunteerNotes && <div className="italic mt-1 text-slate-300">&ldquo;{claim.volunteerNotes}&rdquo;</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Release Claim Modal */}
      {releaseModalClaim && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glow-card rounded-2xl p-6 border-surface-border max-w-md w-full space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-mono font-bold text-base text-white">Release Pending Claim</h3>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Releasing this claim cancels the pending hold on Box #{releaseModalClaim.boxNumber} for Team {releaseModalClaim.team.name} ({releaseModalClaim.team.teamId}). The team can re-submit a claim for another available box.
            </p>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Reason for Release (Logged to Audit Trail):
              </label>
              <textarea
                value={releaseReasonInput}
                onChange={(e) => setReleaseReasonInput(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submittingRelease}
                onClick={() => setReleaseModalClaim(null)}
                className="px-4 py-2 rounded-xl bg-surface-50 border border-surface-border text-slate-300 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRelease || !releaseReasonInput.trim()}
                onClick={handleExecuteRelease}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {submittingRelease ? "Releasing..." : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
