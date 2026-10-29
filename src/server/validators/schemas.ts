import { z } from "zod";

// ── Shared primitives ──────────────────────────────────────────────────────────
const trimmedString = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

// ── Team Registration ──────────────────────────────────────────────────────────
export const TeamMemberSchema = z.object({
  name:      trimmedString(2, 80, "Member name"),
  collegeId: trimmedString(2, 30, "College/Roll ID"),
  phone:     z.string().trim().max(15).optional(),
});

export const RegisterTeamSchema = z.object({
  teamName:    trimmedString(3, 40, "Team name"),
  leaderName:  trimmedString(2, 80, "Leader name"),
  leaderEmail: z.string().trim().email("Invalid email address").max(120),
  leaderPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Phone number must be 10-15 digits (no spaces)"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be at most 72 characters"),   // bcrypt hard limit
  members: z
    .array(TeamMemberSchema)
    .min(1, "At least 1 additional team member is required")
    .max(4, "Maximum 4 additional members allowed"),
});

// ── Login (unified for all roles, supports direct Team ID activation) ──────────
export const LoginSchema = z.object({
  identifier: trimmedString(2, 120, "Identifier"),  // username / email / teamId
  password:   z.string().min(1, "Password is required").max(128),
  teamName:   z.string().trim().max(80).optional(),
  leaderName: z.string().trim().max(80).optional(),
});

// ── QR Code Scanning ──────────────────────────────────────────────────────────
export const QrScanSchema = z.object({
  qrToken: z.string().trim().min(3, "QR code token is required").max(200),
});

// ── Answer Submission ──────────────────────────────────────────────────────────
export const SubmitAnswerSchema = z.object({
  answer: z.string().min(1, "Answer cannot be empty").max(500, "Answer is too long"),
});

// ── Prize Claim ────────────────────────────────────────────────────────────────
export const PrizeClaimSchema = z.object({
  boxNumber: z.number().int().min(1).max(3),
});

// ── Game Configuration (Admin) ─────────────────────────────────────────────────
export const GameConfigSchema = z.object({
  checkpointCount:      z.union([z.string().regex(/^\d+$/), z.number().int().min(2).max(50)]).optional(),
  gameStatus:           z.enum(["WAITING", "ACTIVE", "PAUSED", "CONCLUDED"]).optional(),
  registrationOpen:     z.boolean().optional(),
  registrationWorkflow: z.enum(["AUTO_APPROVE", "MANUAL_APPROVAL"]).optional(),
  hintThreshold:        z.number().int().min(1).max(10).optional(),
  whatsappHelpline:     z.string().trim().optional(),
});

// ── Bulk Team ID Generation ───────────────────────────────────────────────────
export const BulkGenerateTeamIdsSchema = z.object({
  count:    z.number().int().min(1, "Must generate at least 1 ID").max(500, "Maximum 500 per batch"),
  batchTag: z.string().trim().max(50).optional(),
});

// ── Toggle Team ID Status ─────────────────────────────────────────────────────
export const ToggleTeamIdStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "DISABLED", "RESERVED"]),
});

// ── Spot Registration ─────────────────────────────────────────────────────────
export const SpotRegistrationSchema = z.object({
  teamName:       trimmedString(3, 40, "Team name"),
  leaderName:     trimmedString(2, 80, "Leader name"),
  leaderEmail:    z.string().trim().email("Invalid email address").max(120),
  leaderPhone:    z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
  password:       z.string().min(6).max(72).optional(),
  specificTeamId: z.string().trim().regex(/^TEAM\d+$/i, "Specific Team ID must follow TEAM### format").optional(),
  routeId:        z.string().trim().optional(),
  members:        z.array(TeamMemberSchema).min(1, "At least 1 teammate required").max(4, "Max 4 teammates"),
});

// ── Approve Pending Registration ──────────────────────────────────────────────
export const ApproveRegistrationSchema = z.object({
  specificTeamId: z.string().trim().regex(/^TEAM\d+$/i, "Specific Team ID must follow TEAM### format").optional(),
});

// ── Reject Pending Registration ───────────────────────────────────────────────
export const RejectRegistrationSchema = z.object({
  rejectionNote: z.string().trim().max(300).optional(),
});

// ── Update Team Status (Admin) ────────────────────────────────────────────────
export const UpdateTeamStatusSchema = z.object({
  status: z.enum(["REGISTERED", "WAITING", "IN_PROGRESS", "COMPLETED", "DISQUALIFIED"]),
  reason: z.string().trim().max(300).optional(),
});

