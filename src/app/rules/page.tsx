import Link from "next/link";
import { 
  HelpCircle, 
  ShieldCheck, 
  AlertTriangle, 
  Compass, 
  QrCode, 
  Award, 
  Clock, 
  Users 
} from "lucide-react";

export default function RulesPage() {
  return (
    <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 border border-surface-border text-xs font-mono text-cyan-400 mb-3">
          <HelpCircle className="w-3.5 h-3.5" /> PROTOCOLS & REGULATIONS
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono">
          Rules of Engagement
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Read these operational directives carefully before starting the hunt.
        </p>
      </div>

      <div className="space-y-6">
        {/* Core Rules */}
        <div className="glow-card rounded-2xl p-6 sm:p-8 border-surface-border">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-mono">
            <Compass className="w-5 h-5 text-cyan-400" /> 1. Team Composition & Movement
          </h2>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="text-cyan-400 font-bold font-mono">1.1</span>
              <span>Each registered team must comprise 2 to 4 members. All teammates must remain together during campus navigation.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-cyan-400 font-bold font-mono">1.2</span>
              <span>Your team is assigned a specific anti-bottleneck route. Attempting to scan checkpoints out of sequence will trigger a security violation error.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-cyan-400 font-bold font-mono">1.3</span>
              <span>Keep your Team ID and login credentials active on your mobile devices.</span>
            </li>
          </ul>
        </div>

        {/* QR Scanning & Questions */}
        <div className="glow-card rounded-2xl p-6 sm:p-8 border-surface-border">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-mono">
            <QrCode className="w-5 h-5 text-emerald-400" /> 2. Checkpoint QR & Puzzles
          </h2>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold font-mono">2.1</span>
              <span>When you reach a checkpoint, scan the physical QR code or enter its token. This verifies physical presence and decrypts the riddle.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold font-mono">2.2</span>
              <span>Answer validation is performed entirely server-side with cryptographic hashing. Answers are case-insensitive.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold font-mono">2.3</span>
              <span>Incorrect attempts are logged. If your team is stuck for 2 or more attempts, an emergency hint will automatically unlock.</span>
            </li>
          </ul>
        </div>

        {/* The Three Physical Treasure Boxes */}
        <div className="glow-card rounded-2xl p-6 sm:p-8 border-surface-border">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-mono">
            <Award className="w-5 h-5 text-amber-400" /> 3. The Physical Treasure Boxes
          </h2>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="text-amber-400 font-bold font-mono">3.1</span>
              <span>The final checkpoint (Checkpoint 8 or 10, as configured by the organizers) leads to the physical Treasure Dais.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-amber-400 font-bold font-mono">3.2</span>
              <span>There are three physical treasure boxes (Box 1: Titan, Box 2: Cipher, Box 3: Nova).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-amber-400 font-bold font-mono">3.3</span>
              <span>Upon selecting a box, your team receives a unique physical claim code. You must present this code in person to the Volunteer Box Marshall to receive the physical box.</span>
            </li>
          </ul>
        </div>

        {/* Campus Safety Notice */}
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-bold font-mono text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            SAFETY & CAMPUS INTEGRITY
          </div>
          <p className="text-xs leading-relaxed text-amber-200/90">
            Running in crowded corridors or climbing into restricted utility zones is strictly prohibited.
            All physical checkpoints are placed in safe, accessible public areas of the campus buildings.
            Violation of campus conduct will result in immediate disqualification.
          </p>
        </div>
      </div>
    </div>
  );
}
