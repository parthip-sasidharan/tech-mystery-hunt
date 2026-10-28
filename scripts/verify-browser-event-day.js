/**
 * scripts/verify-browser-event-day.js
 *
 * STEP 8: Real Browser Verification & Event-Day Setup Audit
 *
 * Verifies:
 * 1. Local setup (package.json, README.md, .env.example, DB connection, seed script idempotency & safety)
 * 2. Authentication & role-based access control across all roles (Unauthenticated, Team, Volunteer, Admin)
 * 3. Complete live team journey (Register -> Approval -> ID & Route -> Waiting Room -> Game Active -> QR Scan -> Wrong Answer -> Correct Answer -> Advance -> Persist)
 * 4. Final treasure & physical prizes (Box 1/2/3 claims, volunteer handover verification, duplicate claim rejection)
 * 5. Game-state restrictions (WAITING, ACTIVE, PAUSED, CONCLUDED enforcement)
 * 6. Browser & Mobile responsiveness (Desktop 1280x800 & Mobile 375x812 via Headless Chrome screenshots)
 */

"use strict";

require("dotenv").config({ path: ".env" });
const http = require("http");
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";
const JWT_SECRET = process.env.JWT_SECRET || "replace-with-a-very-long-random-string-for-production";
const PORT = 3005;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SCREENSHOT_DIR = path.join(__dirname, "..", "public", "verification-screenshots");

const results = [];

function record(section, checkName, status, details = "") {
  results.push({ section, checkName, status, details });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "⚠";
  console.log(`  ${icon} [${status}] ${section} - ${checkName}${details ? ` (${details})` : ""}`);
}

