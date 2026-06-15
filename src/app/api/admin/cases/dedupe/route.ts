import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";

export async function POST() {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });
  }

  const { data, error } = await db.from("cases").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const rows = data ?? [];
  type Row = Record<string, unknown>;

  const byKey = new Map<string, { keepId: string; dupIds: string[] }>();

  for (const r of rows as Row[]) {
    const id = String(r.id ?? "");
    if (!id) continue;
    const keyObj: Row = { ...r };
    delete keyObj.id;
    delete keyObj.created_at;
    delete keyObj.updated_at;
    const key = JSON.stringify(keyObj);
    const entry = byKey.get(key);
    if (!entry) {
      byKey.set(key, { keepId: id, dupIds: [] });
    } else {
      entry.dupIds.push(id);
    }
  }

  const deleteIds: string[] = [];
  for (const { dupIds } of byKey.values()) {
    if (dupIds.length > 0) deleteIds.push(...dupIds);
  }

  if (deleteIds.length === 0) {
    return NextResponse.json({ message: "삭제할 중복 사건이 없습니다.", deleted: 0 });
  }

  const chunkSize = 100;
  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += chunkSize) {
    const slice = deleteIds.slice(i, i + chunkSize);
    const { error: delError } = await db.from("cases").delete().in("id", slice);
    if (delError) {
      return NextResponse.json({ error: delError.message, deleted }, { status: 400 });
    }
    deleted += slice.length;
  }

  return NextResponse.json({ message: `중복 사건 ${deleted}건을 삭제했습니다.`, deleted });
}

