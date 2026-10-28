"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  KeyRound, 
  LogIn, 
  AlertCircle, 
  Terminal, 
  Users, 
  ArrowRight,
  UserCheck,
  Eye,
  EyeOff,
  ShieldCheck
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);

  // Auto-detect existing logged-in session on page load or back navigation
  useEffect(() => {
    let mounted = true;
    const checkActiveSession = async () => {
      try {
        const storedToken = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
        const headers: Record<string, string> = {};
        if (storedToken) {
          headers["Authorization"] = `Bearer ${storedToken}`;
        }
        const res = await fetch("/api/auth/me", {
          headers,
          credentials: "include",
        });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.role) {
            if (data.role === "ADMIN") {
              router.replace("/admin");
              return;
            }
            if (data.role === "VOLUNTEER") {
              router.replace("/volunteer");
              return;
            }
            if (data.role === "TEAM") {
              const dest =
                data.user?.currentStage === "HUNTING" || data.user?.currentStage === "TREASURE_SEARCH"
                  ? "/hunt"
                  : "/waiting-room";
              router.replace(dest);
              return;
            }
          }
        }
        if (typeof window !== "undefined") {
          localStorage.removeItem("techhunt_token");
          localStorage.removeItem("techhunt_role");
        }
      } catch {
        // Not signed in; display login console
      } finally {
        if (mounted) {
          setCheckingAuth(false);
        }
      }
    };

    checkActiveSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  // Team Form Fields
  const [teamId, setTeamId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [showTeamPassword, setShowTeamPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: teamId.trim(),
          password: teamPassword,
          teamName: teamName.trim() || undefined,
          leaderName: leaderName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed. Please check your Team ID and password.");
      }

      // Successful login - persist token in local storage & cookie
      if (data.token && typeof window !== "undefined") {
        localStorage.setItem("techhunt_token", data.token);
        localStorage.setItem("techhunt_role", data.role);
        if (data.team) {
          localStorage.setItem("techhunt_team", JSON.stringify(data.team));
        }
        if (data.user) {
          localStorage.setItem("techhunt_user", JSON.stringify(data.user));
        }
      }

      // If a staff member logs in here, redirect to their panel; otherwise go to hunt/waiting-room
      const target = data.redirectUrl || (data.role === "ADMIN" ? "/admin" : data.role === "VOLUNTEER" ? "/volunteer" : "/waiting-room");
      router.replace(target);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign-in error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest animate-pulse flex items-center gap-2">
          <Terminal className="w-4 h-4" /> Verifying Active Session...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 border border-cyan-500/30 text-xs font-mono text-cyan-400 mb-3 shadow-glow-cyan">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            TECH MYSTERY HUNT • THE MISSING CODE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
            PARTICIPANT ACCESS PORTAL
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enter your official Team ID and passcode to access your mystery hunt coordinates.
          </p>
        </div>

        {/* Card */}
        <div className="glow-card rounded-2xl p-6 sm:p-8 border-surface-border">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Participant Team Form */}
          <form onSubmit={handleTeamSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                Assigned Team ID *
              </label>
              <input
                type="text"
                required
                value={teamId}
                onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono tracking-wider font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                Team Leader Name
              </label>
              <input
                type="text"
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Passcode *
              </label>
              <div className="relative">
                <input
                  type={showTeamPassword ? "text" : "password"}
                  required
                  value={teamPassword}
                  onChange={(e) => setTeamPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowTeamPassword(!showTeamPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  {showTeamPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-cipher-cyan text-black font-extrabold text-sm hover:bg-cyan-300 transition-all shadow-glow-cyan disabled:opacity-50 flex items-center justify-center gap-2 mt-4 font-mono"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Connecting to Grid...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Enter Mission Console
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Discreet Staff Portal Link */}
          <div className="mt-6 pt-4 border-t border-surface-border text-center">
            <Link
              href="/staff-login"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              Event Staff / Marshall Portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
