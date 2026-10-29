import mongoose, { Schema, Model, Document } from "mongoose";

// ── 1. GameConfig Model ───────────────────────────────────────────────────────
export interface IGameConfig extends Document {
  key: string;
  value: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GameConfigSchema = new Schema<IGameConfig>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    value: { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

export const GameConfig: Model<IGameConfig> =
  mongoose.models.GameConfig || mongoose.model<IGameConfig>("GameConfig", GameConfigSchema);


// ── 2. User Model (Admin & Volunteer) ─────────────────────────────────────────
export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  name: string;
  role: "ADMIN" | "VOLUNTEER";
  active: boolean;
  assignedCheckpointId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["ADMIN", "VOLUNTEER"], default: "VOLUNTEER", index: true },
    active: { type: Boolean, default: true, index: true },
    assignedCheckpointId: { type: String, default: null },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);


// ── 3. Registration Model ─────────────────────────────────────────────────────
export interface IRegistration extends Document {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  membersJson: string;
  passwordHash: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  registrationType: "ONLINE" | "SPOT";
  allocatedTeamId?: string | null; // e.g. "TEAM001"
  rejectionNote?: string | null;
  approvedTeamId?: string | null; // Object ID of created Team
  approvedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationSchema = new Schema<IRegistration>(
  {
    teamName: { type: String, required: true, unique: true, trim: true },
    leaderName: { type: String, required: true, trim: true },
    leaderEmail: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    leaderPhone: { type: String, required: true, trim: true },
    membersJson: { type: String, required: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING", index: true },
    registrationType: { type: String, enum: ["ONLINE", "SPOT"], default: "ONLINE", index: true },
    allocatedTeamId: { type: String, default: null, index: true },
    rejectionNote: { type: String, default: null },
    approvedTeamId: { type: String, default: null, sparse: true },
    approvedBy: { type: String, default: null },
  },
  { timestamps: true }
);

export const Registration: Model<IRegistration> =
  mongoose.models.Registration || mongoose.model<IRegistration>("Registration", RegistrationSchema);


// ── 3B. TeamIdPool Model ──────────────────────────────────────────────────────
export interface ITeamIdPool extends Document {
  teamId: string; // e.g. "TEAM001", "TEAM002", etc.
  sequenceNumber: number; // 1, 2, 3...
  status: "AVAILABLE" | "ASSIGNED" | "RESERVED" | "DISABLED";
  assignedTeamId?: string | null; // ObjectId string of Team
  assignedTeamName?: string | null;
  assignedAt?: Date | null;
  batchTag?: string | null; // e.g. "INITIAL_PRE_GEN", "ADMIN_BATCH_2026"
  createdAt: Date;
  updatedAt: Date;
}

const TeamIdPoolSchema = new Schema<ITeamIdPool>(
  {
    teamId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    sequenceNumber: { type: Number, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["AVAILABLE", "ASSIGNED", "RESERVED", "DISABLED"],
      default: "AVAILABLE",
      index: true,
    },
    assignedTeamId: { type: String, default: null, index: true },
    assignedTeamName: { type: String, default: null },
    assignedAt: { type: Date, default: null },
    batchTag: { type: String, default: "AUTO" },
  },
  { timestamps: true }
);

// Compound index for optimal concurrency allocation
TeamIdPoolSchema.index({ status: 1, sequenceNumber: 1 });

export const TeamIdPool: Model<ITeamIdPool> =
  mongoose.models.TeamIdPool || mongoose.model<ITeamIdPool>("TeamIdPool", TeamIdPoolSchema);


// ── 4. Team Model ─────────────────────────────────────────────────────────────
export interface ITeam extends Document {
  teamId: string;
  name: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  members: string;
  passwordHash: string;
  routeId?: string | null;
  status: "REGISTERED" | "WAITING" | "IN_PROGRESS" | "COMPLETED" | "DISQUALIFIED";
  currentCheckpointIndex: number;
  currentStage: "WAITING_ROOM" | "HUNTING" | "TREASURE_SEARCH" | "FINISHED";
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    teamId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    leaderName: { type: String, required: true, trim: true },
    leaderEmail: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    leaderPhone: { type: String, required: true, trim: true },
    members: { type: String, required: true },
    passwordHash: { type: String, required: true },
    routeId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ["REGISTERED", "WAITING", "IN_PROGRESS", "COMPLETED", "DISQUALIFIED"],
      default: "WAITING",
      index: true,
    },
    currentCheckpointIndex: { type: Number, default: 0 },
    currentStage: {
      type: String,
      enum: ["WAITING_ROOM", "HUNTING", "TREASURE_SEARCH", "FINISHED"],
      default: "WAITING_ROOM",
      index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Team: Model<ITeam> =
  mongoose.models.Team || mongoose.model<ITeam>("Team", TeamSchema);


// ── 5. Route Model ────────────────────────────────────────────────────────────
export interface IRoute extends Document {
  name: string;
  description?: string | null;
  checkpointSequence: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RouteSchema = new Schema<IRoute>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    checkpointSequence: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Route: Model<IRoute> =
  mongoose.models.Route || mongoose.model<IRoute>("Route", RouteSchema);


// ── 6. Checkpoint Model ───────────────────────────────────────────────────────
export interface ICheckpoint extends Document {
  sequenceNumber: number;
  name: string;
  locationHint: string;
  campusArea: string;
  qrCodeToken: string;
  isFinalTreasure: boolean;
  treasureBoxNumber?: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CheckpointSchema = new Schema<ICheckpoint>(
  {
    _id: { type: Schema.Types.Mixed },
    sequenceNumber: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    locationHint: { type: String, required: true },
    campusArea: { type: String, required: true },
    qrCodeToken: { type: String, required: true, unique: true, index: true },
    isFinalTreasure: { type: Boolean, default: false, index: true },
    treasureBoxNumber: { type: Number, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Checkpoint: Model<ICheckpoint> =
  mongoose.models.Checkpoint || mongoose.model<ICheckpoint>("Checkpoint", CheckpointSchema);


// ── 7. Question Model ─────────────────────────────────────────────────────────
export interface IQuestion extends Document {
  checkpointId: string;
  prompt: string;
  type: string;
  options?: string | null;
  correctAnswerHash: string;
  points: number;
  hint?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    _id: { type: Schema.Types.Mixed },
    checkpointId: { type: String, required: true, index: true },
    prompt: { type: String, required: true },
    type: { type: String, default: "MULTIPLE_CHOICE" },
    options: { type: String, default: null },
    correctAnswerHash: { type: String, required: true },
    points: { type: Number, default: 100 },
    hint: { type: String, default: null },
  },
  { timestamps: true }
);

export const Question: Model<IQuestion> =
  mongoose.models.Question || mongoose.model<IQuestion>("Question", QuestionSchema);


// ── 8. TeamProgress Model ─────────────────────────────────────────────────────
export interface ITeamProgress extends Document {
  teamId: string;
  checkpointId: string;
  scannedAt?: Date | null;
  qrValidated: boolean;
  answerSubmitted?: string | null;
  isAnswerCorrect: boolean;
  attemptsCount: number;
  completedAt?: Date | null;
  penaltyTaskAssigned?: string | null;
  penaltyTaskStatus?: "NONE" | "PENDING_VERIFICATION" | "APPROVED" | null;
  penaltyApprovedAt?: Date | null;
  penaltyApprovedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TeamProgressSchema = new Schema<ITeamProgress>(
  {
    teamId: { type: String, required: true, index: true },
    checkpointId: { type: String, required: true, index: true },
    scannedAt: { type: Date, default: null },
    qrValidated: { type: Boolean, default: false },
    answerSubmitted: { type: String, default: null },
    isAnswerCorrect: { type: Boolean, default: false, index: true },
    attemptsCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    penaltyTaskAssigned: { type: String, default: null },
    penaltyTaskStatus: {
      type: String,
      enum: ["NONE", "PENDING_VERIFICATION", "APPROVED"],
      default: "NONE",
      index: true,
    },
    penaltyApprovedAt: { type: Date, default: null },
    penaltyApprovedBy: { type: String, default: null },
  },
  { timestamps: true }
);

TeamProgressSchema.index({ teamId: 1, checkpointId: 1 }, { unique: true });

export const TeamProgress: Model<ITeamProgress> =
  mongoose.models.TeamProgress || mongoose.model<ITeamProgress>("TeamProgress", TeamProgressSchema);


// ── 9. TaskVerification Model ─────────────────────────────────────────────────
export interface ITaskVerification extends Document {
  checkpointId: string;
  volunteerId: string;
  teamId: string;
  action: string;
  notes?: string | null;
  verifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskVerificationSchema = new Schema<ITaskVerification>(
  {
    checkpointId: { type: String, required: true, index: true },
    volunteerId: { type: String, required: true, index: true },
    teamId: { type: String, required: true, index: true },
    action: { type: String, required: true },
    notes: { type: String, default: null },
    verifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const TaskVerification: Model<ITaskVerification> =
  mongoose.models.TaskVerification || mongoose.model<ITaskVerification>("TaskVerification", TaskVerificationSchema);


// ── 10. PrizeClaim Model ──────────────────────────────────────────────────────
export interface IPrizeClaim extends Document {
  teamId: string;
  boxNumber: number;
  claimCode: string;
  status: "PENDING_VERIFICATION" | "CONFIRMED" | "REJECTED";
  claimedAt: Date;
  volunteerId?: string | null;
  volunteerNotes?: string | null;
  releaseReason?: string | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PrizeClaimSchema = new Schema<IPrizeClaim>(
  {
    teamId: { type: String, required: true, index: true },
    boxNumber: { type: Number, required: true, enum: [1, 2, 3] },
    claimCode: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["PENDING_VERIFICATION", "CONFIRMED", "REJECTED"],
      default: "PENDING_VERIFICATION",
      index: true,
    },
    claimedAt: { type: Date, default: Date.now },
    volunteerId: { type: String, default: null, index: true },
    volunteerNotes: { type: String, default: null },
    releaseReason: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Concurrency-safe atomic uniqueness: At most ONE team can ever hold CONFIRMED status for any given boxNumber
PrizeClaimSchema.index(
  { boxNumber: 1 },
  { unique: true, partialFilterExpression: { status: "CONFIRMED" } }
);

// Single winning box per team: A team can hold at most ONE CONFIRMED prize box
PrizeClaimSchema.index(
  { teamId: 1 },
  { unique: true, partialFilterExpression: { status: "CONFIRMED" } }
);

export const PrizeClaim: Model<IPrizeClaim> =
  mongoose.models.PrizeClaim || mongoose.model<IPrizeClaim>("PrizeClaim", PrizeClaimSchema);


// ── 11. AuditLog Model ────────────────────────────────────────────────────────
export interface IAuditLog extends Document {
  action: string;
  actorRole: string;
  actorId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    actorRole: { type: String, required: true, index: true },
    actorId: { type: String, default: null, index: true },
    details: { type: String, default: null },
    ipAddress: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
