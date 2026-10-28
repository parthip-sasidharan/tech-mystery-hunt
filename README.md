# Tech Mystery Hunt – The Missing Code

**TechFest College Mystery Hunt Game Platform**

An immersive, full-stack QR-code-based treasure hunt game engine built for college TechFest events. Registered student teams receive cryptic clues, navigate physical checkpoints across campus, scan real QR codes, solve technical riddles, and race to claim one of three physical treasure boxes verified by volunteer marshalls.

---

## 🛠 Technology Stack & Architectural Separation

- **Frontend**: Next.js 14 App Router, React 18, Tailwind CSS, Lucide Icons, Cyber Mystery Design System.
- **Backend**: Next.js API Routes, Server-side Zod validation schemas, Role-Based Access Control (`TEAM`, `ADMIN`, `VOLUNTEER`).
- **Database & Persistence**: **MongoDB Atlas / Local MongoDB with Mongoose ODM**. Fully migrated from SQLite/Prisma to MongoDB, with persistent documents, unique indexes, and atomic operations.
- **Security**:
  - Salting and cryptographic password hashing with **bcryptjs** (cost factor 12 for admin accounts, 10 for teams/volunteers).
  - Cryptographic answer hashing with bcrypt (answers never exposed in API payloads or client DOM).
  - Centralized server-side authorization guards (`requireAuth`, `requireRole`, `requireAdmin`, `requireVolunteerOrAdmin`, `requireTeamSelf`).
  - Secure HTTP-only cookies with signed JSON Web Tokens (JWT).
  - Anti-cheat route sequence validation (teams cannot jump ahead or scan checkpoints out of order).

---

## 📋 Database Models & System Architecture (MongoDB & Mongoose)

1. **Persistent Mongoose Models & Explicit Unique Indexes (`src/server/models/index.ts`)**:
   - `GameConfig`: Global toggles (`CHECKPOINT_COUNT`, `GAME_STATUS`, `REGISTRATION_OPEN`, `REGISTRATION_WORKFLOW`, `TOTAL_TREASURE_BOXES`, etc.).
   - `User`: Admin and Volunteer accounts (indexed on `role`, `active`, `username`, `email`). Volunteers can be assigned to specific physical checkpoints via `assignedCheckpointId`.
   - `TeamIdPool`: Concurrency-safe Team ID pool (`teamId`, `sequenceNumber`, `status`: `AVAILABLE` | `ASSIGNED` | `RESERVED` | `DISABLED`, `assignedTeamId`, `assignedTeamName`, `batchTag`). Indexed uniquely on `teamId` and `sequenceNumber`, with compound index `{ status: 1, sequenceNumber: 1 }`.
   - `Registration`: Captures team applications, leader/members payload, password hash, registration type (`ONLINE` vs `SPOT`), and approval status (`PENDING` | `APPROVED` | `REJECTED`).
   - `Team`: Active registered teams (indexed on `teamId`, `status`, `currentStage`, `routeId`, `leaderEmail`), with auto-generated collision-free ID (`TEAM001`, `TEAM002`, ...).
   - `Route`: Anti-crowding routes (`Route Alpha`, `Route Beta`, `Route Gamma`, `Route Delta`) with dynamic crowd load-balancing.
   - `Checkpoint`: 10 campus checkpoints with unique sequence numbers, area descriptions, location hints, and unique `qrCodeToken`.
   - `Question`: Puzzles with answers hashed on the server with bcrypt (never returned to client).
   - `TeamProgress`: Checkpoint validation, timestamps, and attempt counts (composite unique on `[teamId, checkpointId]`).
   - `TaskVerification`: Real-time volunteer task/presence confirmation and incident tracking at checkpoints.
   - `PrizeClaim`: One-time physical box verification claims for Boxes 1, 2, and 3, protected by partial unique indexes `{ boxNumber: 1, status: "CONFIRMED" }` and `{ teamId: 1, status: "CONFIRMED" }`.
   - `AuditLog`: Immutable action log with actor role, IP address, and masked secret payload strings.

2. **Automatic Team ID Generation & Pool Architecture (`src/server/services/teamIdService.ts`)**:
   - **Standardized Format**: Standardized `TEAM001`, `TEAM002`, `TEAM003`, ... `TEAM100`, `TEAM101`, `TEAM1500` format without any upper cap (100+ teams fully supported).
   - **Bulk Pre-Generation**: Admins can generate pools of sequential Team IDs in batches (e.g. 25, 50, 100, 500) tagged with custom event batch labels.
   - **Concurrency Safety**: High-concurrency atomic allocation via MongoDB `findOneAndUpdate({ status: "AVAILABLE" }, { $set: { status: "ASSIGNED", ... } }, { sort: { sequenceNumber: 1 }, returnDocument: "after" })`. Tested under parallel simulated load with zero duplicate IDs or race conditions.
   - **Pool Status Controls**: Admins can disable unassigned IDs to take them out of circulation or re-enable them. Already-assigned active IDs are protected from modification.

