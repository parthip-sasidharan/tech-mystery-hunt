import { connectToDatabase } from "../db";
import { GameConfig } from "../models";

export async function getConfig(key: string, defaultValue: string = ""): Promise<string> {
  await connectToDatabase();
  const config = await GameConfig.findOne({ key }).lean();
  return config ? config.value : defaultValue;
}

export async function getAllConfigs(): Promise<Record<string, string>> {
  await connectToDatabase();
  const configs = await GameConfig.find({}).lean();
  const map: Record<string, string> = {};
  for (const c of configs) {
    map[c.key] = c.value;
  }
  return map;
}

export async function setConfig(key: string, value: string, description?: string): Promise<void> {
  await connectToDatabase();
  await GameConfig.findOneAndUpdate(
    { key },
    {
      $set: {
        value,
        ...(description ? { description } : {}),
      },
    },
    { upsert: true, new: true }
  );
}

export async function getCheckpointCount(): Promise<number> {
  const val = await getConfig("CHECKPOINT_COUNT", "8");
  const count = parseInt(val, 10);
  return !isNaN(count) && count >= 2 ? count : 8;
}

export async function getGameStatus(): Promise<"WAITING" | "ACTIVE" | "PAUSED" | "CONCLUDED"> {
  const status = await getConfig("GAME_STATUS", "WAITING");
  if (["WAITING", "ACTIVE", "PAUSED", "CONCLUDED"].includes(status)) {
    return status as "WAITING" | "ACTIVE" | "PAUSED" | "CONCLUDED";
  }
  return "WAITING";
}

export async function isRegistrationOpen(): Promise<boolean> {
  const val = await getConfig("REGISTRATION_OPEN", "true");
  return val.toLowerCase() === "true";
}
