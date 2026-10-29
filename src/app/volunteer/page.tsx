"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Phone, 
  Users, 
  Search,
  Video,
  ExternalLink,
  Check,
  MessageSquare,
  Clock,
  ShieldCheck
} from "lucide-react";

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

interface VerificationHistoryItem {
  id: string;
  checkpoint: string;
  area: string;
  volunteer: string;
  teamId: string;
  action: string;
  notes: string | null;
  verifiedAt: string;
}

export default function VolunteerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pendingPenaltyTasks, setPendingPenaltyTasks] = useState<PendingPenaltyTask[]>([]);
  const [verifications, setVerifications] = useState<VerificationHistoryItem[]>([]);
  const [approvingPenaltyId, setApprovingPenaltyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchTasks = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const authRes = await fetch("/api/auth/me", { headers, credentials: "include" });
      if (!authRes.ok && authRes.status !== 401) {
        console.error("Volunteer auth returned non-401:", authRes.status);
      } else {
        const authData = await authRes.json();
        if (!authData.authenticated || (authData.role !== "VOLUNTEER" && authData.role !== "ADMIN")) {
          if (typeof window !== "undefined") localStorage.removeItem("techhunt_token");
          router.replace("/staff-login");
          return;
        }
      }

      const res = await fetch("/api/volunteer/verify-task", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.pendingPenaltyTasks)) {
          setPendingPenaltyTasks(data.pendingPenaltyTasks);
        } else {
          setPendingPenaltyTasks([]);
        }
        if (Array.isArray(data.verifications)) {
          setVerifications(data.verifications);
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
          notes: "WhatsApp video verified by Volunteer",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      setMessage({ type: "success", text: data.message || "✓ WhatsApp video task approved! Team advanced to next checkpoint." });
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setApprovingPenaltyId(null);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredTasks = pendingPenaltyTasks.filter((task) => {
    const q = searchTerm.toLowerCase();
    const name = (task.teamName || task.name || "").toLowerCase();
    const teamId = (task.teamId || "").toLowerCase();
    const leader = (task.leaderName || "").toLowerCase();
    const phone = (task.leaderPhone || "").toLowerCase();
    const cpName = (task.checkpointName || "").toLowerCase();
    return name.includes(q) || teamId.includes(q) || leader.includes(q) || phone.includes(q) || cpName.includes(q);
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 font-mono text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mr-2" />
        Connecting to Task Verification Console...
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> VOLUNTEER TASK MARSHALL CONSOLE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            TASK APPROVAL PORTAL
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            പെനാൽറ്റി ടാസ്ക് വീഡിയോ വെരിഫിക്കേഷൻ: വാട്സാപ്പിൽ ലഭിച്ച വീഡിയോ പരിശോധിച്ച് അപ്രൂവ് ചെയ്യുക.
          </p>
        </div>

        <button
          onClick={fetchTasks}
          className="px-4 py-2 rounded-xl bg-surface-50 border border-surface-border text-slate-300 hover:text-white text-xs font-mono flex items-center gap-2 transition-colors self-start"
        >
          <RefreshCw className="w-4 h-4" /> Live Refresh
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-3.5 rounded-xl text-xs border flex items-center gap-2 ${
          message.type === "success"
            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            : "bg-rose-500/10 text-rose-300 border-rose-500/30"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Search / Filter input */}
      <div className="glow-card rounded-2xl p-4 sm:p-5 mb-6 border-surface-border">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pending tasks by Team ID, team name, leader phone, or checkpoint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      {/* WhatsApp Video Task Verifications */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono text-white font-bold uppercase tracking-wider flex items-center gap-2">
            <Video className="w-4 h-4 text-emerald-400" />
            <span>Pending Video Task Approvals</span>
            {pendingPenaltyTasks.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 animate-pulse">
                {pendingPenaltyTasks.length} PENDING
              </span>
            )}
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Official Helpline WhatsApp: <span className="text-emerald-400 font-bold">+91 98765 43210</span>
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="glow-card rounded-2xl p-8 border-surface-border bg-surface-100/40 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm text-white font-mono font-bold mb-1">
              All Caught Up!
            </p>
            <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
              നിലവിൽ റിവ്യൂ ചെയ്യാനുള്ള പെനാൽറ്റി ടാസ്കുകൾ ഒന്നുമില്ല. തെറ്റായ ഉത്തരം സബ്മിറ്റ് ചെയ്യുന്ന ടീമുകൾ വീഡിയോ അയക്കുമ്പോൾ ഇവിടെ ഉടൻ പ്രത്യക്ഷപ്പെടും.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task.teamObjectId}
                className="glow-card rounded-2xl p-5 border-amber-500/50 bg-amber-950/10 shadow-glow-amber border transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30">
                        CHECKPOINT #{task.checkpointSequence}: {task.checkpointName}
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
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black font-extrabold text-xs font-mono flex items-center justify-center gap-2 transition-all shadow-glow-emerald disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      {approvingPenaltyId === task.teamObjectId ? "Unlocking Next Stage..." : "✓ Approve Video & Unlock Clue"}
                    </button>
                    <div className="text-[10px] text-slate-400 font-mono text-center">
                      Auto-unlocks next clue on team phone instantly!
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Approvals Log */}
      {verifications.length > 0 && (
        <div className="glow-card rounded-2xl p-5 border-surface-border">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Recent Verifications Log ({verifications.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {verifications.map((v) => (
              <div key={v.id} className="p-2.5 rounded-lg bg-surface-50 border border-surface-border flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓ {v.teamId}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-300">{v.checkpoint}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {v.verifiedAt ? new Date(v.verifiedAt).toLocaleTimeString() : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
