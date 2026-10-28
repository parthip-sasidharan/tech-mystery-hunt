import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { hashPassword } from "@/server/auth";
import { CreateVolunteerSchema } from "@/server/validators/schemas";
import { connectToDatabase } from "@/server/db";
import { User, Checkpoint, AuditLog } from "@/server/models";

/**
 * GET /api/admin/volunteers
 * List all volunteer accounts. Admin only.
 */
export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    await connectToDatabase();
    const volunteers = await User.find({ role: "VOLUNTEER" })
      .sort({ createdAt: 1 })
      .select("username email name role active assignedCheckpointId createdAt")
      .lean();

    return NextResponse.json({
      volunteers: volunteers.map((v) => ({
        id: String(v._id),
        username: v.username,
        email: v.email,
        name: v.name,
        role: v.role,
        active: v.active,
        assignedCheckpointId: v.assignedCheckpointId,
        createdAt: v.createdAt,
      })),
    });

  } catch (err: unknown) {
    console.error("[ADMIN VOLUNTEERS GET]", err);
    return NextResponse.json({ error: "Failed to fetch volunteers." }, { status: 500 });
  }
}

/**
 * POST /api/admin/volunteers
 * Create a new volunteer account. Admin only.
 */
export async function POST(req: Request) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    await connectToDatabase();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const validated = CreateVolunteerSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid volunteer details." },
        { status: 400 }
      );
    }

    const { username, email, name, password, assignedCheckpointId } = validated.data;
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check for collisions
    const existing = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    }).lean();

    if (existing) {
      return NextResponse.json(
        { error: "A user with this username or email already exists." },
        { status: 409 }
      );
    }

    // Verify checkpoint if provided
    if (assignedCheckpointId) {
      const cp = await Checkpoint.findById(assignedCheckpointId).lean();
      if (!cp) {
        return NextResponse.json({ error: "Assigned checkpoint not found." }, { status: 404 });
      }
    }

    const passwordHash = await hashPassword(password);

    const volunteer = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      name: name.trim(),
      passwordHash,
      role: "VOLUNTEER",
      active: true,
      assignedCheckpointId: assignedCheckpointId ?? null,
    });

    await AuditLog.create({
      action: "VOLUNTEER_CREATED",
      actorRole: "ADMIN",
      actorId: session!.sub,
      details: JSON.stringify({ username: cleanUsername, email: cleanEmail }),
    });

    return NextResponse.json({
      success: true,
      message: `Volunteer account "${cleanUsername}" created.`,
      volunteer: {
        id: String(volunteer._id),
        username: volunteer.username,
        email: volunteer.email,
        name: volunteer.name,
        role: volunteer.role,
        active: volunteer.active,
        assignedCheckpointId: volunteer.assignedCheckpointId,
        createdAt: volunteer.createdAt,
      },
    });

  } catch (err: unknown) {
    console.error("[ADMIN VOLUNTEERS POST]", err);
    return NextResponse.json({ error: "Failed to create volunteer." }, { status: 500 });
  }
}
