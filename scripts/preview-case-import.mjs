/**
 * 엑셀 import 미리보기 (DB 중복 vs 신규)
 * node scripts/preview-case-import.mjs "path/to/file.xlsx"
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parseExcelBufferToCases } from "../src/lib/caseExcel.ts";
import { loadExistingCaseKeySets, planCaseImport } from "../src/lib/caseImportServer.ts";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

loadEnv(resolve(__dir, "../.env.local"));

const excelPath = process.argv[2];
if (!excelPath) {
  console.error("사용법: node scripts/preview-case-import.mjs <엑셀경로>");
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
const db = createClient(url, key);
const existing = await loadExistingCaseKeySets(db);
const plan = planCaseImport(items, existing);

console.log(
  JSON.stringify(
    {
      file: resolved,
      excelParsed: items.length,
      dbExistingCaseClientKeys: existing.existingCaseClient.size,
      summary: plan.summary,
      sampleInsert: plan.rows
        .filter((r) => r.status === "insert")
        .slice(0, 8)
        .map((r) => ({
          excelRow: r.excelRow,
          caseNumber: r.caseNumber,
          clientName: r.clientName,
          court: r.court,
        })),
      sampleDuplicateDb: plan.rows
        .filter((r) => r.status === "duplicate_db")
        .slice(0, 8)
        .map((r) => ({
          excelRow: r.excelRow,
          caseNumber: r.caseNumber,
          clientName: r.clientName,
          reason: r.reason,
        })),
    },
    null,
    2
  )
);
