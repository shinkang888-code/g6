/**
 * cases 테이블에서 완전히 동일한 사건(모든 필드 값이 같은 행) 중
 * 첫 번째 1건만 남기고 나머지 중복 행을 삭제하는 스크립트.
 *
 * 사용:
 *   node scripts/dedupe-cases.mjs
 *
 * .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import path from "path";

function loadEnvLocal() {
  const root = path.resolve(process.cwd());
  const file = path.join(root, ".env.local");
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("오류: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.");
  process.exit(1);
}

async function main() {
  const db = createClient(url, serviceKey);

  // 1) 전체 사건 페이지네이션으로 로드
  const allRows = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from("cases")
      .select("*")
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("사건 목록 조회 실패:", error);
      process.exit(1);
    }
    const rows = data ?? [];
    if (rows.length === 0) break;
    allRows.push(...rows);
    offset += pageSize;
    if (rows.length < pageSize) break;
  }

  console.log("전체 사건 수:", allRows.length);

  // 2) id / created_at / updated_at 을 제외한 완전 동일 키로 그룹핑
  const byKey = new Map();

  for (const r of allRows) {
    const row = { ...(r ?? {}) };
    const id = String(row.id ?? "");
    if (!id) continue;
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    const key = JSON.stringify(row);
    const entry = byKey.get(key);
    if (!entry) {
      byKey.set(key, { keepId: id, dupIds: [] });
    } else {
      entry.dupIds.push(id);
    }
  }

  const deleteIds = [];
  for (const { dupIds } of byKey.values()) {
    if (dupIds.length > 0) deleteIds.push(...dupIds);
  }

  if (deleteIds.length === 0) {
    console.log("완전히 동일한 중복 사건이 없습니다.");
    process.exit(0);
  }

  // 3) 중복 id 삭제
  const chunkSize = 200;
  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += chunkSize) {
    const slice = deleteIds.slice(i, i + chunkSize);
    const { error } = await db.from("cases").delete().in("id", slice);
    if (error) {
      console.error("삭제 실패:", error);
      process.exit(1);
    }
    deleted += slice.length;
    console.log(`삭제 진행: ${deleted}/${deleteIds.length}`);
  }

  console.log(`완전히 동일한 중복 사건 ${deleted}건을 삭제했습니다.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