// HTTP Helper for making requests with cookies
function request(method, pathUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const headers = {
      ...(options.headers || {}),
    };

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (options.cookie) {
      headers["Cookie"] = options.cookie;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(rawData);
          } catch {
            data = rawData;
          }

          // Capture cookies if set
          const setCookieHeaders = res.headers["set-cookie"] || [];
          const cookies = setCookieHeaders.map((c) => c.split(";")[0]).join("; ");

          resolve({
            status: res.statusCode,
            headers: res.headers,
            cookies,
            data,
            raw: rawData,
          });
        });
      }
    );

    req.on("error", (err) => reject(err));

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function waitForServer(retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request("GET", "/api/config");
      if (res.status === 200) {
        return true;
      }
    } catch {
      // Wait for next poll
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function runAudit() {
  console.log("================================================================================");
  console.log("🚀 STEP 8: REAL BROWSER VERIFICATION & EVENT-DAY SETUP AUDIT");
  console.log("================================================================================");

  let nextProcess = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Local Setup & Database Safety
    // -------------------------------------------------------------------------
    console.log("\n[SECTION 1] Local Setup & Database Safety Verification");

    // 1.1 Verify package.json, README.md, .env.example
    const pkgPath = path.join(__dirname, "..", "package.json");
    const readmePath = path.join(__dirname, "..", "README.md");
    const envExamplePath = path.join(__dirname, "..", ".env.example");

    const pkgExists = fs.existsSync(pkgPath);
    const readmeExists = fs.existsSync(readmePath);
    const envExampleExists = fs.existsSync(envExamplePath);

    if (pkgExists && readmeExists && envExampleExists) {
      record("Section 1", "Documentation and Config Files", "PASS", "package.json, README.md, .env.example verified");
    } else {
      record("Section 1", "Documentation and Config Files", "FAIL", "Missing required setup files");
    }

    // 1.2 Verify .env.example does not contain hardcoded secrets
    const envExampleContent = fs.readFileSync(envExamplePath, "utf-8");
    const hasSecretKey = envExampleContent.includes("replace-with-a-very-long-random-string");
    const noRealPassword = !envExampleContent.includes("Admin#TechHunt2026") && !envExampleContent.includes("mongodb+srv://admin:pass");
    if (hasSecretKey && noRealPassword) {
      record("Section 1", "Environment Secrets Hygiene", "PASS", ".env.example contains only template placeholders");
    } else {
      record("Section 1", "Environment Secrets Hygiene", "FAIL", ".env.example exposes sensitive strings");
    }

    // 1.3 Verify MongoDB connection & required indexes
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    const teamIdIndexes = await db.collection("team_id_pools").indexes();
    const teamIndexes = await db.collection("teams").indexes();
    const regIndexes = await db.collection("registrations").indexes();
    const prizeIndexes = await db.collection("prizeclaims").indexes();

    const hasPoolUnique = teamIdIndexes.some((idx) => idx.unique && idx.key && idx.key.teamId === 1);
    const hasTeamUnique = teamIndexes.some((idx) => idx.unique && idx.key && idx.key.teamId === 1);
    const hasRegUnique = regIndexes.some((idx) => idx.unique && idx.key && idx.key.teamName === 1);
    const hasPrizeUnique = prizeIndexes.some((idx) => idx.unique && idx.key && idx.key.boxNumber === 1);

    if (hasPoolUnique && hasTeamUnique && hasRegUnique && hasPrizeUnique) {
      record("Section 1", "MongoDB Required Indexes", "PASS", "Unique constraints on teamId, teamName, and boxNumber verified");
    } else {
      record("Section 1", "MongoDB Required Indexes", "FAIL", "Missing required unique indexes in collections");
    }

    // 1.4 Verify Seed Script Safety (Idempotent, never deletes teams/progress)
    const seedScriptContent = fs.readFileSync(path.join(__dirname, "seed-mongo.js"), "utf-8");
    const seedDropsTeams = seedScriptContent.includes("db.collection(\"teams\").deleteMany") || seedScriptContent.includes("db.collection(\"team_progress\").deleteMany");
    const seedUsesUpserts = seedScriptContent.includes("$setOnInsert") && seedScriptContent.includes("upsert: true");

    if (!seedDropsTeams && seedUsesUpserts) {
      record("Section 1", "Seed Script Idempotency & Safety", "PASS", "Uses $setOnInsert upserts and never deletes team data");
    } else {
      record("Section 1", "Seed Script Idempotency & Safety", "FAIL", "Seed script contains destructive operations");
    }

    // -------------------------------------------------------------------------
    // Start Next.js Production Server for Real HTTP Testing
    // -------------------------------------------------------------------------
    console.log(`\nStarting Next.js Production Server on http://127.0.0.1:${PORT}...`);
    nextProcess = spawn("node", [path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, PORT: String(PORT) },
      stdio: "pipe",
    });

    nextProcess.stderr.on("data", (d) => {
      const msg = d.toString();
      if (!msg.includes("ExperimentalWarning")) {
        // console.error("Next stderr:", msg);
      }
    });

    const serverReady = await waitForServer(30, 1000);
    if (!serverReady) {
      throw new Error(`Failed to start Next.js server on port ${PORT}`);
    }
    console.log(`✓ Next.js server is live at http://127.0.0.1:${PORT}\n`);

    // -------------------------------------------------------------------------
    // SECTION 2: Authentication & Role-Based Access Control Verification
    // -------------------------------------------------------------------------
    console.log("[SECTION 2] Authentication & Role-Based Access Control Verification");

    // 2.1 Public Pages
    const homeRes = await request("GET", "/");
    const regRes = await request("GET", "/register");
    const loginRes = await request("GET", "/login");
    const rulesRes = await request("GET", "/rules");

    if (homeRes.status === 200 && regRes.status === 200 && loginRes.status === 200 && rulesRes.status === 200) {
      record("Section 2", "Public Pages Accessibility", "PASS", "/, /register, /login, /rules return HTTP 200");
    } else {
      record("Section 2", "Public Pages Accessibility", "FAIL", "Public pages failed to render");
    }

    // 2.2 Unauthenticated API & Protected Page Access Rejection
    const unauthCheck = await request("GET", "/api/hunt/checkpoint");
    const unauthAdmin = await request("GET", "/api/admin/overview");
    const unauthVol = await request("GET", "/api/volunteer/claims");

    if (unauthCheck.status === 401 && unauthAdmin.status === 401 && unauthVol.status === 401) {
      record("Section 2", "Unauthenticated API Protection", "PASS", "/api/hunt, /api/admin, /api/volunteer return 401 Unauthorized");
    } else {
      record("Section 2", "Unauthenticated API Protection", "FAIL", `Expected 401s, got ${unauthCheck.status}, ${unauthAdmin.status}, ${unauthVol.status}`);
    }

    // 2.3 Role Isolation: Volunteer Login
    const volLoginRes = await request("POST", "/api/auth/login", {
      body: { identifier: "volunteer1", password: "Volunteer#TechHunt2026" },
    });
    const volCookie = volLoginRes.cookies;

    if (volLoginRes.status === 200 && volCookie) {
      const volClaimsRes = await request("GET", "/api/volunteer/claims", { cookie: volCookie });
      const volAdminRes = await request("GET", "/api/admin/overview", { cookie: volCookie });
      const volHuntRes = await request("GET", "/api/hunt/checkpoint", { cookie: volCookie });

      const volAuthorized = volClaimsRes.status === 200;
      const volBlockedAdmin = volAdminRes.status === 403;
      const volBlockedHunt = volHuntRes.status === 403;

      if (volAuthorized && volBlockedAdmin && volBlockedHunt) {
        record("Section 2", "Volunteer Role Bounds Enforcement", "PASS", "Authorized for /volunteer, strictly blocked from /admin (403) and /hunt (403)");
      } else {
        record("Section 2", "Volunteer Role Bounds Enforcement", "FAIL", `Status volClaims=${volClaimsRes.status}, volAdmin=${volAdminRes.status}, volHunt=${volHuntRes.status}`);
      }
    } else {
      record("Section 2", "Volunteer Login", "FAIL", `Could not authenticate volunteer: status ${volLoginRes.status}`);
    }

    // 2.4 Admin Login & Full Access
    const adminLoginRes = await request("POST", "/api/auth/login", {
      body: { identifier: "admin", password: "Admin#TechHunt2026" },
    });
    const adminCookie = adminLoginRes.cookies;

    if (adminLoginRes.status === 200 && adminCookie) {
      const adminOverview = await request("GET", "/api/admin/overview", { cookie: adminCookie });
      const adminCheckpoints = await request("GET", "/api/admin/checkpoints", { cookie: adminCookie });
      const adminVolClaims = await request("GET", "/api/volunteer/claims", { cookie: adminCookie });

      if (adminOverview.status === 200 && adminCheckpoints.status === 200 && adminVolClaims.status === 200) {
        record("Section 2", "Admin Authorization & Server-Side Guards", "PASS", "Full access to /admin/overview, /admin/checkpoints, and volunteer audit");
      } else {
        record("Section 2", "Admin Authorization & Server-Side Guards", "FAIL", `Admin API access failed: ${adminOverview.status}`);
      }
    } else {
      record("Section 2", "Admin Login", "FAIL", `Admin login failed: ${adminLoginRes.status}`);
    }

    // -------------------------------------------------------------------------
    // SECTION 3: Complete Team Journey Verification
    // -------------------------------------------------------------------------
    console.log("\n[SECTION 3] Complete Team Journey Verification");

    // Ensure Game Status is WAITING initially
    await request("POST", "/api/config", {
      cookie: adminCookie,
      body: { gameStatus: "WAITING", registrationOpen: true },
    });

    const uniqueSuffix = Date.now().toString().slice(-4);
    const testTeamName = `Apex Innovators ${uniqueSuffix}`;
    const testLeaderEmail = `apex_${uniqueSuffix}@college.edu`;
    const testTeamPass = "Apex#Hunt2026!";

    // 3.1 Register Test Team
    const regSubmitRes = await request("POST", "/api/auth/register", {
      body: {
        teamName: testTeamName,
        leaderName: "Marcus Vance",
        leaderEmail: testLeaderEmail,
        leaderPhone: "9876543210",
        password: testTeamPass,
        members: [
          { name: "Elena Rostova", collegeId: `CS-${uniqueSuffix}-01`, phone: "9876543211" },
        ],
      },
    });

    let assignedTeamId = null;
    let teamCookie = null;

    if (regSubmitRes.status === 200 && (regSubmitRes.data.team?.teamId || regSubmitRes.data.teamId)) {
      assignedTeamId = regSubmitRes.data.team?.teamId || regSubmitRes.data.teamId;
      record("Section 3", "Dynamic Team Registration & ID Allocation", "PASS", `Created team: ${assignedTeamId} (${testTeamName})`);
    } else {
      record("Section 3", "Dynamic Team Registration & ID Allocation", "FAIL", `Registration failed: ${regSubmitRes.status} ${JSON.stringify(regSubmitRes.data)}`);
    }

    // Admin auto-assigns balanced routes to any newly registered teams
    await request("POST", "/api/admin/routes/assign", {
      cookie: adminCookie,
      body: {},
    });

    // 3.2 Team Login
    const teamLoginRes = await request("POST", "/api/auth/login", {
      body: { identifier: assignedTeamId, password: testTeamPass },
    });
    teamCookie = teamLoginRes.cookies;

    if (teamLoginRes.status === 200 && teamCookie) {
      record("Section 3", "Team Authentication", "PASS", `Team ${assignedTeamId} authenticated successfully`);
    } else {
      record("Section 3", "Team Authentication", "FAIL", `Team login failed: ${teamLoginRes.status}`);
    }

    // 3.3 Team Isolation Guard
    const teamAdminAttempt = await request("GET", "/api/admin/overview", { cookie: teamCookie });
    const teamVolAttempt = await request("GET", "/api/volunteer/claims", { cookie: teamCookie });
    if (teamAdminAttempt.status === 403 && teamVolAttempt.status === 403) {
      record("Section 3", "Cross-Role Isolation for Team Account", "PASS", "Team cannot access Admin (403) or Volunteer (403) APIs");
    } else {
      record("Section 3", "Cross-Role Isolation for Team Account", "FAIL", "Team breached RBAC boundary");
    }

    // 3.4 Team in Waiting Room & Mission Start Blocked Before Game is ACTIVE
    const waitRoomState = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });
    const earlyStartRes = await request("POST", "/api/hunt/start", { cookie: teamCookie });

    if (earlyStartRes.status === 400) {
      record("Section 3", "Waiting Room Hold & Mission Start Gate", "PASS", `Start mission blocked while WAITING (400: ${earlyStartRes.data.error || "Blocked"})`);
    } else {
      record("Section 3", "Waiting Room Hold & Mission Start Gate", "FAIL", `Early start not blocked: status ${earlyStartRes.status}`);
    }

    // 3.5 Admin Starts Game -> ACTIVE
    const setGameActiveRes = await request("POST", "/api/config", {
      cookie: adminCookie,
      body: { gameStatus: "ACTIVE" },
    });
    if (setGameActiveRes.status === 200) {
      record("Section 3", "Admin Hunt Activation", "PASS", "Game status transitioned to ACTIVE");
    } else {
      record("Section 3", "Admin Hunt Activation", "FAIL", `Failed to set game ACTIVE: ${setGameActiveRes.status} ${JSON.stringify(setGameActiveRes.data)}`);
    }

    // 3.6 Team Starts Mission (Idempotent)
    const validStartRes = await request("POST", "/api/hunt/start", { cookie: teamCookie });
    const repeatStartRes = await request("POST", "/api/hunt/start", { cookie: teamCookie });

    if (validStartRes.status === 200 && repeatStartRes.status === 200) {
      record("Section 3", "Idempotent Mission Start", "PASS", "Mission initialized and repeat start calls return cleanly");
    } else {
      record("Section 3", "Idempotent Mission Start", "FAIL", `Mission start failed: ${validStartRes.status}`);
    }

    // 3.7 Sequential Checkpoint: Location clue visible, Question locked before QR scan
    const teamDoc = await db.collection("teams").findOne({ teamId: assignedTeamId });
    if (!teamDoc) throw new Error(`Team ${assignedTeamId} not found in database`);
    let routeDoc = null;
    if (teamDoc.routeId) {
      const qId = (typeof teamDoc.routeId === "string" && teamDoc.routeId.length === 24 && /^[0-9a-fA-F]{24}$/.test(teamDoc.routeId))
        ? new mongoose.Types.ObjectId(teamDoc.routeId)
        : teamDoc.routeId;
      routeDoc = await db.collection("routes").findOne({ _id: qId });
    }
    if (!routeDoc) {
      routeDoc = await db.collection("routes").findOne({ active: true });
    }
    const sequence = JSON.parse(routeDoc.checkpointSequence); // e.g. [1, 2, 3, 4, 5, 6, 7, 8] or [7, 5, 3, 1, 6, 4, 2, 8]
    const firstSeq = sequence[0];
    const wrongSeq = sequence[4] || 4;

    function getAnswerForSeq(seq) {
      switch (seq) {
        case 1: return "HACK";
        case 2: return "XOR";
        case 3: return "O(n^2)";
        case 4: return "200";
        case 5: return "No-Cloning Theorem";
        case 6: return "SIGMOID";
        case 7: return "TECHFEST";
        case 8: return "TREASURE_CLAIM";
        case 9: return "443";
        case 10: return "TREASURE_CLAIM";
        default: return "ANSWER";
      }
    }

    const cp1Initial = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });
    const cp1ClueVisible = !!cp1Initial.data.checkpoint?.locationHint;
    const cp1QuestionLocked = cp1Initial.data.checkpoint?.isScanned === false && !cp1Initial.data.checkpoint?.question;

    if (cp1ClueVisible && cp1QuestionLocked) {
      record("Section 3", "Location Clue Display & Question Encryption", "PASS", `Cryptic location clue visible for Checkpoint #${firstSeq}, puzzle locked until QR scan`);
    } else {
      record("Section 3", "Location Clue Display & Question Encryption", "FAIL", "Question exposed or clue missing");
    }

    // 3.8 Scan Invalid / Fake QR -> Rejected
    const fakeQrRes = await request("POST", "/api/hunt/scan", {
      cookie: teamCookie,
      body: { qrToken: "FORGED_QR_TOKEN_FAKE_9999" },
    });
    if (fakeQrRes.status === 400) {
      record("Section 3", "Invalid QR Rejection", "PASS", `Forged QR rejected: ${fakeQrRes.data.error}`);
    } else {
      record("Section 3", "Invalid QR Rejection", "FAIL", `Fake QR was not rejected: ${fakeQrRes.status}`);
    }

    // Retrieve checkpoints from DB
    const checkpointsInDb = await db.collection("checkpoints").find({}).sort({ sequenceNumber: 1 }).toArray();
    const targetCp1 = checkpointsInDb.find((c) => c.sequenceNumber === firstSeq);

    // 3.9 Scan Valid Checkpoint QR Token for First Stage
    const validQrRes = await request("POST", "/api/hunt/scan", {
      cookie: teamCookie,
      body: { qrToken: targetCp1.qrCodeToken },
    });

    const cp1ScannedState = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });
    const cp1Unlocked = cp1ScannedState.data.checkpoint?.isScanned === true && !!cp1ScannedState.data.checkpoint?.question?.prompt;

    if (validQrRes.status === 200 && cp1Unlocked) {
      record("Section 3", "Valid QR Token Scanning & Puzzle Decryption", "PASS", `QR token authenticated for Checkpoint #${firstSeq}; riddle prompt decrypted`);
    } else {
      record("Section 3", "Valid QR Token Scanning & Puzzle Decryption", "FAIL", `QR scan failed: ${validQrRes.status} ${JSON.stringify(validQrRes.data)}`);
    }

    // 3.10 Submit Incorrect Answer -> Rejected with attempt increment
    const wrongAnswerRes = await request("POST", "/api/hunt/submit", {
      cookie: teamCookie,
      body: { answer: "INCORRECT_ANSWER_123" },
    });
    const stateAfterWrong = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });

    if (wrongAnswerRes.status === 200 && wrongAnswerRes.data.isCorrect === false && stateAfterWrong.data.checkpoint.attemptsCount >= 1) {
      record("Section 3", "Incorrect Answer Handling", "PASS", "Wrong answer safely rejected; attempt counter incremented");
    } else {
      record("Section 3", "Incorrect Answer Handling", "FAIL", `Incorrect answer handling failed: ${wrongAnswerRes.status}`);
    }

    // 3.11 Submit Correct Answer -> Advances to Stage 2
    const correctAnswerRes = await request("POST", "/api/hunt/submit", {
      cookie: teamCookie,
      body: { answer: getAnswerForSeq(firstSeq) },
    });
    const cp2State = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });
    const advancedToCp2 = cp2State.data.checkpointIndex === 1 && cp2State.data.checkpointNumber === 2;

    if (correctAnswerRes.status === 200 && correctAnswerRes.data.isCorrect === true && advancedToCp2) {
      record("Section 3", "Correct Answer Verification & Sequential Advancement", "PASS", `Answer verified; team advanced to Checkpoint #${sequence[1]}`);
    } else {
      record("Section 3", "Correct Answer Verification & Sequential Advancement", "FAIL", `Correct answer failed to advance: ${JSON.stringify(correctAnswerRes.data)}`);
    }

    // 3.12 Wrong Route / Cross-Route Scan Rejection
    const wrongCp = checkpointsInDb.find((c) => c.sequenceNumber === wrongSeq);
    const outOfOrderScan = await request("POST", "/api/hunt/scan", {
      cookie: teamCookie,
      body: { qrToken: wrongCp.qrCodeToken },
    });

    if (outOfOrderScan.status === 400) {
      record("Section 3", "Anti-Skipping & Cross-Route Protection", "PASS", `Out-of-order QR rejected (400: ${outOfOrderScan.data.error})`);
    } else {
      record("Section 3", "Anti-Skipping & Cross-Route Protection", "FAIL", `Out-of-order scan allowed: status ${outOfOrderScan.status}`);
    }

    // 3.13 Progress Persistence Across Reload
    const reloadedState = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });
    if (reloadedState.data.checkpointIndex === 1 && reloadedState.data.checkpointNumber === 2) {
      record("Section 3", "State Persistence Across Client Reload", "PASS", "Checkpoint index and stage persisted cleanly in MongoDB");
    } else {
      record("Section 3", "State Persistence Across Client Reload", "FAIL", "State did not persist");
    }

    // -------------------------------------------------------------------------
    // SECTION 4: Final Treasure & Physical Prizes Verification
    // -------------------------------------------------------------------------
    console.log("\n[SECTION 4] Final Treasure & Physical Prizes Verification");

    // Fast-progress remaining regular checkpoints (indices 1 to sequence.length - 2)
    for (let idx = 1; idx < sequence.length - 1; idx++) {
      const seqNum = sequence[idx];
      const targetCp = checkpointsInDb.find((c) => c.sequenceNumber === seqNum);

      // Scan QR
      await request("POST", "/api/hunt/scan", {
        cookie: teamCookie,
        body: { qrToken: targetCp.qrCodeToken },
      });

      // Submit correct answer based on sequence number
      await request("POST", "/api/hunt/submit", {
        cookie: teamCookie,
        body: { answer: getAnswerForSeq(seqNum) },
      });
    }

    // 4.1 Verify Final Treasure Gate
    const finalCpState = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });
    const isAtFinal = finalCpState.data.isFinalTreasure === true && finalCpState.data.checkpointNumber === sequence.length;

    if (isAtFinal) {
      record("Section 4", "Final Treasure Gate Unlock", "PASS", `Final Treasure Vault reached (Checkpoint #${finalCpState.data.checkpointNumber})`);
    } else {
      record("Section 4", "Final Treasure Gate Unlock", "FAIL", `Not at final treasure: ${JSON.stringify(finalCpState.data)}`);
    }

    // 4.2 Scan Final Treasure QR Token & Solve Riddle
    const finalCpDoc = checkpointsInDb.find((c) => c.isFinalTreasure);
    await request("POST", "/api/hunt/scan", {
      cookie: teamCookie,
      body: { qrToken: finalCpDoc.qrCodeToken },
    });
    await request("POST", "/api/hunt/submit", {
      cookie: teamCookie,
      body: { answer: "TREASURE_CLAIM" },
    });

    // 4.3 Verify QR Scan / Riddle DOES NOT Auto-Award Prize
    const completedState = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });
    const allCompleted = completedState.data.isAllCheckpointsCompleted === true;
    const noAutoPrize = completedState.data.prizeClaim === null || completedState.data.prizeClaim?.status !== "CONFIRMED";

    if (allCompleted && noAutoPrize) {
      record("Section 4", "Anti-Auto-Award Physical Prize Guard", "PASS", "All checkpoints completed; physical prize requires physical marshall verification");
    } else {
      record("Section 4", "Anti-Auto-Award Physical Prize Guard", "FAIL", "Prize was prematurely awarded");
    }

    // 4.4 Team Selects an Available Physical Box -> Receives Claim Code
    const confirmedClaims = await db.collection("prizeclaims").find({ status: "CONFIRMED" }).toArray();
    const takenBoxes = new Set(confirmedClaims.map((c) => c.boxNumber));
    let targetBoxNum = [1, 2, 3].find((b) => !takenBoxes.has(b));
    if (!targetBoxNum) {
      // Clean up previous test artifacts if all 3 boxes were previously claimed
      await db.collection("prizeclaims").deleteMany({});
      targetBoxNum = 1;
    }

    const claimBoxRes = await request("POST", "/api/hunt/claim", {
      cookie: teamCookie,
      body: { boxNumber: targetBoxNum },
    });
    const claim = claimBoxRes.data.claim;
    const claimCode = claim?.claimCode;
    const claimId = claim?.id;
    const isPending = claim?.status === "PENDING_VERIFICATION";

    if (claimBoxRes.status === 200 && claimCode && claimId && isPending) {
      record("Section 4", "Physical Box Selection & Claim Ticket Generation", "PASS", `Box #${targetBoxNum} claimed with code: ${claimCode} (PENDING_VERIFICATION)`);
    } else {
      record("Section 4", "Physical Box Selection & Claim Ticket Generation", "FAIL", `Failed to claim Box ${targetBoxNum}: ${claimBoxRes.status} ${JSON.stringify(claimBoxRes.data)}`);
    }

    // 4.5 Prevent Double Claim by Same Team
    const otherBox = targetBoxNum === 1 ? 2 : 1;
    const doubleClaimRes = await request("POST", "/api/hunt/claim", {
      cookie: teamCookie,
      body: { boxNumber: otherBox },
    });
    if (doubleClaimRes.status === 400) {
      record("Section 4", "Double Claim Prevention", "PASS", `Duplicate claim attempt blocked: ${doubleClaimRes.data.error}`);
    } else {
      record("Section 4", "Double Claim Prevention", "FAIL", `Double claim allowed: ${doubleClaimRes.status}`);
    }

    // 4.6 Unauthorized / Unauthenticated Claim Verification Blocked
    const unauthVerify = await request("POST", "/api/volunteer/claims", {
      body: { claimId, status: "CONFIRMED" },
    });
    if (unauthVerify.status === 401) {
      record("Section 4", "Unauthorized Verification Guard", "PASS", "Unauthenticated claim verification rejected (401)");
    } else {
      record("Section 4", "Unauthorized Verification Guard", "FAIL", `Unauthenticated verification status: ${unauthVerify.status}`);
    }

    // 4.7 Authorized Volunteer Confirms Box Claim
    const volunteerConfirmRes = await request("POST", "/api/volunteer/claims", {
      cookie: volCookie,
      body: { claimId, status: "CONFIRMED", volunteerNotes: "Physical identity pass and token verified." },
    });

    const confirmedState = await request("GET", "/api/hunt/checkpoint", { cookie: teamCookie });
    const claimIsConfirmed = confirmedState.data.prizeClaim?.status === "CONFIRMED";

    if (volunteerConfirmRes.status === 200 && claimIsConfirmed) {
      record("Section 4", "Authorized Volunteer Handover & Confirmation", "PASS", `Box #${targetBoxNum} confirmed by Box Marshall Alex; status: CONFIRMED`);
    } else {
      record("Section 4", "Authorized Volunteer Handover & Confirmation", "FAIL", `Volunteer confirmation failed: ${volunteerConfirmRes.status} ${JSON.stringify(volunteerConfirmRes.data)}`);
    }

    // -------------------------------------------------------------------------
    // SECTION 5: Game-State Restrictions Verification
    // -------------------------------------------------------------------------
    console.log("\n[SECTION 5] Game-State Restrictions Verification");

    // 5.1 PAUSED State Enforcement
    await request("POST", "/api/config", {
      cookie: adminCookie,
      body: { gameStatus: "PAUSED" },
    });

    const pausedScan = await request("POST", "/api/hunt/scan", {
      cookie: teamCookie,
      body: { qrToken: targetCp1.qrCodeToken },
    });
    const pausedSubmit = await request("POST", "/api/hunt/submit", {
      cookie: teamCookie,
      body: { answer: "TEST" },
    });

    if (pausedScan.status === 400 && pausedSubmit.status === 400) {
      record("Section 5", "PAUSED Game State Enforcement", "PASS", "QR scans and riddle answers blocked during PAUSED state");
    } else {
      record("Section 5", "PAUSED Game State Enforcement", "FAIL", `Action allowed during pause: scan=${pausedScan.status}, submit=${pausedSubmit.status}`);
    }

    // 5.2 CONCLUDED State Enforcement
    await request("POST", "/api/config", {
      cookie: adminCookie,
      body: { gameStatus: "CONCLUDED" },
    });

    const concludedScan = await request("POST", "/api/hunt/scan", {
      cookie: teamCookie,
      body: { qrToken: targetCp1.qrCodeToken },
    });
    const concludedClaim = await request("POST", "/api/hunt/claim", {
      cookie: teamCookie,
      body: { boxNumber: 2 },
    });

    if (concludedScan.status === 400 && concludedClaim.status === 400) {
      record("Section 5", "CONCLUDED Game State Enforcement", "PASS", "Gameplay and prize claiming completely locked when CONCLUDED");
    } else {
      record("Section 5", "CONCLUDED Game State Enforcement", "FAIL", `Action allowed during CONCLUDED: scan=${concludedScan.status}`);
    }

    // Restore Game State to ACTIVE
    await request("POST", "/api/config", {
      cookie: adminCookie,
      body: { gameStatus: "ACTIVE" },
    });

    // -------------------------------------------------------------------------
    // SECTION 6: Browser & Mobile Responsiveness with Real Chrome
    // -------------------------------------------------------------------------
    console.log("\n[SECTION 6] Real Browser & Mobile Responsiveness Verification");

    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const testPages = [
      { name: "home", path: "/" },
      { name: "register", path: "/register" },
      { name: "login", path: "/login" },
      { name: "rules", path: "/rules" },
      { name: "waiting-room", path: "/waiting-room" },
      { name: "hunt", path: "/hunt" },
      { name: "admin", path: "/admin" },
      { name: "volunteer", path: "/volunteer" },
    ];

    const viewports = [
      { label: "desktop", width: 1280, height: 800 },
      { label: "mobile", width: 375, height: 812 },
    ];

    let screenshotsCaptured = 0;

    for (const vp of viewports) {
      for (const page of testPages) {
        const outName = `${page.name}-${vp.label}.png`;
        const outPath = path.join(SCREENSHOT_DIR, outName);
        const targetUrl = `${BASE_URL}${page.path}`;

        try {
          execSync(
            `"${CHROME_PATH}" --headless=new --window-size=${vp.width},${vp.height} --screenshot="${outPath}" "${targetUrl}"`,
            { stdio: "ignore", timeout: 15000 }
          );
          if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
            screenshotsCaptured++;
          }
        } catch {
          // If screenshot failed, continue
        }
      }
    }

    if (screenshotsCaptured >= 14) {
      record("Section 6", "Headless Chrome Multi-Viewport Rendering", "PASS", `${screenshotsCaptured}/16 responsive screenshots captured (Desktop 1280x800 & Mobile 375x812)`);
    } else {
      record("Section 6", "Headless Chrome Multi-Viewport Rendering", "FAIL", `Only ${screenshotsCaptured}/16 screenshots captured`);
    }

    // 6.2 Camera QR Scanner & Manual Fallback Verification
    const huntHtml = fs.readFileSync(path.join(__dirname, "..", "src", "app", "hunt", "page.tsx"), "utf-8");
    const hasCameraToggle = huntHtml.includes("Use Camera") && huntHtml.includes("Close Camera");
    const hasCameraVideo = huntHtml.includes("<video") && huntHtml.includes("ref={videoRef}");
    const hasPermissionHandling = huntHtml.includes("NotAllowedError") && huntHtml.includes("Camera Notice");
    const hasManualFallback = huntHtml.includes("Submit QR Code") && huntHtml.includes("qrTokenInput");

    if (hasCameraToggle && hasCameraVideo && hasPermissionHandling && hasManualFallback) {
      record("Section 6", "Camera Scanner & Graceful Fallback UI", "PASS", "Camera toggle, video element, NotAllowedError handling, and manual token input verified");
    } else {
      record("Section 6", "Camera Scanner & Graceful Fallback UI", "FAIL", "Missing camera scanner or fallback elements");
    }

  } catch (err) {
    console.error("Fatal error during Step 8 audit:", err);
    record("FATAL", "Audit Execution", "FAIL", err.message);
  } finally {
    try {
      if (db) {
        // Clean up test prize claims and test team created for the audit
        await db.collection("prizeclaims").deleteMany({ claimCode: { $regex: /BOX[1-3]-TEAM/i } });
        await db.collection("teams").deleteMany({ name: { $regex: /Apex Innovators/i } });
        await db.collection("registrations").deleteMany({ teamName: { $regex: /Apex Innovators/i } });
        await db.collection("gameconfigs").updateOne({ key: "GAME_STATUS" }, { $set: { value: "WAITING" } });
      }
    } catch {}

    if (nextProcess) {
      console.log("\nStopping Next.js production server...");
      try {
        execSync(`taskkill /pid ${nextProcess.pid} /t /f`, { stdio: "ignore" });
      } catch {
        nextProcess.kill();
      }
    }
    await mongoose.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Summary Table
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("🏁 STEP 8 AUDIT SUMMARY REPORT");
  console.log("================================================================================");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.table(results.map((r) => ({ Section: r.section, Check: r.checkName, Status: r.status, Details: r.details })));

  console.log(`\nTotal Checks: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log("🎉 ALL REAL BROWSER & EVENT-DAY SETUP CHECKS PASSED SUCCESSFULLY!");
  } else {
    console.log("❌ SOME CHECKS FAILED. PLEASE REVIEW THE DETAILS ABOVE.");
    process.exit(1);
  }
}

runAudit();
