import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { connectToDatabase } from "@/server/db";
import { User, Checkpoint, AuditLog } from "@/server/models";
import { hashPassword } from "@/server/auth";
import { UpdateVolunteerSchema } from "@/server/validators/schemas";

/**
 * PATCH /api/admin/volunteers/[id]
 * Updates volunteer details, status, or assigned checkpoint.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    await connectToDatabase();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const validated = UpdateVolunteerSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid update data." },
        { status: 400 }
      );
    }

    const volunteer = await User.findById(params.id);
    if (!volunteer || volunteer.role !== "VOLUNTEER") {
      return NextResponse.json({ error: "Volunteer account not found." }, { status: 404 });
    }

    const { name, email, active, assignedCheckpointId, newPassword } = validated.data;

    if (name !== undefined) volunteer.name = name.trim();
    if (email !== undefined) {
      const cleanEmail = email.trim().toLowerCase();
      const collision = await User.findOne({ email: cleanEmail, _id: { $ne: volunteer._id } });
      if (collision) {
        return NextResponse.json({ error: "This email address is already in use." }, { status: 409 });
      }
      volunteer.email = cleanEmail;
    }

    if (assignedCheckpointId !== undefined) {
      if (assignedCheckpointId) {
        const cp = await Checkpoint.findById(assignedCheckpointId);
        if (!cp) {
          return NextResponse.json({ error: "Assigned checkpoint not found." }, { status: 404 });
        }
      }
      volunteer.assignedCheckpointId = assignedCheckpointId;
    }

    if (active !== undefined) volunteer.active = active;

    if (newPassword && newPassword.length >= 8) {
      volunteer.passwordHash = await hashPassword(newPassword);
    }

    await volunteer.save();

    await AuditLog.create({
      action: "VOLUNTEER_UPDATED",
      actorRole: "ADMIN",
      actorId: session!.sub,
      details: JSON.stringify({
        volunteerId: params.id,
        username: volunteer.username,
        active: volunteer.active,
        assignedCheckpointId: volunteer.assignedCheckpointId,
      }),
    });

    return NextResponse.json({
      success: true,
      message: `Volunteer "${volunteer.username}" updated successfully.`,
      volunteer: {
        id: String(volunteer._id),
        username: volunteer.username,
        email: volunteer.email,
        name: volunteer.name,
        role: volunteer.role,
        active: volunteer.active,
        assignedCheckpointId: volunteer.assignedCheckpointId,
      },
    });
  } catch (err: unknown) {
    console.error("[ADMIN VOLUNTEER PATCH]", err);
    return NextResponse.json({ error: "Failed to update volunteer." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/volunteers/[id]
 * Deletes or deactivates a volunteer account.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    await connectToDatabase();

    const volunteer = await User.findById(params.id);
    if (!volunteer || volunteer.role !== "VOLUNTEER") {
      return NextResponse.json({ error: "Volunteer account not found." }, { status: 404 });
    }

    const username = volunteer.username;
    await User.findByIdAndDelete(params.id);

    await AuditLog.create({
      action: "VOLUNTEER_DELETED",
      actorRole: "ADMIN",
      actorId: session!.sub,
      details: JSON.stringify({ volunteerId: params.id, username }),
    });

    return NextResponse.json({
      success: true,
      message: `Volunteer account "${username}" removed.`,
    });
  } catch (err: unknown) {
    console.error("[ADMIN VOLUNTEER DELETE]", err);
    return NextResponse.json({ error: "Failed to delete volunteer." }, { status: 500 });
  }
}
