"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { 
  Terminal, 
  Compass, 
  ShieldCheck, 
  Award, 
  LogIn, 
  UserPlus, 
  LogOut, 
  Menu, 
  X, 
  Radio, 
  MapPin, 
  HelpCircle 
} from "lucide-react";

interface AuthUser {
  id: string;
  name: string;
  role: "ADMIN" | "VOLUNTEER" | "TEAM";
  teamId?: string;
  username?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [gameStatus, setGameStatus] = useState<string>("WAITING");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Check session only if a token is present
    if (token) {
      fetch("/api/auth/me", { headers, credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated) {
            setUser({ ...data.user, role: data.role });
          } else {
            setUser(null);
          }
        })
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    } else {
      setUser(null);
      setLoading(false);
    }

    // Check game config
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.gameStatus) setGameStatus(data.gameStatus);
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      if (typeof window !== "undefined") {
        localStorage.removeItem("techhunt_token");
        localStorage.removeItem("techhunt_role");
        localStorage.removeItem("techhunt_team");
        localStorage.removeItem("techhunt_user");
      }
      const wasStaff = user?.role === "ADMIN" || user?.role === "VOLUNTEER";
      setUser(null);
      router.replace(wasStaff ? "/staff-login" : "/login");
      router.refresh();
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const getStatusBadge = () => {
    switch (gameStatus) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cipher-emerald/15 text-cipher-emerald border border-cipher-emerald/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cipher-emerald animate-pulse" />
            HUNT LIVE
          </span>
        );
      case "PAUSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cipher-amber/15 text-cipher-amber border border-cipher-amber/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cipher-amber" />
            PAUSED
          </span>
        );
      case "CONCLUDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cipher-purple/15 text-cipher-purple border border-cipher-purple/30">
            CONCLUDED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            WAITING PHASE
          </span>
        );
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-surface-border bg-background/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Event Tag */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-lg bg-surface-50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 group-hover:shadow-glow-cyan transition-all">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-bold tracking-wider text-slate-100 flex items-center gap-1.5 font-mono">
                  TECH MYSTERY HUNT
                </span>
                <span className="hidden sm:block text-xs text-cipher-cyan tracking-widest font-mono">
                  THE MISSING CODE
                </span>
              </div>
            </Link>
            <div className="hidden md:block ml-2">{getStatusBadge()}</div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-3">
            <Link
              href="/rules"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                pathname === "/rules" ? "text-cyan-400 bg-surface-50" : "text-slate-300 hover:text-white hover:bg-surface-100"
              }`}
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              Rules
            </Link>

            {user?.role === "TEAM" && (
              <>
                <Link
                  href="/waiting-room"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    pathname === "/waiting-room"
                      ? "text-cyan-400 bg-surface-50"
                      : "text-slate-300 hover:text-white hover:bg-surface-100"
                  }`}
                >
                  <Radio className="w-4 h-4 text-cyan-400" />
                  Waiting Room
                </Link>
                <Link
                  href="/hunt"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    pathname === "/hunt"
                      ? "text-cipher-emerald bg-surface-50 border border-cipher-emerald/40"
                      : "text-slate-200 hover:text-white bg-cipher-emerald/10 hover:bg-cipher-emerald/20 border border-cipher-emerald/20"
                  }`}
                >
                  <Compass className="w-4 h-4 text-cipher-emerald animate-pulse" />
                  Hunt Console
                </Link>
              </>
            )}

            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  pathname === "/admin"
                    ? "text-cipher-amber bg-surface-50 border border-cipher-amber/40"
                    : "text-cipher-amber hover:text-white bg-cipher-amber/10 hover:bg-cipher-amber/20 border border-cipher-amber/20"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-cipher-amber" />
                Admin Dashboard
              </Link>
            )}

            {user?.role === "VOLUNTEER" && (
              <Link
                href="/volunteer"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  pathname === "/volunteer"
                    ? "text-purple-400 bg-surface-50 border border-purple-500/40"
                    : "text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20"
                }`}
              >
                <Award className="w-4 h-4 text-purple-400" />
                Volunteer Marshall
              </Link>
            )}
          </div>

          {/* User Auth Buttons / User Pill */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && user ? (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold text-cyan-400">
                    {user.teamId || user.username}
                  </div>
                  <div className="text-xs text-slate-400 truncate max-w-[120px]">{user.name}</div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-2 rounded-lg bg-surface-50 text-slate-400 hover:text-rose-400 hover:bg-surface-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : !loading ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-black bg-cipher-cyan hover:bg-cyan-300 transition-all shadow-glow-cyan flex items-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
              </div>
            ) : null}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <div className="scale-90">{getStatusBadge()}</div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-surface-50 text-slate-300 hover:text-white border border-surface-border"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-surface-border bg-surface-100/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-2">
          {user && (
            <div className="p-3 mb-2 rounded-lg bg-surface-50 border border-surface-border flex justify-between items-center">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-bold block">
                  {user.teamId || user.username} [{user.role}]
                </span>
                <span className="text-sm text-slate-200">{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-xs rounded bg-rose-500/20 text-rose-300 border border-rose-500/30"
              >
                Sign Out
              </button>
            </div>
          )}


          <Link
            href="/rules"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-surface-50"
          >
            Rules & Safety
          </Link>

          {user?.role === "TEAM" && (
            <>
              <Link
                href="/waiting-room"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-cyan-400 bg-surface-50"
              >
                Team Waiting Room
              </Link>
              <Link
                href="/hunt"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-cipher-emerald bg-cipher-emerald/10 border border-cipher-emerald/30"
              >
                Active Hunt Console
              </Link>
            </>
          )}

          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-cipher-amber bg-cipher-amber/10 border border-cipher-amber/30"
            >
              Admin Dashboard
            </Link>
          )}

          {user?.role === "VOLUNTEER" && (
            <Link
              href="/volunteer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30"
            >
              Volunteer Prize Marshall
            </Link>
          )}

          {!user && (
            <div className="pt-2">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-center py-2.5 rounded-xl bg-cipher-cyan text-black font-bold text-sm shadow-glow-cyan"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
