/**
 * lawygo_caselist.xls 실제 사건 데이터로 public.cases 갱신
 * - 기존 cases 전부 삭제 후 엑셀 행을 DB 형식으로 매핑해 삽입
 *
 * 사용:
 *   node scripts/seed-cases-from-excel.mjs "c:\...\lawygo_caselist.xls"
 *   .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요
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
const excelPath = process.argv[2] || path.join(process.cwd(), "lawygo_caselist.xls");

if (!url || !serviceKey) {
  console.error("오류: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.");
  process.exit(1);
}

const excelPathResolved = path.isAbsolute(excelPath) ? excelPath : path.join(process.cwd(), excelPath);
if (!existsSync(excelPathResolved)) {
  console.error("오류: 엑셀 파일을 찾을 수 없습니다.", excelPathResolved);
  process.exit(1);
}

function toDateString(v) {
  if (v === undefined || v === null) return new Date().toISOString().slice(0, 10);
  if (typeof v === "number" && v > 10000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (s.length >= 10) return s.slice(0, 10).replace(/\//g, "-");
  return new Date().toISOString().slice(0, 10);
}

function toBool(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "O" || s === "1" || s === "TRUE" || s === "예" || s === "ELEC";
}

/**
 * lawygo_caselist.xls 실제 헤더 → DB 행 변환
 * 헤더: 키값, 의뢰인, 의)지위, 상대방, 계속기관, 계속부서, 사건번호, 사건명, 기일명, 진행/잔여일, 시각, 특이[결과], 관련사건, 전자, 소분류, 수임, 수행, 보조, 담당부서, 등록일, 등록인, 수임일, 관리번호, 1234, Spare2
 */
function rowToCase(row) {
  const get = (key) => row[key] ?? "";
  const trim = (key) => String(get(key)).trim();
  const 사건번호 = trim("사건번호") || trim("키값") || "미등록";
  const 사건명 = trim("사건명");
  const 의뢰인 = trim("의뢰인");
  const 계속기관 = trim("계속기관");
  const 수행 = trim("수행");
  const 수임일Raw = row["수임일"] ?? row["등록일"];
  const 특이 = String(get("특이[결과]") ?? "").trim();
  const 진행잔여 = String(get("진행/잔여일") ?? "").trim();
  const 기일명 = String(get("기일명") ?? "").trim();

  // 종결/완료/종료 키워드가 하나라도 포함되면 종결, 그 외는 진행중
  let status = "진행중";
  const closedKeywords = ["종결", "완료", "종료"];
  const statusSource = [특이, 진행잔여, 기일명].join(" ");
  if (closedKeywords.some((kw) => statusSource.includes(kw))) {
    status = "종결";
  }

  const notesParts = [
    trim("기일명"),
    trim("진행/잔여일"),
    특이 ? `특이: ${특이}` : "",
    trim("계속부서"),
    trim("키값") ? `키: ${trim("키값")}` : "",
    trim("관련사건"),
    trim("수임") ? `수임: ${trim("수임")}` : "",
  ].filter(Boolean);
  const notes = notesParts.join(" / ").slice(0, 2000);

  return {
    case_number: 사건번호 || "미등록",
    case_type: trim("소분류") || "민사",
    case_name: 사건명 || "(사건명 없음)",
    court: 계속기관 || "미정",
    client_name: 의뢰인 || "(의뢰인 없음)",
    client_position: trim("의)지위") || "",
    opponent_name: trim("상대방") || "",
    status,
    assigned_staff_name: 수행 || "미배정",
    assistants: trim("보조") || "",
    received_date: toDateString(수임일Raw),
    amount: 0,
    received_amount: 0,
    pending_amount: 0,
    is_electronic: toBool(get("전자")),
    is_urgent: false,
    is_immutable_deadline: false,
    notes: notes || "",
  };
}

async function main() {
  const buf = readFileSync(excelPathResolved);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);

  const db = createClient(url, serviceKey);

  const cases = [];
  for (const rowArr of dataRows) {
    const row = {};
    headers.forEach((h, i) => {
      row[h] = rowArr[i];
    });
    cases.push(rowToCase(row));
  }

  if (cases.length === 0) {
    console.log("삽입할 사건 데이터가 없습니다.");
    process.exit(0);
  }

  // 기존 사건 전량 삭제 (Supabase select 기본 1000건 제한 있으므로 페이지네이션)
  let totalDeleted = 0;
  const pageSize = 1000;
  while (true) {
    const { data: existing } = await db.from("cases").select("id").range(0, pageSize - 1);
    const ids = (existing || []).map((r) => r.id);
    if (ids.length === 0) break;
    const chunk = 100;
    for (let i = 0; i < ids.length; i += chunk) {
      const slice = ids.slice(i, i + chunk);
      const { error } = await db.from("cases").delete().in("id", slice);
      if (error) {
        console.error("삭제 실패:", error);
        process.exit(1);
      }
    }
    totalDeleted += ids.length;
    if (ids.length < pageSize) break;
  }
  if (totalDeleted > 0) {
    console.log("기존 사건", totalDeleted, "건 삭제됨.");
  }

  const insertChunk = 100;
  let inserted = 0;
  for (let i = 0; i < cases.length; i += insertChunk) {
    const slice = cases.slice(i, i + insertChunk);
    const { error } = await db.from("cases").insert(slice);
    if (error) {
      console.error("삽입 실패:", error);
      process.exit(1);
    }
    inserted += slice.length;
  }
  console.log("엑셀 데이터", inserted, "건 삽입 완료. (엑셀 행 기준 1:1 반영) 사건 목록이 갱신되었습니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