3. **Dual Registration Workflows & Spot Registration (`src/server/services/teamService.ts`)**:
   - **Admin Switchboard**: Event administrators can toggle `REGISTRATION_OPEN` (accepting signups or locked) and `REGISTRATION_WORKFLOW` (`AUTO_APPROVE` vs `MANUAL_APPROVAL`).
   - **`AUTO_APPROVE` Mode**: Online registrants automatically claim the next available sequential Team ID, receive balanced campus route assignment, and can immediately enter the waiting room.
   - **`MANUAL_APPROVAL` Mode**: Online registrants submit details into a pending queue. Team accounts are only created and activated when an organizer approves the registration in the Admin Console.
   - **Authorized On-Site Spot Registration**: Organizers at the venue help desk can register walk-in teams on the spot, assign routes, optionally specify custom Team IDs or custom passwords, and generate an immediate physical Credential Handover Pass.
   - **Confirmation Safeguards**: Disruptive actions (such as disqualifying a team or rejections) require explicit confirmation dialogs and record audit log entries.

4. **Automatic Route Assignment & Team Mission Flow (`src/server/services/checkpointService.ts` & `src/server/services/teamService.ts`)**:
   - **Dynamic Team Scaling**: Fully uncapped scaling supporting any team count (10, 50, 100, 150+ teams) without pre-declaring final team counts.
   - **Balanced Route Distribution**: Automated load balancing assigns incoming teams to the valid active route with the lowest assigned team count, with deterministic route ID tie-breaking.
   - **Route Sequence Verification**: Guarantees that every assigned route visits all active regular checkpoints exactly once without omissions or duplicates, and terminates at the shared final treasure vault.
   - **Team Waiting Room**: Real-time status display showing squad credentials, teammate roster, assigned route status, and event lifecycle state (`WAITING`, `ACTIVE`, `PAUSED`, `CONCLUDED`).
   - **Idempotent Mission Start**: The "I'm on Mission" button transitions teams to active hunt status (`IN_PROGRESS` / `HUNTING`) only when the game is `ACTIVE`. Repeated clicks or refreshes preserve start time, assigned route, and progress.
   - **Progressive Clue Reveal**: Teams on different routes receive distinct opening location coordinates to disperse crowds away from bottlenecks. Future clues and riddles remain strictly concealed until authentic QR validation.
   - **Anti-Cheat Sequential QR Validation**: Checkpoint QR tokens are strictly verified on the server against the team's route sequence. Jumping ahead, scanning other teams' checkpoints, or scanning out-of-order codes is rejected.
   - **Bcrypt Answer Verification**: Answers are validated strictly on the server against salted bcrypt hashes. Incorrect attempts are tracked, while correct solutions advance the team sequentially to the next route stage.
   - **Admin Route Controls**: Admin dashboard shows live team route assignments, flags unassigned or corrupted routes, provides a dry-run auto-assignment preview modal, and protects active teams by requiring an explicit emergency recovery reason and audit log entry before reassigning routes.

5. **QR Scanning Security, Final Treasure Verification & Prize Claim Security (`src/server/services/checkpointService.ts` & `src/server/services/prizeService.ts`)**:
   - **Physical Checkpoint QR Security**: Unique, unpredictable QR tokens for each checkpoint. QR scanning unlocks the stage puzzle without auto-completing. Forged, cross-route, and out-of-order scans are strictly rejected.
   - **Sliding-Window Rate Limiting**: In-memory rate limiting blocks brute-force scanning (max 12 attempts/min per team) and rapid riddle submissions (max 8 attempts/min per checkpoint per team), writing security audit log entries.
   - **Masked Security Logging**: In audit logs, attempted raw tokens are masked (e.g. `FO***99`) to prevent accidental token leakage.
   - **Final Treasure Verification Gate**: Shared final checkpoint QR code for all qualifying teams. Scannable only after solving all regular checkpoints (`currentCheckpointIndex >= regularCheckpointsCount`). Transitions the team to `TREASURE_SEARCH` without auto-awarding prizes.
   - **Protected Physical Vault Verification**: Exactly 3 physical boxes (Podium 1, 2, 3). Requires physical presentation at Dais Desk and verification by authorized Marshall or Admin. Volunteers assigned to regular checkpoints are blocked from vault verification.
   - **Atomic Conflict Prevention**: Enforced via MongoDB transactions and partial unique index `{ boxNumber: 1, status: "CONFIRMED" }` and `{ teamId: 1, status: "CONFIRMED" }` guaranteeing at most one confirmed winner per box and at most one prize per team.
   - **Release & Re-claim Workflow**: Marshalls can release pending claims with an audited reason (e.g. physical box selection mistake), immediately freeing the box and allowing the team to re-select an available box.
   - **Real-Time Podium Synchronization**: Live Box 1, 2, 3 status (`AVAILABLE`, `PENDING_VERIFICATION`, `CONFIRMED`), winner details, and an `allBoxesClaimed` banner across the Admin Dashboard and Box Marshall Portal.

