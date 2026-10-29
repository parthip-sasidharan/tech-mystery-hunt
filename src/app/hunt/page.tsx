"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Compass, 
  QrCode, 
  MapPin, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  Award, 
  Lock, 
  Unlock, 
  ArrowRight, 
  Send, 
  RefreshCw, 
  Package, 
  Sparkles, 
  ShieldAlert,
  Camera,
  CameraOff,
  MessageSquare,
  Video,
  PhoneCall,
  Clock
} from "lucide-react";

interface PenaltyTaskData {
  taskText: string;
  whatsappNumber: string;
  status: string;
}

interface CheckpointData {
  id: string;
  name: string;
  campusArea: string;
  locationHint: string;
  isScanned: boolean;
  attemptsCount: number;
  penaltyTask?: PenaltyTaskData | null;
  question: {
    id: string;
    prompt: string;
    type: string;
    options: string[] | null;
    points: number;
    hint: string | null;
  } | null;
}

interface PrizeClaimData {
  boxNumber: number;
  claimCode: string;
  status: string;
}

interface WinnerInfo {
  rank: number;
  boxNumber: number;
  teamId: string;
  teamName: string;
  claimCode?: string;
  confirmedAt?: string;
}

interface TreasureStatusData {
  activeBoxNumber: number | null;
  activeBoxClue: string | null;
  allBoxesClaimed: boolean;
  confirmedWinners: WinnerInfo[];
  teamClaim: PrizeClaimData | null;
}

interface BroadcastData {
  type: string;
  title: string;
  message: string;
  winners?: WinnerInfo[];
  timestamp?: string;
}

