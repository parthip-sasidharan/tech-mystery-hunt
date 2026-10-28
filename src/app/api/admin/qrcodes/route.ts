import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { connectToDatabase } from "@/server/db";
import { Checkpoint } from "@/server/models";
import QRCode from "qrcode";
import { getCheckpointCount } from "@/server/services/gameService";

export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  try {
    await connectToDatabase();
    const checkpointCount = await getCheckpointCount();
    const checkpoints = await Checkpoint.find({ sequenceNumber: { $lte: checkpointCount } })
      .sort({ sequenceNumber: 1 })
      .select("sequenceNumber name campusArea locationHint qrCodeToken isFinalTreasure")
      .lean();

    const qrCodesWithImages = await Promise.all(
      checkpoints.map(async (cp) => {
        const qrDataUrl = await QRCode.toDataURL(cp.qrCodeToken, {
          width:  300,
          margin: 2,
          color:  { dark: "#000000", light: "#ffffff" },
        });
        return {
          id: String(cp._id),
          sequenceNumber: cp.sequenceNumber,
          name: cp.name,
          campusArea: cp.campusArea,
          locationHint: cp.locationHint,
          qrCodeToken: cp.qrCodeToken,
          isFinalTreasure: cp.isFinalTreasure,
          qrDataUrl,
        };
      })
    );

    return NextResponse.json({ checkpointCount, checkpoints: qrCodesWithImages });

  } catch (err: unknown) {
    console.error("[ADMIN QR]", err);
    return NextResponse.json({ error: "Failed to generate QR codes." }, { status: 500 });
  }
}
