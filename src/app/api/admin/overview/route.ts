import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getMasterOverviewStats } from "@/server/services/reportService";

/**
 * GET /api/admin/overview
 * Real-time event statistics, team breakdown, checkpoint metrics, and prize box status from MongoDB.
 */
export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const stats = await getMasterOverviewStats();
    return NextResponse.json(stats);
  } catch (err: unknown) {
    console.error("[ADMIN OVERVIEW GET]", err);
    return NextResponse.json({ error: "Failed to load admin overview metrics." }, { status: 500 });
  }
}
