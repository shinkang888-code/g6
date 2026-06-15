/**
 * 엑셀 재import — 기존 사건은 등록일·등록인·수임일 메타만 갱신, 신규만 삽입
 * 사용: npx tsx scripts/import-case-meta-from-excel.ts "path/to/file.xlsx"
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseExcelBufferToCases } from "../src/lib/caseExcel";
import {
  caseItemToDbRow,
  loadExistingCaseKeySets,
  planCaseImport,
} from "../src/lib/caseImportServer";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

loadEnv(resolve(__dir, "../.env.local"));

type ExistingCase = {
  id: string;
  case_number: string;
  client_name: string;
  created_by_name: string | null;
  registered_date: string | null;
  received_date: string | null;
};

async function loadExistingCaseMap(db: SupabaseClient) {
  const map = new Map<string, ExistingCase>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from("cases")
      .select("id, case_number, client_name, created_by_name, registered_date, received_date")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data as ExistingCase[]) {
      const key = `${String(row.case_number ?? "").trim()}|${String(row.client_name ?? "").trim()}`;
      map.set(key, row);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

async function main() {
  const excelPath = process.argv[2];
  if (!excelPath) {
    console.error("사용법: npx tsx scripts/import-case-meta-from-excel.ts <엑셀경로>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("오류: .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
    process.exit(1);
  }

  const resolved = resolve(excelPath);
  if (!existsSync(resolved)) {
    console.error("오류: 파일 없음", resolved);
    process.exit(1);
  }

  const buf = readFileSync(resolved);
  const items = parseExcelBufferToCases(buf);
  console.log(`엑셀 파싱: ${items.length}건 (중복 행 병합 후)\n`);

  const db = createClient(url, key);
  const existingMap = await loadExistingCaseMap(db);
  console.log(`DB 기존 사건: ${existingMap.size}건\n`);

  let metaUpdated = 0;
  let metaSkipped = 0;
  let metaNoExcel = 0;
  const updateErrors: Array<{ key: string; error: string }> = [];

  for (const raw of items) {
    const row = caseItemToDbRow(raw as Record<string, unknown>);
    const ccKey = `${row.case_number}|${row.client_name}`;
    const existing = existingMap.get(ccKey);
    if (!existing) continue;

    const patch: Record<string, string> = {};
    if (row.created_by_name?.trim()) patch.created_by_name = row.created_by_name.trim();
    if (row.registered_date?.trim()) patch.registered_date = row.registered_date.trim();
    if (row.received_date?.trim()) patch.received_date = row.received_date.trim();

    if (Object.keys(patch).length === 0) {
      metaNoExcel += 1;
      continue;
    }

    const unchanged =
      (!patch.created_by_name || patch.created_by_name === (existing.created_by_name ?? "").trim()) &&
      (!patch.registered_date || patch.registered_date === (existing.registered_date ?? "").trim()) &&
      (!patch.received_date || patch.received_date === (existing.received_date ?? "").trim());

    if (unchanged) {
      metaSkipped += 1;
      continue;
    }

    const { error } = await db.from("cases").update(patch).eq("id", existing.id);
    if (error) {
      updateErrors.push({ key: ccKey, error: error.message });
      continue;
    }
    metaUpdated += 1;
    if (metaUpdated % 200 === 0) {
      process.stdout.write(`\r메타 갱신 중… ${metaUpdated}`);
    }
  }

  console.log(`\n메타 갱신 완료: ${metaUpdated}건 갱신, ${metaSkipped}건 동일, ${metaNoExcel}건 엑셀 메타 없음`);
  if (updateErrors.length > 0) {
    console.warn(`갱신 실패 ${updateErrors.length}건 (샘플):`, updateErrors.slice(0, 5));
  }

  const keySets = await loadExistingCaseKeySets(db);
  const plan = planCaseImport(items as Array<Record<string, unknown>>, keySets);
  console.log(
    `\n신규 삽입 계획: ${plan.summary.insert}건 (중복 제외 ${plan.summary.duplicateDb + plan.summary.duplicateBatch}건)`
  );

  let inserted = 0;
  if (plan.toInsert.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < plan.toInsert.length; i += chunkSize) {
      const chunk = plan.toInsert.slice(i, i + chunkSize);
      const { error } = await db.from("cases").insert(chunk);
      if (error) throw new Error(`신규 삽입 실패: ${error.message}`);
      inserted += chunk.length;
    }
    console.log(`신규 삽입 완료: ${inserted}건`);
  } else {
    console.log("신규 삽입 없음 (모두 기존 사건)");
  }

  const result = {
    file: resolved,
    excelParsed: items.length,
    metaUpdated,
    metaSkipped,
    metaNoExcel,
    metaUpdateErrors: updateErrors.length,
    inserted,
    duplicateSkipped: plan.summary.duplicateDb + plan.summary.duplicateBatch,
    at: new Date().toISOString(),
  };

  const outPath = resolve(__dir, "../case-meta-import-result.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n결과 저장: ${outPath}`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
