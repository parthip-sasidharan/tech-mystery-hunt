import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getBoxClues, setBoxClues } from "@/server/services/prizeService";

export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const clues = await getBoxClues();
    return NextResponse.json({ clues });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch clues";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    await setBoxClues({
      clue1: body.clue1,
      clue2: body.clue2,
      clue3: body.clue3,
    });
    const updated = await getBoxClues();
    return NextResponse.json({ success: true, clues: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update clues";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
