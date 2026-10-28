import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getMasterEventReports } from "@/server/services/reportService";

/**
 * GET /api/admin/reports
 * Exports comprehensive event reports for registrations, team progress, and prize claims.
 */
export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const reports = await getMasterEventReports();
    return NextResponse.json(reports);
  } catch (err: unknown) {
    console.error("[ADMIN REPORTS GET]", err);
    return NextResponse.json({ error: "Failed to generate event reports." }, { status: 500 });
  }
}
