"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Radio, 
  Terminal, 
  Compass, 
  Users, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  PauseCircle,
  Flag,
  UserCheck
} from "lucide-react";

interface TeamMember {
  name: string;
  collegeId: string;
  phone?: string;
}

interface TeamData {
  id: string;
  teamId: string;
  name: string;
  leaderName: string;
  leaderEmail?: string;
  routeName: string;
  routeId?: string | null;
  status: string;
  currentStage: string;
  members?: TeamMember[];
  totalConfiguredCheckpoints: number;
}

export default function WaitingRoomPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [gameStatus, setGameStatus] = useState<string>("WAITING");
  const [loading, setLoading] = useState(true);
  const [startingMission, setStartingMission] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [authRes, configRes] = await Promise.all([
        fetch("/api/auth/me", { headers, credentials: "include" }),
        fetch("/api/config"),
      ]);

      const authData = await authRes.json();
      const configData = await configRes.json();

      if (!authData.authenticated || authData.role !== "TEAM") {
        if (!token) {
          router.replace("/login");
          return;
        }
        if (typeof window !== "undefined") localStorage.removeItem("techhunt_token");
        router.replace("/login");
        return;
      }

      setTeam(authData.user);
      if (configData.gameStatus) {
        setGameStatus(configData.gameStatus);
      }

      // If team is already on mission, auto-forward to hunt console
      if (authData.user?.currentStage === "HUNTING" || authData.user?.currentStage === "TREASURE_SEARCH") {
        router.replace("/hunt");
        return;
      }
    } catch (err) {
      console.error("Polling error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleStartMission = async () => {
    setStartingMission(true);
    setStartError(null);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/hunt/start", {
        method: "POST",
        headers,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start mission.");
      }

      // Idempotently navigated to hunt console
      router.replace("/hunt");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error starting mission.";
      setStartError(msg);
      setStartingMission(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center font-mono">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-slate-400">Connecting to Mission Control...</div>
        </div>
      </div>
    );
  }

  const isHuntActive = gameStatus === "ACTIVE";
  const isHuntWaiting = gameStatus === "WAITING";
  const isHuntPaused = gameStatus === "PAUSED";
  const isHuntConcluded = gameStatus === "CONCLUDED";
  const hasRoute = team?.routeName && team.routeName !== "Unassigned" && team.routeName !== "None";

  return (
    <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      {/* Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 border border-surface-border text-xs font-mono text-cyan-400 mb-3">
          <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" /> MISSION TRANSMISSION CHANNEL
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono">
          TEAM WAITING ROOM
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-xl mx-auto">
          Stand by with your squad. When Mission Control signals launch, enter the hunt to receive your opening coordinates.
        </p>
      </div>

      {/* Hunt Status Action Box */}
      <div className={`p-6 sm:p-8 rounded-2xl mb-8 border transition-all ${
        isHuntActive 
          ? "bg-cipher-emerald/10 border-cipher-emerald/40 shadow-glow-emerald" 
          : isHuntPaused
          ? "bg-amber-500/10 border-amber-500/40"
          : isHuntConcluded
          ? "bg-purple-500/10 border-purple-500/40"
          : "bg-surface-100/70 border-surface-border"
      }`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">
              CURRENT EVENT STATUS: <span className="font-bold text-white">[{gameStatus}]</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono flex items-center justify-center sm:justify-start gap-3">
              <span className={`w-3.5 h-3.5 rounded-full ${
                isHuntActive ? "bg-cipher-emerald animate-ping" : 
                isHuntPaused ? "bg-amber-400 animate-pulse" : 
                isHuntConcluded ? "bg-purple-400" : "bg-cyan-400"
              }`} />
              <span className={
                isHuntActive ? "text-cipher-emerald" : 
                isHuntPaused ? "text-amber-300" : 
                isHuntConcluded ? "text-purple-300" : "text-white"
              }>
                {isHuntActive && "THE HUNT IS OFFICIALLY LIVE!"}
                {isHuntWaiting && "WAITING FOR START SIGNAL"}
                {isHuntPaused && "HUNT TEMPORARILY PAUSED"}
                {isHuntConcluded && "HUNT HAS CONCLUDED"}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {isHuntActive && (hasRoute 
                ? "Your route is active. Click below to begin your mystery hunt mission!" 
                : "Game is active, but your squad route is still being assigned by Admin.")}
              {isHuntWaiting && "The Grand Master has not started the event yet. Please wait on this screen."}
              {isHuntPaused && "Event operations are currently paused by organizers. Submissions are temporarily held."}
              {isHuntConcluded && "Thank you for participating! Check with organizers for prize ceremonies."}
            </div>
          </div>

          <div>
            {isHuntActive && (
              <button
                onClick={handleStartMission}
                disabled={startingMission || !hasRoute}
                className={`px-8 py-4 rounded-xl font-extrabold text-base transition-all flex items-center gap-2 ${
                  hasRoute 
                    ? "bg-cipher-emerald text-black hover:bg-emerald-300 shadow-glow-emerald cursor-pointer" 
                    : "bg-surface-100 text-slate-500 cursor-not-allowed border border-surface-border"
                }`}
              >
                <Compass className="w-5 h-5" />
                {startingMission ? "INITIALIZING MISSION..." : "I'M ON MISSION"}
                <ArrowRight className="w-5 h-5" />
              </button>
            )}

            {isHuntWaiting && (
              <div className="px-5 py-3 rounded-xl bg-surface-50 border border-surface-border text-slate-400 text-xs font-mono flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Standby • Awaiting Start Signal
              </div>
            )}

            {isHuntPaused && (
              <div className="px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-amber-400" />
                Operations Paused
              </div>
            )}

            {isHuntConcluded && (
              <div className="px-5 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono flex items-center gap-2">
                <Flag className="w-4 h-4 text-purple-400" />
                Event Finished
              </div>
            )}
          </div>
        </div>

        {startError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{startError}</span>
          </div>
        )}

        {!hasRoute && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Your team has not been assigned a route yet. Please visit the registration helpdesk or wait for auto-assignment.</span>
          </div>
        )}
      </div>

      {/* Team Details & Route Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="glow-card rounded-2xl p-6 border-surface-border">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 font-mono">
            <Users className="w-4 h-4 text-cyan-400" /> Squad Credentials & Roster
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface-50">
              <span className="text-slate-400">TEAM ID:</span>
              <span className="text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40">
                {team?.teamId}
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface-50">
              <span className="text-slate-400">TEAM NAME:</span>
              <span className="text-white font-semibold">{team?.name}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface-50">
              <span className="text-slate-400">TEAM LEADER:</span>
              <span className="text-slate-200">{team?.leaderName}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface-50">
              <span className="text-slate-400">ASSIGNED ROUTE:</span>
              <span className={`font-bold px-2 py-0.5 rounded ${
                hasRoute 
                  ? "text-cipher-emerald bg-emerald-950/30 border border-emerald-800/30" 
                  : "text-amber-400 bg-amber-950/30 border border-amber-800/30"
              }`}>
                {team?.routeName || "Unassigned"}
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface-50">
              <span className="text-slate-400">MISSION STATUS:</span>
              <span className="text-slate-300 font-semibold">{team?.status}</span>
            </div>
          </div>

          {/* Members List */}
          {team?.members && team.members.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-border">
              <div className="text-xs font-mono text-slate-400 mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" /> Registered Teammates ({team.members.length}):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {team.members.map((m, idx) => (
                  <div key={idx} className="p-2 rounded bg-surface-50 text-[11px] font-mono text-slate-300">
                    <span className="font-semibold text-white">{m.name}</span>
                    <span className="text-slate-500 block text-[10px]">{m.collegeId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glow-card rounded-2xl p-6 border-surface-border">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Mission Briefing & Guidelines
          </h3>

          <ul className="space-y-3 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Clue Progression:</strong> Your team will receive one clue at a time. Decrypt it to locate the physical checkpoint on campus.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Anti-Cheat Security:</strong> QR codes must be scanned sequentially. Scanning other checkpoints or skipping stages will be rejected.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Riddle Validation:</strong> Solving the puzzle correctly unlocks your squad's next coordinates immediately.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Final Vault:</strong> All routes culminate at the final treasure vault where three physical mystery boxes await.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
