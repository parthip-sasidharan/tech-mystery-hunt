import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { updateRoute, deleteRoute } from "@/server/services/routeAdminService";
import { UpdateRouteSchema } from "@/server/validators/schemas";

/**
 * PATCH /api/admin/routes/[id]
 * Updates route metadata or sequence with active game protections.
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

    const validated = UpdateRouteSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid update data." },
        { status: 400 }
      );
    }

    const result = await updateRoute(params.id, validated.data, session!.sub);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update route.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/routes/[id]
 * Deletes a route (blocked if teams are currently assigned to it).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    const result = await deleteRoute(params.id, session!.sub);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete route.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
