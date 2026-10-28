import { NextResponse } from "next/server";
import { requireVolunteerOrAdmin } from "@/server/middleware/auth";
import {
  listAllClaimsForVolunteer,
  verifyPrizeClaim,
  directVerifyPrizeClaim,
  releasePendingClaim,
} from "@/server/services/prizeService";
import { VolunteerVerifySchema } from "@/server/validators/schemas";

export async function GET() {
  const { error } = requireVolunteerOrAdmin();
  if (error) return error;

  try {
    const data = await listAllClaimsForVolunteer();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[VOLUNTEER CLAIMS GET]", err);
    return NextResponse.json({ error: "Failed to fetch prize claims." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = requireVolunteerOrAdmin();
  if (error) return error;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // 1. Direct Physical Box Verification Action
    if (body.directVerify) {
      if (!body.teamObjectId || !body.boxNumber) {
        return NextResponse.json(
          { error: "teamObjectId and boxNumber are required for direct verification." },
          { status: 400 }
        );
      }

      const result = await directVerifyPrizeClaim(session!.sub, {
        teamObjectId: String(body.teamObjectId),
        boxNumber: Number(body.boxNumber),
        volunteerNotes: body.volunteerNotes,
      });

      return NextResponse.json(result);
    }

    // 2. Controlled Release Action
    if (body.release) {
      if (!body.claimId || !body.reason) {
        return NextResponse.json(
          { error: "claimId and reason are required to release a pending claim." },
          { status: 400 }
        );
      }

      const result = await releasePendingClaim(session!.sub, body.claimId, body.reason);
      return NextResponse.json(result);
    }

    // 3. Standard Verification of Existing Claim
    const validated = VolunteerVerifySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
    }

    const result = await verifyPrizeClaim(
      session!.sub,
      validated.data.claimId,
      validated.data.status,
      validated.data.volunteerNotes
    );

    return NextResponse.json({
      success: true,
      message: `Claim marked as ${validated.data.status}.`,
      claim: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
