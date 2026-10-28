import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import {
  bulkGenerateTeamIds,
  getTeamIdStats,
  listTeamIds,
} from "@/server/services/teamIdService";
import { BulkGenerateTeamIdsSchema } from "@/server/validators/schemas";

/**
 * GET /api/admin/team-ids
 * Returns pool stats and paginated list of Team IDs.
 */
export async function GET(req: Request) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const [stats, list] = await Promise.all([
      getTeamIdStats(),
      listTeamIds({ status, search, page, limit }),
    ]);

    return NextResponse.json({
      stats,
      items: list.items,
      totalCount: list.totalCount,
      page: list.page,
      totalPages: list.totalPages,
    });
  } catch (err: unknown) {
    console.error("[ADMIN TEAM-IDS GET]", err);
    return NextResponse.json({ error: "Failed to fetch Team IDs." }, { status: 500 });
  }
}

/**
 * POST /api/admin/team-ids
 * Generates Team IDs in bulk (e.g. TEAM001...TEAM050).
 */
export async function POST(req: Request) {
  const { session, error } = requireAdmin();
  if (error) return error;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const validated = BulkGenerateTeamIdsSchema.safeParse(body);
    if (!validated.success) {
      const firstErr = validated.error.errors[0];
      return NextResponse.json(
        { error: firstErr?.message || "Invalid generation parameters." },
        { status: 400 }
      );
    }

    const { count, batchTag } = validated.data;
    const result = await bulkGenerateTeamIds(count, session!.sub, batchTag || "ADMIN_BULK");

    return NextResponse.json({
      success: true,
      message: `Successfully generated ${result.generatedCount} Team IDs (${result.fromTeamId} to ${result.toTeamId}).`,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bulk generation failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
