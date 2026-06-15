/**
 * 국가법령정보 공동활용 Open API (LAW_GO_KR_OC)
 * env 우선, 없으면 app_settings
 */

import { getAppSetting } from "@/lib/appSettingsServer";
import { readEnvLocal } from "@/lib/envLocalFile";

export const LAW_OPEN_API_SETTINGS_KEY = "law_open_api_settings";
export const LAW_GO_KR_OC_ENV_KEY = "LAW_GO_KR_OC";

export type LawOpenApiSettings = {
  oc?: string;
  enabled?: boolean;
  updatedAt?: string;
  preferDbOverEnv?: boolean;
};

export function normalizeLawGoKrOc(raw: string): string {
  return raw.trim().replace(/@.*$/, "").replace(/\s/g, "");
}

export function maskLawGoKrOc(oc: string): string {
  const v = normalizeLawGoKrOc(oc);
  if (!v) return "";
  if (v.length <= 2) return "••";
  return `${v.slice(0, 2)}${"•".repeat(Math.min(6, v.length - 2))}`;
}

export async function getLawGoKrOc(): Promise<string | null> {
  const stored = await getAppSetting<LawOpenApiSettings>(LAW_OPEN_API_SETTINGS_KEY);
  const preferDb = stored?.preferDbOverEnv === true;
  const dbOc = normalizeLawGoKrOc(stored?.oc ?? "");

  if (preferDb && dbOc && stored?.enabled !== false) return dbOc;

  const fromEnv = process.env[LAW_GO_KR_OC_ENV_KEY]?.trim();
  if (fromEnv) return normalizeLawGoKrOc(fromEnv) || null;

  const local = await readEnvLocal();
  const fromLocal = local[LAW_GO_KR_OC_ENV_KEY]?.trim();
  if (fromLocal) return normalizeLawGoKrOc(fromLocal) || null;

  if (!dbOc || stored?.enabled === false) return null;
  return dbOc;
}

export async function getLawOpenApiConfigSource(): Promise<"env" | "db" | "local" | "none"> {
  const stored = await getAppSetting<LawOpenApiSettings>(LAW_OPEN_API_SETTINGS_KEY);
  const preferDb = stored?.preferDbOverEnv === true;
  const dbOc = normalizeLawGoKrOc(stored?.oc ?? "");

  if (preferDb && dbOc && stored?.enabled !== false) return "db";

  const fromEnv = process.env[LAW_GO_KR_OC_ENV_KEY]?.trim();
  if (fromEnv) return "env";
  const local = await readEnvLocal();
  if (local[LAW_GO_KR_OC_ENV_KEY]?.trim()) return "local";
  if (dbOc && stored?.enabled !== false) return "db";
  return "none";
}
