/**
 * 서버 전용: app_settings 테이블에서 설정 조회 (API Route 등)
 */

import { getSupabaseAdmin } from "./supabaseClient";

export async function getAppSetting<T = unknown>(key: string): Promise<T | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("app_settings").select("value").eq("key", key).single();
  if (error || data == null) return null;
  return data.value as T;
}

export async function setAppSetting(key: string, value: unknown): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data: existing } = await db.from("app_settings").select("key").eq("key", key).maybeSingle();
  if (existing) {
    const { error } = await db.from("app_settings").update({ value }).eq("key", key);
    return !error;
  }
  const { error } = await db.from("app_settings").insert({ key, value });
  return !error;
}
