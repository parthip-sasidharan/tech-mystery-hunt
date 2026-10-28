import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getActiveBroadcast, setGlobalBroadcast, clearGlobalBroadcast } from "@/server/services/prizeService";

export async function GET() {
  try {
    const broadcast = await getActiveBroadcast();
    return NextResponse.json({ broadcast });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch broadcast";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();

    if (body.clear) {
      await clearGlobalBroadcast();
      return NextResponse.json({ success: true, message: "Broadcast cleared." });
    }

    if (!body.title || !body.message) {
      return NextResponse.json({ error: "Title and message are required." }, { status: 400 });
    }

    const broadcast = await setGlobalBroadcast(body.title, body.message, body.type || "ALERT");
    return NextResponse.json({ success: true, broadcast });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to set broadcast";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
