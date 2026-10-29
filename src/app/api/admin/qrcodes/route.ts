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

    const fakeDefinitions = [
      { token: "QR_FAKE_01", label: "Fake Decoy QR #1", meme: "Aarattu Annan Police" },
      { token: "QR_FAKE_02", label: "Fake Decoy QR #2", meme: "Bethlehem Kudumba Unit" },
      { token: "QR_FAKE_03", label: "Fake Decoy QR #3", meme: "Dance Sreenivasan" },
      { token: "QR_FAKE_04", label: "Fake Decoy QR #4", meme: "Ellathinum Samayamundu Dasaa" },
      { token: "QR_FAKE_05", label: "Fake Decoy QR #5", meme: "Funny Dileep Comedy" },
    ];

    const fakeQrs = await Promise.all(
      fakeDefinitions.map(async (f, idx) => {
        const qrDataUrl = await QRCode.toDataURL(f.token, {
          width: 300,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        return {
          id: `fake_${idx + 1}`,
          token: f.token,
          label: f.label,
          meme: f.meme,
          qrDataUrl,
        };
      })
    );

    return NextResponse.json({ checkpointCount, checkpoints: qrCodesWithImages, fakeQrs });

  } catch (err: unknown) {
    console.error("[ADMIN QR]", err);
    return NextResponse.json({ error: "Failed to generate QR codes." }, { status: 500 });
  }
}
