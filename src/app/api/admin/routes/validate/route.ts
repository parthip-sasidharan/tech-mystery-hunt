import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { validateAllRoutesReport } from "@/server/services/routeAdminService";

/**
 * GET /api/admin/routes/validate
 * Audits all routes against configured checkpoints and reports errors, missing steps or bottlenecks.
 */
export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const report = await validateAllRoutesReport();
    return NextResponse.json(report);
  } catch (err: unknown) {
    console.error("[ADMIN ROUTES VALIDATE GET]", err);
    return NextResponse.json({ error: "Failed to validate routes." }, { status: 500 });
  }
}
