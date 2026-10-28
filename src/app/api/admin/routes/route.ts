import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { listRoutesForAdmin, createRoute } from "@/server/services/routeAdminService";
import { CreateRouteSchema } from "@/server/validators/schemas";

/**
 * GET /api/admin/routes
 * Lists all routes with validation status, team assignments and step breakdowns.
 */
export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const data = await listRoutesForAdmin();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[ADMIN ROUTES GET]", err);
    return NextResponse.json({ error: "Failed to list routes." }, { status: 500 });
  }
}

/**
 * POST /api/admin/routes
 * Creates a new campus route with strict sequence validation.
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

    const validated = CreateRouteSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid route data." },
        { status: 400 }
      );
    }

    const result = await createRoute(validated.data, session!.sub);
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create route.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
