import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { checkEventLaunchReadiness } from "@/server/services/readinessService";

export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const report = await checkEventLaunchReadiness();
    return NextResponse.json(report);
  } catch (err: unknown) {
    console.error("[ADMIN READINESS GET]", err);
    return NextResponse.json({ error: "Failed to evaluate system readiness." }, { status: 500 });
  }
}
