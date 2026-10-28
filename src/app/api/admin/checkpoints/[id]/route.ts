import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { updateCheckpoint, deleteCheckpoint } from "@/server/services/checkpointAdminService";
import { UpdateCheckpointSchema } from "@/server/validators/schemas";

/**
 * PATCH /api/admin/checkpoints/[id]
 * Edits checkpoint details, clue, active status, or question data.
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

    const validated = UpdateCheckpointSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid update data." },
        { status: 400 }
      );
    }

    const result = await updateCheckpoint(params.id, validated.data, session!.sub);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update checkpoint.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/checkpoints/[id]
 * Deletes a checkpoint (blocked if teams have progress or active routes include it).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    const result = await deleteCheckpoint(params.id, session!.sub);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete checkpoint.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
