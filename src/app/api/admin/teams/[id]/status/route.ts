import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { updateTeamStatus } from "@/server/services/teamService";
import { UpdateTeamStatusSchema } from "@/server/validators/schemas";

/**
 * PATCH /api/admin/teams/[id]/status
 * Updates team operational status (e.g. WAITING, IN_PROGRESS, COMPLETED, DISQUALIFIED).
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const validated = UpdateTeamStatusSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid status payload." },
        { status: 400 }
      );
    }

    const { status, reason } = validated.data;
    const result = await updateTeamStatus(params.id, status, session!.sub, reason);

    return NextResponse.json({
      ...result,
      message: `Team status updated to ${status}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update team status.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
