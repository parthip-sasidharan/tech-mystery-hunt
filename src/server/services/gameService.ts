import { connectToDatabase } from "../db";
import { GameConfig } from "../models";

let cachedConfigs: { data: Record<string, string>; expiresAt: number } | null = null;
const CONFIG_CACHE_TTL_MS = 3000; // 3 seconds in-memory cache for ultra-high concurrency

export function invalidateConfigCache() {
  cachedConfigs = null;
}

export async function getAllConfigs(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedConfigs && now < cachedConfigs.expiresAt) {
    return cachedConfigs.data;
  }

  await connectToDatabase();
  const configs = await GameConfig.find({}).lean();
  const map: Record<string, string> = {};
  for (const c of configs) {
    map[c.key] = c.value;
  }
  cachedConfigs = { data: map, expiresAt: now + CONFIG_CACHE_TTL_MS };
  return map;
}

export async function getConfig(key: string, defaultValue: string = ""): Promise<string> {
  const configs = await getAllConfigs();
  return configs[key] !== undefined ? configs[key] : defaultValue;
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
  invalidateConfigCache();
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
