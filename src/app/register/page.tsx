"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Terminal, 
  Lock,
  Clock,
  Ban
} from "lucide-react";

interface Member {
  name: string;
  collegeId: string;
  phone: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [checkingConfig, setCheckingConfig] = useState(true);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [registrationWorkflow, setRegistrationWorkflow] = useState<"AUTO_APPROVE" | "MANUAL_APPROVAL">("AUTO_APPROVE");

  const [teamName, setTeamName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [leaderEmail, setLeaderEmail] = useState("");
  const [leaderPhone, setLeaderPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [members, setMembers] = useState<Member[]>([
    { name: "", collegeId: "", phone: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success states
  const [autoApprovedData, setAutoApprovedData] = useState<{
    teamId: string;
    teamName: string;
    routeName: string;
  } | null>(null);

  const [pendingApprovalData, setPendingApprovalData] = useState<{
    teamName: string;
    leaderEmail: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    async function checkConfig() {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        if (data.registrationOpen !== undefined) {
          setRegistrationOpen(data.registrationOpen);
        }
        if (data.registrationWorkflow) {
          setRegistrationWorkflow(data.registrationWorkflow);
        }
      } catch (err) {
        console.error("Failed to load registration config", err);
      } finally {
        setCheckingConfig(false);
      }
    }
    checkConfig();
  }, []);

  const addMember = () => {
    if (members.length < 3) {
      setMembers([...members, { name: "", collegeId: "", phone: "" }]);
    }
  };

  const removeMember = (index: number) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const updateMember = (index: number, field: keyof Member, value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    const validMembers = members.filter((m) => m.name.trim().length > 0 && m.collegeId.trim().length > 0);
    if (validMembers.length === 0) {
      setError("Please add at least 1 additional teammate with their Name and College ID.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName,
          leaderName,
          leaderEmail,
          leaderPhone,
          password,
          members: validMembers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      if (data.pendingApproval) {
        setPendingApprovalData({
          teamName: data.teamName,
          leaderEmail: data.leaderEmail,
          message: data.message || "Registration submitted! Awaiting organizer approval.",
        });
      } else if (data.team) {
        setAutoApprovedData({
          teamId: data.team.teamId,
          teamName: data.team.name,
          routeName: data.team.routeName,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Screen 1: Auto-Approved Success
  if (autoApprovedData) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-md w-full glow-card rounded-2xl p-8 text-center border-cipher-emerald/40 shadow-glow-emerald">
          <div className="w-16 h-16 rounded-full bg-cipher-emerald/20 border border-cipher-emerald/40 text-cipher-emerald flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2 font-mono">
            TEAM REGISTERED!
          </h2>
          <p className="text-sm text-slate-300 mb-6">
            Your team is officially enrolled in the Tech Mystery Hunt database.
          </p>

          <div className="bg-surface-300 rounded-xl p-5 border border-surface-border text-left font-mono space-y-2.5 mb-6">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>ASSIGNED TEAM ID:</span>
              <span className="text-cyan-400 font-bold text-base">{autoApprovedData.teamId}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>TEAM NAME:</span>
              <span className="text-white font-semibold">{autoApprovedData.teamName}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>CAMPUS ROUTE:</span>
              <span className="text-emerald-400 font-semibold">{autoApprovedData.routeName}</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 mb-6">
            Keep your Team ID (<span className="text-cyan-400 font-mono">{autoApprovedData.teamId}</span>) and password safe. You will need them to log in on any device.
          </div>

          <button
            onClick={() => router.push("/waiting-room")}
            className="w-full py-3 rounded-xl bg-cipher-cyan text-black font-bold text-sm hover:bg-cyan-300 transition-all shadow-glow-cyan flex items-center justify-center gap-2"
          >
            Enter Team Waiting Room
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Screen 2: Pending Approval Success
  if (pendingApprovalData) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-md w-full glow-card rounded-2xl p-8 text-center border-amber-500/40 shadow-glow-amber">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2 font-mono">
            REGISTRATION SUBMITTED!
          </h2>
          <p className="text-sm text-slate-300 mb-6">
            Your team enrollment request is pending verification by the TechFest event organizers.
          </p>

          <div className="bg-surface-300 rounded-xl p-5 border border-surface-border text-left font-mono space-y-2.5 mb-6">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>STATUS:</span>
              <span className="text-amber-400 font-bold">PENDING APPROVAL</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>TEAM NAME:</span>
              <span className="text-white font-semibold">{pendingApprovalData.teamName}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>LEADER EMAIL:</span>
              <span className="text-cyan-400 font-semibold">{pendingApprovalData.leaderEmail}</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 mb-6 leading-relaxed">
            As soon as an organizer approves your registration, your official Team ID will be automatically allocated and your team will be activated. You will then be able to log in using your Team ID or Leader Email.
          </div>

          <Link
            href="/login"
            className="w-full py-3 rounded-xl bg-surface-100 border border-surface-border text-white font-bold text-sm hover:bg-surface-50 transition-all flex items-center justify-center gap-2"
          >
            Go to Team Login
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Screen 3: Registration Closed
  if (!checkingConfig && !registrationOpen) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-md w-full glow-card rounded-2xl p-8 text-center border-rose-500/40">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2 font-mono">
            REGISTRATIONS CLOSED
          </h2>
          <p className="text-sm text-slate-300 mb-6">
            Online registrations for Tech Mystery Hunt are currently closed by the event coordinators.
          </p>

          <div className="p-4 rounded-xl bg-surface-300 border border-surface-border text-xs text-slate-400 mb-6 leading-relaxed">
            If you need an on-site spot entry, please visit the physical Registration Help Desk at the campus venue.
          </div>

          <Link
            href="/login"
            className="w-full py-3 rounded-xl bg-cipher-cyan text-black font-bold text-sm hover:bg-cyan-300 transition-all shadow-glow-cyan flex items-center justify-center gap-2"
          >
            Go to Team Login
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 border border-surface-border text-xs font-mono text-cyan-400 mb-3">
          <Terminal className="w-3.5 h-3.5" /> RECRUITMENT PROTOCOL
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Register Your Team
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          {registrationWorkflow === "MANUAL_APPROVAL"
            ? "Submit team credentials for organizer approval. An automated Team ID will be assigned upon acceptance."
            : "Enter team credentials to receive an instant automated Team ID (e.g. TEAM001) and balanced campus route."}
        </p>
      </div>

      <div className="glow-card rounded-2xl p-6 sm:p-8 border-surface-border">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Basic Credentials */}
          <div className="border-b border-surface-border pb-6 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 font-mono">
              <Users className="w-4 h-4 text-cyan-400" /> 1. Team & Leader Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Byte Breakers"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Team Leader Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parthip S"
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Leader Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="leader@college.edu"
                  value={leaderEmail}
                  onChange={(e) => setLeaderEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Leader Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={leaderPhone}
                  onChange={(e) => setLeaderPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Teammates Section */}
          <div className="border-b border-surface-border pb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2 font-mono">
                <UserPlus className="w-4 h-4 text-emerald-400" /> 2. Teammates (2-4 Members Total)
              </h3>
              {members.length < 3 && (
                <button
                  type="button"
                  onClick={addMember}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Teammate
                </button>
              )}
            </div>

            <div className="space-y-3">
              {members.map((member, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-surface-50/70 border border-surface-border grid grid-cols-1 sm:grid-cols-3 gap-3 relative"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Member #{idx + 2} Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Name"
                      value={member.name}
                      onChange={(e) => updateMember(idx, "name", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      College / Roll ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 21CS042"
                      value={member.collegeId}
                      onChange={(e) => updateMember(idx, "collegeId", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        placeholder="Mobile"
                        value={member.phone}
                        onChange={(e) => updateMember(idx, "phone", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMember(idx)}
                        className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Credentials */}
          <div className="border-b border-surface-border pb-6 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 font-mono">
              <Lock className="w-4 h-4 text-amber-400" /> 3. Security Access Key
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Team Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repeat team password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-50 border border-surface-border text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Passwords are salted and securely hashed using bcrypt prior to database storage.
            </p>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <Link
              href="/login"
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Already registered? Sign in here &rarr;
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-cipher-cyan text-black font-bold text-sm hover:bg-cyan-300 transition-all shadow-glow-cyan disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Processing Registration...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  {registrationWorkflow === "MANUAL_APPROVAL" ? "Submit For Approval" : "Confirm Registration"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
