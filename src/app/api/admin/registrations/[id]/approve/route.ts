import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { approvePendingRegistration } from "@/server/services/teamService";
import { ApproveRegistrationSchema } from "@/server/validators/schemas";

/**
 * POST /api/admin/registrations/[id]/approve
 * Approves a pending team registration and allocates a Team ID.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let specificTeamId: string | undefined;
    try {
      const body = await req.json();
      const validated = ApproveRegistrationSchema.safeParse(body);
      if (validated.success) {
        specificTeamId = validated.data.specificTeamId;
      }
    } catch {
      // Body is optional if no specificTeamId is provided
    }

    const result = await approvePendingRegistration(
      params.id,
      session!.sub,
      specificTeamId
    );

    return NextResponse.json({
      ...result,
      message: `Team "${result.teamName}" approved and assigned ${result.teamId}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to approve registration.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
