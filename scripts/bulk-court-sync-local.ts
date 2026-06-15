/**
 * 진행중·연동 가능 사건 전체 기일연동 (로컬 직접 호출, rate limit 회피)
 * npx tsx scripts/bulk-court-sync-local.ts [--limit=N] [--delay=4000]
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
const USER_ID = "bulk-court-sync";

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

  const all: Array<{
    id: string;
    case_number: string;
    court: string;
    client_name: string;
  }> = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("cases")
      .select("id, case_number, court, client_name")
      .eq("status", "진행중")
      .order("case_number", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...(data as typeof all));
    if (data.length < pageSize) break;
  }

  let targets = all.filter((c) => {
    const built = buildScourtJobFromCase({
      id: c.id,
      case_number: c.case_number,
      court: c.court,
      client_name: c.client_name,
    });
    return !("error" in built);
  });

  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  console.log(`=== 전체 기일연동 (로컬) ===`);
  console.log(`진행중 ${all.length}건 중 연동 가능 ${targets.length}건, 간격 ${DELAY_MS}ms\n`);

  const results = {
    ok: 0,
    fail: 0,
    skip: 0,
    noChange: 0,
    errors: [] as { caseNumber: string; error: string }[],
  };
  const t0 = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const label = String(c.case_number);
    process.stdout.write(`[${i + 1}/${targets.length}] ${label} … `);
    try {
      const r = await syncCaseDeadlines(c.id, USER_ID);
      if (r.ok) {
        if (r.skippedNoChange) {
          results.noChange++;
          console.log("변경없음");
        } else {
          results.ok++;
          console.log(
            `OK +${r.eventsAdded ?? 0} ~${r.eventsUpdated ?? 0} -${r.eventsRemoved ?? 0}`
          );
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
  const summary = {
    ...results,
    totalProgress: all.length,
    targetCount: targets.length,
    elapsedSec: elapsed,
    at: new Date().toISOString(),
  };
  const outPath = resolve(__dir, "../bulk-sync-result.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(`\n=== 완료 (${elapsed}s) ===`);
  console.log(`성공 ${results.ok}, 변경없음 ${results.noChange}, 제외 ${results.skip}, 실패 ${results.fail}`);
  console.log(`결과: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
