/**
 * 의뢰인명 앞에 '종결' 기호(◐◑◒◓ 등)가 있는 사건을 status=종결로 변경하고 기호 제거
 * 사용: node scripts/update-concluded-by-symbol.mjs
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

const CLOSED_SYMBOL = /[\u25D0-\u25D3]/u;
const CLOSED_PREFIX = /^\s*\(?\s*[\u25D0-\u25D3\s]+/u;

function normalizeClientName(name) {
  const s = String(name ?? "").trim();
  if (!s || !CLOSED_SYMBOL.test(s)) return null;
  const trimmed = s.replace(CLOSED_PREFIX, "").replace(/[\u25D0-\u25D3\s]+/g, " ").trim();
  return trimmed || s;
}

async function main() {
  const db = createClient(url, serviceKey);
  const toUpdate = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data: rows, error } = await db
      .from("cases")
      .select("id, client_name, status")
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("사건 목록 조회 실패:", error);
      process.exit(1);
    }
    if (!rows?.length) break;
    for (const r of rows) {
      const trimmed = normalizeClientName(r.client_name);
      if (trimmed == null) continue;
      toUpdate.push({
        id: r.id,
        client_name: trimmed,
        status: "종결",
      });
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }
  if (toUpdate.length === 0) {
    console.log("의뢰인명 앞에 종결 기호(◐◑◒◓)가 있는 사건이 없습니다.");
    process.exit(0);
  }
  let updated = 0;
  for (const u of toUpdate) {
    const { error: err } = await db.from("cases").update({ client_name: u.client_name, status: u.status }).eq("id", u.id);
    if (err) {
      console.error("업데이트 실패:", u.id, err);
      continue;
    }
    updated++;
  }
  console.log(`의뢰인명 기호로 종결 처리: ${updated}건 반영되었습니다.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
