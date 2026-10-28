import { NextResponse } from "next/server";
import { requireRole } from "@/server/middleware/auth";
import { verifyPenaltyTaskWithCode } from "@/server/services/checkpointService";

export async function POST(req: Request) {
  const { session, error } = requireRole(["TEAM"]);
  if (error) return error;

  try {
    const body = await req.json();
    if (!body.code) {
      return NextResponse.json({ error: "Verification code is required." }, { status: 400 });
    }

    const result = await verifyPenaltyTaskWithCode(session!.sub, String(body.code));
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Penalty verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
