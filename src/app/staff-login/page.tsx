"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, 
  KeyRound, 
  LogIn, 
  AlertCircle, 
  Terminal, 
  ArrowRight,
  Eye,
  EyeOff,
  Compass
} from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(false);
  const [staffIdentifier, setStaffIdentifier] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const storedToken = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
    if (!storedToken) {
      setCheckingAuth(false);
      return;
    }

    setCheckingAuth(true);

    const checkActiveSession = async () => {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${storedToken}`,
        };
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
              router.replace("/hunt");
              return;
            }
          }
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

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: staffIdentifier.trim(),
          password: staffPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid staff credentials.");
      }

      if (data.role !== "ADMIN" && data.role !== "VOLUNTEER") {
        throw new Error("This portal is restricted to Event Staff & Marshalls only. Teams please use the Participant Login.");
      }

      if (data.token && typeof window !== "undefined") {
        localStorage.setItem("techhunt_token", data.token);
        localStorage.setItem("techhunt_role", data.role);
        if (data.user) {
          localStorage.setItem("techhunt_user", JSON.stringify(data.user));
        }
      }

      const target = data.role === "ADMIN" ? "/admin" : "/volunteer";
      router.replace(target);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Staff sign-in error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-amber-400 uppercase tracking-widest animate-pulse flex items-center gap-2">
          <Terminal className="w-4 h-4" /> Verifying Staff Credentials...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 border border-amber-500/30 text-xs font-mono text-amber-400 mb-3 shadow-glow-amber">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            STAFF &amp; MARSHALL SECURE ACCESS
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
            COMMAND CENTER
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Restricted access for Event Administrators, Marshalls, and Vault Volunteers.
          </p>
        </div>

        {/* Card */}
        <div className="glow-card rounded-2xl p-6 sm:p-8 border-amber-500/30 bg-surface-100/90 shadow-glow-amber/20">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Staff Username / ID *
              </label>
              <input
                type="text"
                required
                placeholder="Enter admin or volunteer username"
                value={staffIdentifier}
                onChange={(e) => setStaffIdentifier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Staff Password *
              </label>
              <div className="relative">
                <input
                  type={showStaffPassword ? "text" : "password"}
                  required
                  placeholder="Enter staff security password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowStaffPassword(!showStaffPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-extrabold text-sm transition-all shadow-glow-amber disabled:opacity-50 flex items-center justify-center gap-2 mt-2 font-mono"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Authenticating Staff...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In to Staff Console
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-surface-border text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 font-mono transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              ← Participant Team? Go to Participant Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
