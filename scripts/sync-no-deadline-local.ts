/**
 * 기일 없음 + 연동 가능 사건 — 로컬 직접 연동 (API rate limit 회피)
 * npx tsx scripts/sync-no-deadline-local.ts [--limit=N]
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "url";
import { getSupabaseAdmin } from "../src/lib/supabaseClient";
import { buildScourtJobFromCase } from "../src/lib/scourtCaseParams";
import { syncCaseDeadlines } from "../src/lib/courtDeadlineSync";

const __dir = dirname(fileURLToPath(import.meta.url));
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const DELAY_MS = Number(process.argv.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? "4000");
const USER_ID = "bulk-no-deadline-sync";

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(resolve(__dir, "../.env.local"));
loadEnv(resolve(__dir, "../bot/.env"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = getSupabaseAdmin();
  if (!db) {
    console.error("Supabase 미설정");
    process.exit(1);
  }

  const { data: cases, error: caseErr } = await db
    .from("cases")
    .select("id, case_number, court, client_name")
    .eq("status", "진행중")
    .limit(2000);
  if (caseErr) throw new Error(caseErr.message);

  const hasDl = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: dlRows, error: dlErr } = await db
      .from("deadlines")
      .select("case_id")
      .range(from, from + pageSize - 1);
    if (dlErr) throw new Error(dlErr.message);
    if (!dlRows?.length) break;
    for (const r of dlRows) hasDl.add(r.case_id as string);
    if (dlRows.length < pageSize) break;
  }

  let targets = (cases ?? []).filter((c) => {
    if (hasDl.has(c.id as string)) return false;
    const built = buildScourtJobFromCase({
      id: c.id as string,
      case_number: c.case_number as string,
      court: c.court as string,
      client_name: c.client_name as string,
    });
    return !("error" in built);
  });

  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  console.log(`=== 로컬 기일 없음 연동 ===`);
  console.log(`대상: ${targets.length}건, 요청 간격 ${DELAY_MS}ms\n`);

  const results = { ok: 0, fail: 0, skip: 0, noChange: 0, errors: [] as { caseNumber: string; error: string }[] };
  const t0 = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const label = String(c.case_number);
    process.stdout.write(`[${i + 1}/${targets.length}] ${label} … `);
    try {
      const r = await syncCaseDeadlines(c.id as string, USER_ID);
      if (r.ok) {
        if (r.skippedNoChange) {
          results.noChange++;
          console.log("변경없음");
        } else {
          results.ok++;
          console.log(`OK +${r.eventsAdded ?? 0}`);
        }
      } else if (r.skipped) {
        results.skip++;
        console.log(`SKIP ${r.skipReason ?? r.error}`);
      } else {
        results.fail++;
        const err = r.error ?? "unknown";
        results.errors.push({ caseNumber: label, error: err });
        console.log(`FAIL ${err}`);
      }
    } catch (e) {
      results.fail++;
      const err = e instanceof Error ? e.message : String(e);
      results.errors.push({ caseNumber: label, error: err });
      console.log(`ERR ${err}`);
    }
    if (i < targets.length - 1) await sleep(DELAY_MS);
  }

  const elapsed = Math.round((Date.now() - t0) / 1000);
  const summary = { ...results, targetCount: targets.length, elapsedSec: elapsed, at: new Date().toISOString() };
  const outPath = resolve(__dir, "../no-deadline-sync-local-result.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(`\n=== 완료 (${elapsed}s) ===`);
  console.log(`성공 ${results.ok}, 변경없음 ${results.noChange}, 제외 ${results.skip}, 실패 ${results.fail}`);
  console.log(`결과: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
