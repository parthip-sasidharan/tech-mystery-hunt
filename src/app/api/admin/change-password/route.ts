import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { connectToDatabase } from "@/server/db";
import { User, AuditLog } from "@/server/models";
import { comparePassword, hashPassword } from "@/server/auth";
import { z } from "zod";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(10, "New password must be at least 10 characters long")
    .max(100, "Password is too long")
    .refine(
      (p) => p !== "Admin#TechHunt2026",
      "New password cannot be the default seeded administrator password."
    ),
});

export async function POST(req: Request) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    await connectToDatabase();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const validated = ChangePasswordSchema.safeParse(body);
    if (!validated.success) {
      const message = validated.error.errors[0]?.message || "Validation error.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const admin = await User.findById(session!.sub);
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator account not found." }, { status: 404 });
    }

    const isMatch = await comparePassword(validated.data.currentPassword, admin.passwordHash);
    if (!isMatch) {
      await AuditLog.create({
        action: "ADMIN_PASSWORD_CHANGE_FAILED",
        actorRole: "ADMIN",
        actorId: String(admin._id),
        details: JSON.stringify({ reason: "invalid_current_password" }),
      });
      return NextResponse.json(
        { error: "Incorrect current password. Password change rejected." },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(validated.data.newPassword);
    admin.passwordHash = newHash;
    admin.updatedAt = new Date();
    await admin.save();

    await AuditLog.create({
      action: "ADMIN_PASSWORD_CHANGED",
      actorRole: "ADMIN",
      actorId: String(admin._id),
      details: JSON.stringify({ username: admin.username, timestamp: new Date() }),
    });

    return NextResponse.json({
      success: true,
      message: "Administrator password updated successfully.",
    });
  } catch (err: unknown) {
    console.error("[ADMIN CHANGE PASSWORD]", err);
    return NextResponse.json(
      { error: "Failed to update administrator password." },
      { status: 500 }
    );
  }
}