export default function HuntPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [gameStatus, setGameStatus] = useState<string>("WAITING");
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [checkpointNumber, setCheckpointNumber] = useState(1);
  const [totalCheckpoints, setTotalCheckpoints] = useState(8);
  const [isFinalTreasure, setIsFinalTreasure] = useState(false);
  const [isAllCompleted, setIsAllCompleted] = useState(false);
  const [currentStage, setCurrentStage] = useState("WAITING_ROOM");
  const [checkpoint, setCheckpoint] = useState<CheckpointData | null>(null);
  const [prizeClaim, setPrizeClaim] = useState<PrizeClaimData | null>(null);
  const [treasureStatus, setTreasureStatus] = useState<TreasureStatusData | null>(null);
  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [dismissedBroadcast, setDismissedBroadcast] = useState(false);

  // QR scanning state
  const [qrTokenInput, setQrTokenInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Camera Scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScanningRef = useRef(false);
  const lastScannedTokenRef = useRef<{ token: string; timestamp: number } | null>(null);

  // Question solving state
  const [answerInput, setAnswerInput] = useState("");
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerMessage, setAnswerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Box claim state
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Penalty Task & Bypass Code State
  const [teamIdDisplay, setTeamIdDisplay] = useState("MH-2026-001");
  const [bypassCodeInput, setBypassCodeInput] = useState("");
  const [bypassLoading, setBypassLoading] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);

  // Fake QR Meme Trap State (10s cooldown)
  const [fakeQrMeme, setFakeQrMeme] = useState<{
    id?: string;
    title: string;
    subtitle: string;
    videoUrl: string;
  } | null>(null);
  const [memeCooldown, setMemeCooldown] = useState<number>(0);
  const prevCheckpointIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (memeCooldown <= 0) return;
    const timer = setInterval(() => {
      setMemeCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [memeCooldown]);

  useEffect(() => {
    if (prevCheckpointIndexRef.current !== null && prevCheckpointIndexRef.current !== checkpointIndex) {
      // Auto-clear answer feedback and answer input when transitioning between checkpoints
      setAnswerMessage(null);
      setAnswerInput("");
    }
    prevCheckpointIndexRef.current = checkpointIndex;
  }, [checkpointIndex]);

  useEffect(() => {
    if (answerMessage?.type === "success") {
      const timer = setTimeout(() => {
        setAnswerMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [answerMessage]);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("techhunt_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const loadCheckpointState = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/hunt/checkpoint", {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.status === 401) {
        const token = typeof window !== "undefined" ? localStorage.getItem("techhunt_token") : null;
        if (!token) {
          router.replace("/login");
          return;
        }
        // Verify with /api/auth/me before redirecting
        const meRes = await fetch("/api/auth/me", { headers: getAuthHeaders(), credentials: "include" });
        const meData = await meRes.json();
        if (!meData.authenticated) {
          if (typeof window !== "undefined") localStorage.removeItem("techhunt_token");
          router.replace("/login");
          return;
        }
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load state");
      }

      setGameStatus(data.gameStatus);
      setIsAllCompleted(data.isAllCheckpointsCompleted);
      setCurrentStage(data.currentStage);
      setCheckpointIndex(data.checkpointIndex);
      setCheckpointNumber(data.checkpointNumber || data.checkpointIndex + 1);
      setTotalCheckpoints(data.totalCheckpoints);
      setIsFinalTreasure(!!data.isFinalTreasure);
      setCheckpoint(data.checkpoint);
      if (data.teamId) {
        setTeamIdDisplay(data.teamId);
      }
      if (data.prizeClaim) {
        setPrizeClaim(data.prizeClaim);
      }
      if (data.treasureStatus) {
        setTreasureStatus(data.treasureStatus);
        if (data.treasureStatus.teamClaim) {
          setPrizeClaim(data.treasureStatus.teamClaim);
        }
      }
      if (data.broadcast) {
        setBroadcast(data.broadcast);
      } else {
        setBroadcast(null);
      }
    } catch (err: unknown) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : "Error loading mission coordinates.");
    } finally {
      setLoading(false);
    }
  }, [router, getAuthHeaders]);

  useEffect(() => {
    loadCheckpointState();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadCheckpointState();
    }, 7000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        loadCheckpointState();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadCheckpointState]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const triggerScan = useCallback(async (token: string) => {
    const cleanToken = token.trim();
    if (!cleanToken) return;

    // Prevent duplicate concurrent scan requests
    if (isScanningRef.current) return;

    // Debounce duplicate scans of the exact same token within 3 seconds
    const now = Date.now();
    if (
      lastScannedTokenRef.current &&
      lastScannedTokenRef.current.token === cleanToken &&
      now - lastScannedTokenRef.current.timestamp < 3000
    ) {
      return;
    }

    isScanningRef.current = true;
    lastScannedTokenRef.current = { token: cleanToken, timestamp: now };
    setScanLoading(true);
    setScanMessage(null);

    try {
      const res = await fetch("/api/hunt/scan", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ qrToken: cleanToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "QR validation failed");
      }

      // Check if team scanned a Fake / Decoy Meme QR
      if (data.isFakeQr) {
        stopCamera();
        setQrTokenInput("");
        setFakeQrMeme(data.meme);
        setMemeCooldown(data.meme?.cooldownSeconds || 10);
        return;
      }

      setScanMessage({ type: "success", text: data.message });
      setQrTokenInput("");
      stopCamera();
      await loadCheckpointState();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "QR Scan error";
      setScanMessage({ type: "error", text: message });
    } finally {
      setScanLoading(false);
      setTimeout(() => {
        isScanningRef.current = false;
      }, 1500);
    }
  }, [loadCheckpointState, stopCamera, getAuthHeaders]);

  const startCamera = async () => {
    setCameraError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access requires a secure origin (HTTPS/localhost) and supported browser media APIs. Please use manual token input below.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});

          if ("BarcodeDetector" in window) {
            try {
              // @ts-expect-error BarcodeDetector might not be in standard TypeScript lib
              const barcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
              scanIntervalRef.current = setInterval(async () => {
                if (isScanningRef.current) return;
                if (videoRef.current && videoRef.current.readyState >= 2) {
                  try {
                    const barcodes = await barcodeDetector.detect(videoRef.current);
                    if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                      triggerScan(barcodes[0].rawValue);
                    }
                  } catch {
                    // Ignore transient frame detection error
                  }
                }
              }, 750);
            } catch {
              // BarcodeDetector constructor failed
            }
          }
        }
      }, 100);
    } catch (err: unknown) {
      let msg = "Could not access camera.";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          msg = "Camera permission denied. Please allow camera access in browser permissions or use manual token entry below.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          msg = "No camera found on this device. Please use manual token entry below.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          msg = "Camera is currently occupied by another application. Please release it or use manual token entry.";
        } else {
          msg = err.message;
        }
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Scan QR code form submit
  const handleQrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrTokenInput.trim()) return;
    await triggerScan(qrTokenInput.trim());
  };

  // Submit riddle answer
  const handleAnswerSubmit = async (answerValue: string) => {
    if (!answerValue.trim()) return;

    setAnswerLoading(true);
    setAnswerMessage(null);

    try {
      const res = await fetch("/api/hunt/submit", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ answer: answerValue.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      if (data.isCorrect) {
        setAnswerMessage({ type: "success", text: data.message });
        setAnswerInput("");
        await loadCheckpointState();
      } else {
        setAnswerMessage({ type: "error", text: data.message });
        // Immediately reload state so that penalty task card is triggered!
        await loadCheckpointState();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error submitting answer";
      setAnswerMessage({ type: "error", text: message });
    } finally {
      setAnswerLoading(false);
    }
  };

  const handleBypassCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bypassCodeInput.trim()) return;
    setBypassLoading(true);
    setBypassError(null);
    try {
      const res = await fetch("/api/hunt/verify-penalty", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ code: bypassCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      setBypassCodeInput("");
      setAnswerMessage({ type: "success", text: data.message });
      await loadCheckpointState();
    } catch (err: unknown) {
      setBypassError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBypassLoading(false);
    }
  };

  // Claim physical box
  const handleClaimBox = async (boxNum: number) => {
    setClaimLoading(true);
    setClaimError(null);

    try {
      const res = await fetch("/api/hunt/claim", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ boxNumber: boxNum }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to claim box");
      }

      setPrizeClaim(data.claim);
      await loadCheckpointState();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Claim error";
      setClaimError(message);
    } finally {
      setClaimLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 font-mono text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
        Decrypting Mission Coordinates...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full glow-card rounded-2xl p-8 text-center border-rose-500/30">
          <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2 font-mono">
            ROUTE ACCESS ISSUE
          </h2>
          <p className="text-sm text-slate-300 mb-6">
            {loadError}
          </p>
          <Link
            href="/waiting-room"
            className="w-full py-3 rounded-xl bg-cipher-cyan text-black font-bold text-sm flex items-center justify-center gap-2"
          >
            Return to Waiting Room
          </Link>
        </div>
      </div>
    );
  }

  if (gameStatus !== "ACTIVE") {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full glow-card rounded-2xl p-8 text-center border-amber-500/30">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2 font-mono">
            MISSION SUSPENDED / NOT ACTIVE
          </h2>
          <p className="text-sm text-slate-300 mb-6">
            The Hunt is currently in <strong>{gameStatus}</strong> status. Please wait in the Team Waiting Room
            until the Grand Master gives the green light.
          </p>
          <Link
            href="/waiting-room"
            className="w-full py-3 rounded-xl bg-cipher-cyan text-black font-bold text-sm flex items-center justify-center gap-2"
          >
            Return to Waiting Room
          </Link>
        </div>
      </div>
    );
  }

  // Calculate percentage
  const progressPercent = Math.min(
    100,
    Math.round(((isAllCompleted ? totalCheckpoints : checkpointIndex) / totalCheckpoints) * 100)
  );

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      {/* Top Progress Bar */}
      <div className="glow-card rounded-2xl p-4 sm:p-5 mb-8 border-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-sm font-bold text-white font-mono">
              STAGE {isAllCompleted ? totalCheckpoints : checkpointNumber} OF {totalCheckpoints}
            </span>
            {isFinalTreasure && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold font-mono">
                FINAL TREASURE VAULT
              </span>
            )}
          </div>
          <div className="text-xs font-mono text-slate-400">
            COMPLETION: <span className="text-cyan-400 font-bold">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress track */}
        <div className="w-full h-2.5 rounded-full bg-surface-50 overflow-hidden border border-surface-border">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 transition-all duration-500 shadow-glow-cyan"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* FINAL TREASURE VAULT / HUNT COMPLETE SCREEN */}
      {(isAllCompleted || currentStage === "TREASURE_SEARCH" || currentStage === "FINISHED") ? (
        <div className="space-y-6">
          <div className="glow-card rounded-2xl p-6 sm:p-12 border-emerald-500/40 bg-surface-100/90 text-center shadow-glow-emerald">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-10 h-10 animate-bounce" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase mb-3 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Hunt Completed • Final Checkpoint Reached
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-mono mb-2">
              🎉 അഭിനന്ദനങ്ങൾ! നിങ്ങൾ എല്ലാ ചെക്ക്‌പോയിന്റുകളും വിജയകരമായി കണ്ടെത്തി!
            </h1>

            {/* Prominent Return to Start Message */}
            <div className="max-w-2xl mx-auto my-6 p-6 sm:p-8 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-glow-emerald">
              <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono tracking-wide leading-relaxed">
                നിങ്ങൾ തുടങ്ങിയ സ്ഥലത്തു തന്നെ തിരിച്ചു എത്തുക!
              </div>
              <div className="text-sm sm:text-base text-slate-300 font-mono mt-3">
                (Please return immediately to the venue where you started!)
              </div>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-xl bg-surface-50 border border-surface-border text-xs font-mono text-slate-300 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Team:</span>
                <span className="text-white font-bold">{teamIdDisplay}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Checkpoints Solved:</span>
                <span className="text-emerald-400 font-bold">10 / 10 Completed ✓</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Next Action:</span>
                <span className="text-amber-300 font-bold">Report to Event Organizers at Starting Point</span>
              </div>
            </div>
          </div>
        </div>
      ) : checkpoint ? (
        /* ACTIVE CHECKPOINT PLAY AREA */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Location Clue & Campus Area */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glow-card rounded-2xl p-6 border-surface-border">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-cyan-400" /> PHYSICAL CHECKPOINT TARGET
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold ${
                  checkpoint.isScanned
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}>
                  {checkpoint.isScanned ? "✓ QR VERIFIED" : "🔒 LOCKED"}
                </span>
              </div>

              <h2 className="text-xl font-bold text-white mb-4 font-mono flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-400" /> Secret Clue #{checkpointNumber}
              </h2>

              <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-slate-300 shadow-glow-cyan/10">
                <div className="text-xs text-cyan-400 uppercase font-mono font-bold mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-cyan-400" /> Cryptic Location Riddle:
                </div>
                <p className="text-base italic leading-relaxed text-cyan-100 font-mono">
                  &ldquo;{checkpoint.locationHint}&rdquo;
                </p>
              </div>

              <div className="mt-4 text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                Decipher the clue above to find the secret physical location on campus and scan its QR code.
              </div>
            </div>

            {/* QR Scanner / Manual Verification Box */}
            <div className="glow-card rounded-2xl p-6 border-surface-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                  <QrCode className="w-4 h-4 text-emerald-400" /> Checkpoint QR Verification
                </h3>
                {!checkpoint.isScanned && (
                  <button
                    type="button"
                    onClick={cameraActive ? stopCamera : startCamera}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-50 border border-surface-border text-xs text-slate-300 hover:text-cyan-400 hover:border-cyan-400/40 transition-colors"
                  >
                    {cameraActive ? (
                      <>
                        <CameraOff className="w-3.5 h-3.5 text-rose-400" />
                        <span>Close Camera</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Use Camera</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {scanMessage && (
                <div className={`p-3 rounded-lg mb-4 text-xs border ${
                  scanMessage.type === "success"
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                }`}>
                  {scanMessage.text}
                </div>
              )}

              {cameraError && (
                <div className="p-3 rounded-lg mb-4 text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">Camera Notice</div>
                    <div>{cameraError}</div>
                  </div>
                </div>
              )}

              {checkpoint.isScanned ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>QR Authenticated! Answer the technical riddle to advance to the next coordinate.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {cameraActive && (
                    <div className="relative rounded-xl overflow-hidden border border-cyan-500/40 bg-black aspect-video flex items-center justify-center mb-3">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 border-2 border-cyan-400/50 m-6 rounded-lg pointer-events-none animate-pulse flex items-center justify-center">
                        <div className="text-[10px] font-mono text-cyan-300 bg-black/60 px-2 py-0.5 rounded">
                          Point at Physical Checkpoint QR
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleQrSubmit} className="space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {cameraActive
                        ? "Point camera at the physical QR code, or manually type the token below:"
                        : "Scan the physical QR code with your phone camera, or enter the token stamped beneath the code:"}
                    </p>
                    <div>
                      <input
                        type="text"
                        placeholder="e.g. QR_TOKEN_CP01_..."
                        value={qrTokenInput}
                        onChange={(e) => setQrTokenInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={scanLoading || !qrTokenInput.trim()}
                      className="w-full py-2.5 rounded-lg bg-cipher-cyan text-black font-bold text-xs hover:bg-cyan-300 transition-all shadow-glow-cyan disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {scanLoading ? "Validating QR Token..." : "Submit QR Code"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Riddle / Question Card */}
          <div className="lg:col-span-7">
            <div className="glow-card rounded-2xl p-6 sm:p-8 border-surface-border h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                    TECHNICAL DECRYPTION CHALLENGE
                  </span>
                </div>

                {!checkpoint.isScanned ? (
                  <div className="text-center py-16 px-4">
                    <div className="w-14 h-14 rounded-full bg-surface-50 border border-surface-border text-slate-500 flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 font-mono">
                      CHALLENGE ENCRYPTED
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      The puzzle at this checkpoint is locked. You must physically visit the location and scan its QR code to decrypt the riddle.
                    </p>
                  </div>
                ) : checkpoint.penaltyTask && checkpoint.penaltyTask.status === "PENDING_VERIFICATION" ? (
                  /* WRONG ANSWER PENALTY TASK CARD */
                  <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="p-4 rounded-xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-200">
                      <div className="flex items-center gap-2 font-bold text-sm font-mono text-rose-400 mb-1">
                        <AlertCircle className="w-5 h-5 text-rose-400 animate-pulse shrink-0" />
                        തെറ്റായ ഉത്തരം! പെനാൽറ്റി ടാസ്ക് പൂർത്തിയാക്കുക!
                      </div>
                      <div className="text-xs text-rose-300 font-mono">
                        Wrong Answer! Complete the assigned physical task and submit your video via WhatsApp to unlock the next checkpoint clue.
                      </div>
                    </div>

                    {/* Task Display Box */}
                    <div className="p-5 rounded-2xl bg-surface-50 border-2 border-amber-500/40 shadow-glow-amber/20">
                      <div className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-amber-400" /> നിർബന്ധിത പെനാൽറ്റി ടാസ്ക് (Assigned Task)
                      </div>
                      <p className="text-base sm:text-lg text-white font-medium leading-relaxed font-mono">
                        {checkpoint.penaltyTask.taskText}
                      </p>
                    </div>

                    {/* WhatsApp Action Box */}
                    <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-4">
                      <div>
                        <div className="text-xs font-mono font-bold text-emerald-400 uppercase mb-1 flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-emerald-400" /> വാട്സാപ്പിൽ വീഡിയോ അയക്കുക
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-mono">
                          ഈ ടാസ്ക് ചെയ്യുന്ന വീഡിയോ ഫോണിൽ എടുത്ത് താഴെ കാണുന്ന വാട്സാപ്പ് നമ്പറിലേക്ക് അയക്കുക. വോളന്റിയർ / അഡ്മിൻ വീഡിയോ പരിശോധിച്ച് അപ്രൂവ് ചെയ്താലുടൻ അടുത്ത ക്ലൂ ഇവിടെ തനിയെ അൺലോക്ക് ആകും!
                        </p>
                      </div>

                      <a
                        href={`https://wa.me/${checkpoint.penaltyTask.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hello Marshall! Team ${teamIdDisplay} is submitting the Penalty Task Video for Checkpoint #${checkpointNumber} (${checkpoint.name}).`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all font-mono"
                      >
                        <MessageSquare className="w-5 h-5" /> 📱 Send Video on WhatsApp ({checkpoint.penaltyTask.whatsappNumber})
                      </a>

                      <div className="p-3 rounded-xl bg-surface-100/80 border border-surface-border text-center">
                        <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 animate-pulse font-bold">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          വോളന്റിയറുടെ വെരിഫിക്കേഷനായി കാത്തിരിക്കുന്നു (Waiting for Marshall Approval)...
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-1">
                          വീഡിയോ അപ്രൂവ് ആയാൽ ഈ പേജ് ഓട്ടോമാറ്റിക്കായി അടുത്ത ക്ലൂവിലേക്ക് മാറും.
                        </div>
                      </div>

                      {/* Physical Marshall Bypass Code Fallback */}
                      <form onSubmit={handleBypassCodeSubmit} className="pt-3 border-t border-surface-border/60">
                        <div className="text-[11px] font-mono text-slate-400 mb-2">
                          വേദിയിലുള്ള വോളന്റിയർ നേരിട്ട് തന്ന 4-ഡിജിറ്റ് പാസ്കോഡ് ഉണ്ടോ?
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter 4-digit code (e.g. 7788)"
                            value={bypassCodeInput}
                            onChange={(e) => setBypassCodeInput(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="submit"
                            disabled={bypassLoading || !bypassCodeInput.trim()}
                            className="px-4 py-2 rounded-lg bg-amber-400 text-black font-bold text-xs font-mono hover:bg-amber-300 disabled:opacity-40"
                          >
                            {bypassLoading ? "Checking..." : "Unlock"}
                          </button>
                        </div>
                        {bypassError && (
                          <div className="text-[11px] text-rose-400 font-mono mt-1">
                            {bypassError}
                          </div>
                        )}
                      </form>
                    </div>
                  </div>
                ) : checkpoint.question ? (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-surface-50 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.08)]">
                      <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-2 uppercase tracking-wider">
                        <HelpCircle className="w-4 h-4 text-cyan-400" />
                        <span>Riddle / Problem Statement:</span>
                      </div>
                      <p className="text-base text-white font-medium leading-relaxed">
                        {checkpoint.question.prompt}
                      </p>
                    </div>

                    {/* Hint if attempts > 2 */}
                    {checkpoint.question.hint && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        <strong>Emergency Hint:</strong> {checkpoint.question.hint}
                      </div>
                    )}

                    {answerMessage && (
                      <div className={`p-3.5 rounded-xl text-xs border ${
                        answerMessage.type === "success"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                      }`}>
                        {answerMessage.text}
                      </div>
                    )}

                    {/* Question Input Form */}
                    {checkpoint.question.options && checkpoint.question.options.length > 0 ? (
                      /* Multiple Choice */
                      <div className="space-y-2.5">
                        <label className="block text-xs font-medium text-slate-400">
                          Select the correct answer:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {checkpoint.question.options.map((opt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleAnswerSubmit(opt)}
                              disabled={answerLoading}
                              className="p-3 rounded-xl bg-surface-50 border border-surface-border text-left text-sm text-slate-200 hover:text-white hover:border-cyan-400 hover:bg-surface-100 transition-all font-mono"
                            >
                              <span className="text-cyan-400 font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Free-text or Numeric code */
                      <div className="space-y-3">
                        <label className="block text-xs font-medium text-slate-400">
                          Enter your decoded answer or value:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Type answer here..."
                            value={answerInput}
                            onChange={(e) => setAnswerInput(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-50 border border-surface-border text-white text-sm font-mono focus:outline-none focus:border-cyan-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleAnswerSubmit(answerInput)}
                            disabled={answerLoading || !answerInput.trim()}
                            className="px-6 py-2.5 rounded-xl bg-cipher-cyan text-black font-bold text-sm hover:bg-cyan-300 transition-all shadow-glow-cyan disabled:opacity-40 flex items-center gap-1.5"
                          >
                            <Send className="w-4 h-4" />
                            Submit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="pt-6 mt-6 border-t border-surface-border text-xs text-slate-500 flex justify-between items-center">
                <span>Recorded attempts: {checkpoint.attemptsCount}</span>
                <span className="font-mono">Server-side Answer Hash Verification</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* FAKE QR / TROLL MEME MODAL WITH 10S COOLDOWN */}
      {fakeQrMeme && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full glow-card rounded-2xl p-5 sm:p-6 border-2 border-amber-500/60 bg-surface-100 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase mb-3 bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping mr-1" />
              🚨 FAKE QR TRAP ACTIVATED!
            </div>

            {/* Video Player */}
            <div className="relative rounded-xl overflow-hidden border border-amber-500/30 bg-black mb-4">
              <video
                src={fakeQrMeme.videoUrl}
                autoPlay
                loop
                playsInline
                controls
                className="w-full max-h-64 object-contain mx-auto"
              />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-amber-300 font-mono mb-1 leading-snug">
              {fakeQrMeme.title}
            </h3>
            <p className="text-xs text-slate-300 font-mono mb-5">
              {fakeQrMeme.subtitle}
            </p>

            {/* 10-Second Cooldown Timer & Action */}
            <div className="space-y-3">
              {memeCooldown > 0 ? (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-mono text-xs flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 animate-spin text-rose-400" />
                  <span className="font-bold">
                    ⏳ SCANNER COOLDOWN: {memeCooldown}s Remaining
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold">✓ Cooldown complete! You can search real QR.</span>
                </div>
              )}

              <button
                type="button"
                disabled={memeCooldown > 0}
                onClick={() => setFakeQrMeme(null)}
                className={`w-full py-3 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  memeCooldown > 0
                    ? "bg-surface-50 text-slate-500 border border-surface-border cursor-not-allowed opacity-60"
                    : "bg-gradient-to-r from-emerald-500 to-green-600 text-black shadow-glow-emerald cursor-pointer hover:from-emerald-400 hover:to-green-500"
                }`}
              >
                {memeCooldown > 0
                  ? `Wait ${memeCooldown}s to resume hunt...`
                  : "Close & Search for Real QR →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL TOURNAMENT BROADCAST MODAL */}
      {broadcast && !dismissedBroadcast && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full glow-card rounded-2xl p-6 sm:p-8 border-2 border-rose-500/60 bg-surface-100 shadow-[0_0_50px_rgba(244,63,94,0.35)] text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase mb-3 bg-rose-500/20 text-rose-300 border border-rose-500/40">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping mr-1" />
              OFFICIAL TOURNAMENT BROADCAST
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-mono mb-3 leading-tight">
              {broadcast.title}
            </h2>

            <p className="text-sm text-slate-200 leading-relaxed mb-6 font-mono whitespace-pre-wrap">
              {broadcast.message}
            </p>

            {broadcast.winners && broadcast.winners.length > 0 && (
              <div className="bg-surface-200/80 rounded-xl p-4 border border-surface-border text-left font-mono space-y-2 mb-6">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-2 font-bold text-center">
                  🏆 FINAL EVENT WINNERS 🏆
                </div>
                {broadcast.winners.map((w, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-surface-border/50 last:border-0">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {w.rank === 1 ? "🥇 1st Place:" : w.rank === 2 ? "🥈 2nd Place:" : "🥉 3rd Place:"} {w.teamName}
                    </span>
                    <span className="text-cyan-400 font-mono text-[11px]">{w.teamId} (Box #{w.boxNumber})</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setDismissedBroadcast(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-black font-extrabold text-sm uppercase tracking-wider transition-all shadow-glow-amber"
            >
              Acknowledge & View Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
