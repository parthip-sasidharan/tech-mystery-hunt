import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { listCheckpointsForAdmin, createCheckpoint } from "@/server/services/checkpointAdminService";
import { CreateCheckpointSchema } from "@/server/validators/schemas";

/**
 * GET /api/admin/checkpoints
 * Lists all checkpoints with question prompts, options, clues and live stats.
 */
export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const data = await listCheckpointsForAdmin();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[ADMIN CHECKPOINTS GET]", err);
    return NextResponse.json({ error: "Failed to list checkpoints." }, { status: 500 });
  }
}

/**
 * POST /api/admin/checkpoints
 * Creates a new checkpoint and attached question with bcrypt answer hashing.
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

    const validated = CreateCheckpointSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid checkpoint data." },
        { status: 400 }
      );
    }

    const result = await createCheckpoint(validated.data, session!.sub);
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create checkpoint.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
