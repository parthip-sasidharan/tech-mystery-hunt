import { NextResponse } from "next/server";
import { requireRole } from "@/server/middleware/auth";
import { submitCheckpointAnswer } from "@/server/services/checkpointService";
import { SubmitAnswerSchema } from "@/server/validators/schemas";

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

    const validated = SubmitAnswerSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Answer cannot be empty." }, { status: 400 });
    }

    const result = await submitCheckpointAnswer(session!.sub, validated.data.answer);
    return NextResponse.json(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Answer submission failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
