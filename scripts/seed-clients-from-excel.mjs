/**
 * guestlist.xls 고객 리스트로 public.clients 갱신
 * - 기존 clients 전부 삭제 후 엑셀 행을 DB 형식으로 매핑해 삽입
 *
 * 사용:
 *   node scripts/seed-clients-from-excel.mjs "c:\...\guestlist.xls"
 */

import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
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
const excelPath = process.argv[2] || path.join(process.cwd(), "guestlist.xls");

if (!url || !serviceKey) {
  console.error("오류: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.");
  process.exit(1);
}

const excelPathResolved = path.isAbsolute(excelPath) ? excelPath : path.join(process.cwd(), excelPath);
if (!existsSync(excelPathResolved)) {
  console.error("오류: 엑셀 파일을 찾을 수 없습니다.", excelPathResolved);
  process.exit(1);
}

/**
 * guestlist.xls 한 행 → public.clients 행
 * 헤더: 수정일자, 구분, 담당자명, 이동전화, 이메일, 전화, 팩스, 소속(부서), 직위, 비고, 의뢰인명, 대표자명, 기타(법원 등), 사건번호, 사건명, 수임인, 수행인, 보조인, 등록인, 주소, 고유번호
 */
function rowToClient(row) {
  const get = (key) => row[key] ?? "";
  const trim = (key) => String(get(key)).trim();
  const 의뢰인명 = trim("의뢰인명");
  if (!의뢰인명) return null;

  const phone = trim("이동전화") || trim("전화");
  const memoParts = [
    trim("비고"),
    trim("구분") ? `구분: ${trim("구분")}` : "",
    trim("담당자명") ? `담당: ${trim("담당자명")}` : "",
    trim("사건번호") ? `사건번호: ${trim("사건번호")}` : "",
    trim("사건명") ? `사건명: ${trim("사건명")}` : "",
    trim("기타(법원 등)") ? `기타: ${trim("기타(법원 등)")}` : "",
    trim("수임인") ? `수임: ${trim("수임인")}` : "",
    trim("수행인") ? `수행: ${trim("수행인")}` : "",
    trim("보조인") ? `보조: ${trim("보조인")}` : "",
    trim("등록인") ? `등록: ${trim("등록인")}` : "",
  ].filter(Boolean);
  const memo = memoParts.join(" / ").slice(0, 2000);

  return {
    name: 의뢰인명,
    position: trim("직위") || null,
    contact_phone: phone || null,
    contact_email: trim("이메일") || null,
    memo: memo || null,
    address: trim("주소") || null,
    guest_code: trim("고유번호") || null,
  };
}

async function main() {
  const buf = readFileSync(excelPathResolved);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const headers = (rows[0] || []).filter((h) => h != null && String(h).trim() !== "");

  const clients = [];
  for (let i = 1; i < rows.length; i++) {
    const rowArr = rows[i];
    const row = {};
    (rows[0] || []).forEach((h, j) => {
      if (h != null && String(h).trim() !== "") row[h] = rowArr[j];
    });
    const c = rowToClient(row);
    if (c) clients.push(c);
  }

  if (clients.length === 0) {
    console.log("삽입할 고객 데이터가 없습니다.");
    process.exit(0);
  }

  const db = createClient(url, serviceKey);

  const { data: existing } = await db.from("clients").select("id");
  const ids = (existing || []).map((r) => r.id);
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await db.from("clients").delete().in("id", chunk);
      if (error) {
        console.error("clients 삭제 실패:", error);
        process.exit(1);
      }
    }
    console.log("기존 고객", ids.length, "건 삭제됨.");
  }

  const insertChunk = 100;
  let inserted = 0;
  for (let i = 0; i < clients.length; i += insertChunk) {
    const slice = clients.slice(i, i + insertChunk);
    const { error } = await db.from("clients").insert(slice);
    if (error) {
      console.error("clients 삽입 실패:", error);
      process.exit(1);
    }
    inserted += slice.length;
  }
  console.log("고객(clients)", inserted, "건 삽입 완료. guestlist 데이터로 갱신되었습니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
