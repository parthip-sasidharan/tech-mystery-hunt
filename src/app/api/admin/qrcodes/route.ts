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
      { token: "QR_FAKE_06", label: "Fake Decoy QR #6", meme: "Kalaranjini Konjanam Kuthal" },
      { token: "QR_FAKE_07", label: "Fake Decoy QR #7", meme: "Kalaranjini Smile Troll" },
      { token: "QR_FAKE_08", label: "Fake Decoy QR #8", meme: "Kalyanaraman Comedy" },
      { token: "QR_FAKE_09", label: "Fake Decoy QR #9", meme: "Laughing Suresh Krishna" },
      { token: "QR_FAKE_10", label: "Fake Decoy QR #10", meme: "Mammootty Mamangam Trap" },
      { token: "QR_FAKE_11", label: "Fake Decoy QR #11", meme: "Mammootty Mamangam Epic" },
      { token: "QR_FAKE_12", label: "Fake Decoy QR #12", meme: "Nivin Pauly Meme" },
      { token: "QR_FAKE_13", label: "Fake Decoy QR #13", meme: "Campus Prank Video 1" },
      { token: "QR_FAKE_14", label: "Fake Decoy QR #14", meme: "Campus Prank Video 2" },
      { token: "QR_FAKE_15", label: "Fake Decoy QR #15", meme: "Saiju Kurup Onnumilla" },
      { token: "QR_FAKE_16", label: "Fake Decoy QR #16", meme: "Karikku Smile" },
      { token: "QR_FAKE_17", label: "Fake Decoy QR #17", meme: "Baby Jean That's The Spirit" },
      { token: "QR_FAKE_18", label: "Fake Decoy QR #18", meme: "Tom and Jerry Chase" },
      { token: "QR_FAKE_19", label: "Fake Decoy QR #19", meme: "Prank GIF Animation" },
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
