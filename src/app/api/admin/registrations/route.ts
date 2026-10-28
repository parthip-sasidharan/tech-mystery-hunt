import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { listRegistrations, createSpotRegistration } from "@/server/services/teamService";
import { SpotRegistrationSchema } from "@/server/validators/schemas";

/**
 * GET /api/admin/registrations
 * Returns registrations filtered by status (PENDING, APPROVED, REJECTED, ALL).
 */
export async function GET(req: Request) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";

    const registrations = await listRegistrations(status);
    return NextResponse.json({ registrations });
  } catch (err: unknown) {
    console.error("[ADMIN REGISTRATIONS GET]", err);
    return NextResponse.json({ error: "Failed to list registrations." }, { status: 500 });
  }
}

/**
 * POST /api/admin/registrations
 * Creates an authorized on-site / spot registration.
 */
export async function POST(req: Request) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const validated = SpotRegistrationSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid registration data." },
        { status: 400 }
      );
    }

    const result = await createSpotRegistration(validated.data, session!.sub);

    return NextResponse.json({
      ...result,
      message: `Spot registration successful for team ${result.teamName} with ID ${result.teamId}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Spot registration failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
