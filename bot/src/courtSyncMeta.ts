import type { SupabaseClient } from "@supabase/supabase-js";

const META_KEY = "court_deadline_sync_meta";

type CaseSyncMeta = {
  syncedAt: string;
  eventsHash: string;
  lastError?: string;
};

type CaseSyncMetaMap = Record<string, CaseSyncMeta>;

async function loadMeta(db: SupabaseClient): Promise<CaseSyncMetaMap> {
  const { data } = await db.from("app_settings").select("value").eq("key", META_KEY).maybeSingle();
  const v = (data as { value?: CaseSyncMetaMap } | null)?.value;
  return v && typeof v === "object" ? v : {};
}

async function saveMeta(db: SupabaseClient, map: CaseSyncMetaMap): Promise<void> {
  const { data: existing } = await db.from("app_settings").select("key").eq("key", META_KEY).maybeSingle();
  if (existing) {
    await db.from("app_settings").update({ value: map }).eq("key", META_KEY);
  } else {
    await db.from("app_settings").insert({ key: META_KEY, value: map });
  }
}

export async function updateCaseSyncMeta(
  db: SupabaseClient,
  caseId: string,
  patch: Partial<CaseSyncMeta>
): Promise<void> {
  const map = await loadMeta(db);
  map[caseId] = {
    ...map[caseId],
    ...patch,
    syncedAt: patch.syncedAt ?? map[caseId]?.syncedAt ?? new Date().toISOString(),
    eventsHash: patch.eventsHash ?? map[caseId]?.eventsHash ?? "",
  };
  await saveMeta(db, map);
}
