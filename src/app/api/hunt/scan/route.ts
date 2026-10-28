import { NextResponse } from "next/server";
import { requireRole } from "@/server/middleware/auth";
import { validateCheckpointQr } from "@/server/services/checkpointService";
import { QrScanSchema } from "@/server/validators/schemas";

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

    const validated = QrScanSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Invalid QR code format." }, { status: 400 });
    }

    const result = await validateCheckpointQr(session!.sub, validated.data.qrToken);
    return NextResponse.json(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "QR validation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
