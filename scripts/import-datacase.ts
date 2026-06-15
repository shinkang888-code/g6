/**
 * datacase.xlsx → Supabase 사건 일괄 등록 (엑셀 업로드 API와 동일 로직)
 * 사용: npx tsx scripts/import-datacase.ts "path/to/datacase.xlsx"
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { parseExcelBufferToCases, normalizeClientNameForClosedStatus } from "../src/lib/caseExcel";

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      const v = m[2].trim();
      if (k && v && process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(root, "bot/.env"));
loadEnvFile(resolve(root, ".env.local"));

function toBool(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "O" || s === "1" || s === "TRUE" || s === "예" || s === "ELEC";
}

function toDateString(v: unknown): string {
  if (v === undefined || v === null) return new Date().toISOString().slice(0, 10);
  if (typeof v === "number" && v > 10000) {
    return new Date((v - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (s.length >= 10) return s.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function toRow(item: Record<string, unknown>) {
  const receivedRaw = item.receivedDate ?? item.received_date;
  const rawClientName = String(item.clientName ?? item.client_name ?? "").trim() || "(의뢰인 없음)";
  const { name: client_name, status: closedOverride } = normalizeClientNameForClosedStatus(rawClientName);
  return {
    case_number: String(item.caseNumber ?? item.case_number ?? "").trim() || "미등록",
    case_type: String(item.caseType ?? item.case_type ?? "민사").trim() || "민사",
    case_name: String(item.caseName ?? item.case_name ?? "").trim() || "(사건명 없음)",
    court: String(item.court ?? "").trim() || "미정",
    client_name: client_name || "(의뢰인 없음)",
    client_position: (item.clientPosition ?? item.client_position ?? "") as string,
    opponent_name: (item.opponentName ?? item.opponent_name ?? "") as string,
    status: closedOverride ?? item.status ?? "진행중",
    assigned_staff_name: String(item.assignedStaff ?? item.assigned_staff_name ?? "").trim() || "미배정",
    assistants: (item.assistants ?? "") as string,
    received_date: toDateString(receivedRaw),
    amount: Number(item.amount ?? 0),
    received_amount: Number(item.receivedAmount ?? item.received_amount ?? 0),
    pending_amount: Number(item.pendingAmount ?? item.pending_amount ?? 0),
    is_electronic: toBool(item.isElectronic ?? item.is_electronic),
    is_urgent: toBool(item.isUrgent ?? item.is_urgent),
    is_immutable_deadline: toBool(item.isImmutable ?? item.is_immutable_deadline),
    notes: (item.notes ?? "") as string,
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/import-datacase.ts <datacase.xlsx>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local 또는 bot/.env)");
    process.exit(1);
  }

  const buf = readFileSync(file);
  const items = parseExcelBufferToCases(buf);
  console.log(`파싱: ${items.length}건 (중복 제거 후)`);
  if (items.length === 0) {
    console.error("등록할 사건 없음");
    process.exit(1);
  }

  console.log("샘플:", JSON.stringify(items[0], null, 2));

  const db = createClient(url, key);
  const rawRows = items.map((item) => toRow(item as Record<string, unknown>));

  const existingKeys = new Set<string>();
  const existingCaseClient = new Set<string>();
  const pageSizeLoad = 1000;
  let from = 0;
  while (true) {
    const { data: chunk, error: loadError } = await db
      .from("cases")
      .select("*")
      .range(from, from + pageSizeLoad - 1);
    if (loadError) throw new Error(loadError.message);
    if (!chunk?.length) break;
    for (const r of chunk) {
      const keyObj = { ...r };
      delete (keyObj as Record<string, unknown>).id;
      delete (keyObj as Record<string, unknown>).created_at;
      delete (keyObj as Record<string, unknown>).updated_at;
      existingKeys.add(JSON.stringify(keyObj));
      existingCaseClient.add(
        `${String(r.case_number ?? "").trim()}|${String(r.client_name ?? "").trim()}`
      );
    }
    if (chunk.length < pageSizeLoad) break;
    from += pageSizeLoad;
  }

  const toInsert = rawRows.filter((row) => {
    const ccKey = `${row.case_number}|${row.client_name}`;
    if (existingCaseClient.has(ccKey)) return false;
    if (existingKeys.has(JSON.stringify(row))) return false;
    return true;
  });
  console.log(`신규 등록 대상: ${toInsert.length}건 (기존 동일 ${rawRows.length - toInsert.length}건 제외)`);

  let inserted = 0;
  const chunkSize = 100;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { error } = await db.from("cases").insert(chunk);
    if (error) throw new Error(`insert 실패 @${i}: ${error.message}`);
    inserted += chunk.length;
    process.stdout.write(`\r등록 중… ${inserted}/${toInsert.length}`);
  }

  console.log(`\n완료: ${inserted}건 등록`);
  const { count } = await db.from("cases").select("*", { count: "exact", head: true });
  console.log(`DB 사건 총 ${count}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