// ── Volunteer Prize Verification ───────────────────────────────────────────────
export const VolunteerVerifySchema = z.object({
  claimId:        z.string().trim().min(1, "Claim ID is required").max(40),
  status:         z.enum(["CONFIRMED", "REJECTED"]),
  volunteerNotes: z.string().trim().max(500).optional(),
});

// ── Volunteer Task Verification ────────────────────────────────────────────────
export const TaskVerificationSchema = z.object({
  checkpointId: z.string().trim().min(1, "Checkpoint ID is required").max(40),
  teamId:       z.string().trim().min(1, "Team ID is required").max(40),
  action:       z.enum([
    "PRESENCE_CONFIRMED",
    "RULE_VIOLATION",
    "CHECKPOINT_STAFFED",
    "EMERGENCY_BYPASS",
    "APPROVE_PENALTY_TASK",
  ]),
  notes: z.string().trim().max(500).optional(),
});

// ── Admin User Management ─────────────────────────────────────────────────────
export const CreateVolunteerSchema = z.object({
  username:            trimmedString(3, 40, "Username"),
  email:               z.string().trim().email("Invalid email").max(120),
  name:                trimmedString(2, 80, "Full name"),
  password:            z.string().min(8, "Volunteer password must be at least 8 characters").max(72),
  assignedCheckpointId: z.string().trim().max(40).optional(),
});

// ── Checkpoint & Question Management (Admin) ──────────────────────────────────
export const CreateCheckpointSchema = z.object({
  name:              trimmedString(2, 80, "Checkpoint name"),
  campusArea:        trimmedString(1, 120, "Campus area").optional(),
  locationHint:      trimmedString(2, 2000, "Location hint / Clue"),
  isFinalTreasure:   z.boolean().optional().default(false),
  treasureBoxNumber: z.number().int().min(1).max(3).optional().nullable(),
  penaltyTask:       z.string().trim().max(1000).optional().nullable(),
  question: z.object({
    prompt:         trimmedString(4, 2000, "Question prompt"),
    type:           z.enum(["MULTIPLE_CHOICE", "NUMERIC", "TEXT", "CODE_CIPHER", "TEXT_CODE", "BOX_SELECTION"]).default("MULTIPLE_CHOICE"),
    options:        z.array(z.string().trim().min(1)).optional().nullable(),
    acceptedAnswer: trimmedString(1, 500, "Accepted answer"),
    points:         z.number().int().min(0).max(500).optional().default(100),
    hint:           z.string().trim().max(500).optional().nullable(),
  }),
});

export const UpdateCheckpointSchema = z.object({
  name:              trimmedString(2, 80, "Checkpoint name").optional(),
  campusArea:        trimmedString(1, 120, "Campus area").optional(),
  locationHint:      trimmedString(2, 2000, "Location hint / Clue").optional(),
  isFinalTreasure:   z.boolean().optional(),
  treasureBoxNumber: z.number().int().min(1).max(3).optional().nullable(),
  active:            z.boolean().optional(),
  penaltyTask:       z.string().trim().max(1000).optional().nullable(),
  question: z.object({
    prompt:         trimmedString(4, 2000, "Question prompt").optional(),
    type:           z.enum(["MULTIPLE_CHOICE", "NUMERIC", "TEXT", "CODE_CIPHER", "TEXT_CODE", "BOX_SELECTION"]).optional(),
    options:        z.array(z.string().trim().min(1)).optional().nullable(),
    acceptedAnswer: z.string().trim().min(1).max(500).optional(),
    points:         z.number().int().min(0).max(500).optional(),
    hint:           z.string().trim().max(500).optional().nullable(),
  }).optional(),
});

export const ReorderCheckpointsSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(2, "At least 2 checkpoints required to reorder"),
});

// ── Route Management (Admin) ──────────────────────────────────────────────────
export const CreateRouteSchema = z.object({
  name:               trimmedString(2, 50, "Route name"),
  description:        z.string().trim().max(250).optional(),
  checkpointSequence: z.array(z.number().int().positive()).min(2, "Sequence must contain at least 2 checkpoints"),
  active:             z.boolean().optional().default(true),
});

export const UpdateRouteSchema = z.object({
  name:               trimmedString(2, 50, "Route name").optional(),
  description:        z.string().trim().max(250).optional(),
  checkpointSequence: z.array(z.number().int().positive()).min(2).optional(),
  active:             z.boolean().optional(),
});

// ── Volunteer Account Update (Admin) ──────────────────────────────────────────
export const UpdateVolunteerSchema = z.object({
  name:                 trimmedString(2, 80, "Full name").optional(),
  email:                z.string().trim().email("Invalid email").max(120).optional(),
  active:               z.boolean().optional(),
  assignedCheckpointId: z.string().trim().max(40).optional().nullable(),
  newPassword:          z.string().min(8).max(72).optional(),
});
