import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { rejectPendingRegistration } from "@/server/services/teamService";
import { RejectRegistrationSchema } from "@/server/validators/schemas";

/**
 * POST /api/admin/registrations/[id]/reject
 * Rejects a pending team registration with an optional reason note.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let rejectionNote: string | undefined;
    try {
      const body = await req.json();
      const validated = RejectRegistrationSchema.safeParse(body);
      if (validated.success) {
        rejectionNote = validated.data.rejectionNote;
      }
    } catch {
      // Body is optional
    }

    const result = await rejectPendingRegistration(
      params.id,
      session!.sub,
      rejectionNote
    );

    return NextResponse.json({
      ...result,
      message: `Registration for "${result.teamName}" has been rejected.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reject registration.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