6. **Full Event Simulation, Variable Scaling, Load Testing & Readiness Audit (`src/server/services/readinessService.ts` & `tests/`)**:
   - **End-to-End Event Lifecycle Simulation**: Exercises the entire event pipeline from Admin preparation, online/spot registration, approval, waiting room holds, mission starts, sequential QR scanning, answer verification, final vault unlock, physical prize claim verification, to event conclusion.
   - **Variable Team Scaling (10 to 300 Teams)**: Validated across 10, 50, 100, 150, and 300 team tiers. Verifies zero Team ID collisions, 100% route assignment coverage, balanced route distribution (load variance $\le 1$), and incremental registration leveling.
   - **High-Concurrency Activity Handling**: Evaluated under 50 parallel atomic allocations, concurrent route assignments, simultaneous mission starts, and concurrent prize claim conflicts (race condition for Box 1 atomically resolved with exactly 1 winner via MongoDB partial unique indexes and transaction aborts).
   - **Performance & Load Benchmarking**: Tested with 25, 50, and 100 concurrent virtual users exercising 5 critical API operations (Auth/bcrypt, Waiting Room, Mission Start, QR Validation, and Riddle Answer). Achieved 100% success rate with throughput up to 155.5 requests/sec and sub-135ms median latencies.
   - **MongoDB Reliability & Security Verification**: Verified connection failure resilience, database unique index integrity across 4 collections, transaction support (`ENABLED`), idempotent initialization, and complete absence of hardcoded production credentials or SQLite fallbacks.
   - **Admin Event Launch Readiness Audit**: Integrated automated pre-flight checks evaluating checkpoints, attached question riddles, route sequence validity, team assignments, and staff availability. Blocks event start if structural blockers exist.

---

## 🚀 Running the Application Locally

### 1. Prerequisites
- **Node.js**: v18.17+ (Tested on Node.js v24.14.0)
- **npm**: v9+
- **MongoDB**: v6.0+ (Tested on MongoDB 8.0.13)

### 2. Environment Setup
The project comes pre-configured with a `.env` file for local development.

| Variable | Description | Default Value |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas / Local MongoDB connection string | `"mongodb://127.0.0.1:27017/tech_mystery_hunt"` |
| `JWT_SECRET` | Secret key for signing authentication tokens | (Random string) |
| `DEFAULT_CHECKPOINT_COUNT` | Checkpoint count (8 or 10) | `"8"` |
| `TOTAL_TREASURE_BOXES` | Number of physical treasure boxes | `"3"` |
| `HINT_THRESHOLD` | Wrong attempts before emergency hint unlocks | `"2"` |
| `NODE_ENV` | Environment mode | `"development"` |

### 3. Database Synchronization & Seed
```powershell
# Seed MongoDB with default game settings, checkpoints, routes, dev accounts, and unique indexes
npm run db:seed
```

### 4. Running Automated Tests
```powershell
# Run the complete test suite (all 9 test suites, 309 assertions)
npm test

# Run individual targeted test suites
npm run test:auth         # Authentication & RBAC access control
npm run test:registration # Team registration, Team ID pool, spot registrations
npm run test:admin        # Admin dashboard controls & route validation
npm run test:mission      # Team mission flow & route assignment balancing
npm run test:prize        # QR security, final treasure & prize claim security
npm run test:sim          # End-to-end full event lifecycle simulation
npm run test:scale        # Variable team scaling (10 to 300) & concurrency tests
npm run test:mongo        # MongoDB reliability, unique indexes & security audit
npm run test:load         # Repeatable load test benchmark (25, 50, 100 concurrent VUs)
```

### 5. Build for Production
```powershell
npm run build
```

### 6. Start Development Server
```powershell
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Default Credentials for Development & Testing

| Role | Username / Identifier | Password | Access / Redirect |
|---|---|---|---|
| **Admin** | `admin` | `Admin#TechHunt2026` | `/admin` |
| **Volunteer** | `volunteer1` | `Volunteer#TechHunt2026` | `/volunteer` |
| **Team** | Register on `/register` or use your assigned Team ID | (Created during registration) | `/waiting-room` & `/hunt` |
