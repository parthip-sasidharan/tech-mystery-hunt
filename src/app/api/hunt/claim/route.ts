import { NextResponse } from "next/server";
import { requireRole } from "@/server/middleware/auth";
import { claimTreasureBox } from "@/server/services/prizeService";
import { PrizeClaimSchema } from "@/server/validators/schemas";

export async function POST(req: Request) {
  const { session, error } = requireRole(["TEAM"]);
  if (error) return error;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const validated = PrizeClaimSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Please select Box 1, Box 2, or Box 3." },
        { status: 400 }
      );
    }

    const result = await claimTreasureBox(session!.sub, validated.data.boxNumber);
    return NextResponse.json(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Prize claim failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
