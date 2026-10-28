import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { reorderCheckpoints } from "@/server/services/checkpointAdminService";
import { ReorderCheckpointsSchema } from "@/server/validators/schemas";

/**
 * POST /api/admin/checkpoints/reorder
 * Reorders checkpoint sequence numbers before event launch.
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

    const validated = ReorderCheckpointsSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid reorder request." },
        { status: 400 }
      );
    }

    const result = await reorderCheckpoints(validated.data.orderedIds, session!.sub);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reorder checkpoints.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
