/**
 * 연동 가능 진행중 사건 일괄 기일연동
 * node scripts/bulk-court-sync.mjs [--limit=N] [--base=URL]
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = (
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ||
  process.env.BASE_URL ||
  "https://lawygo.vercel.app"
).replace(/\/$/, "");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");

let cookie = "";

async function auth() {
  const res = await fetch(`${BASE}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  return res.ok;
}

async function main() {
  console.log(`=== 일괄 기일연동 ===\nBASE: ${BASE}\n`);

  if (!(await auth())) {
    console.error("데모 로그인 실패");
    process.exit(1);
  }

  const listRes = await fetch(`${BASE}/api/cases/sync-deadlines?status=진행중`, {
    headers: { Cookie: cookie },
  });
  const listJson = await listRes.json();
  if (!listRes.ok) {
    console.error("목록 조회 실패:", listJson.error);
    process.exit(1);
  }

  let cases = listJson.cases ?? [];
  if (LIMIT > 0) cases = cases.slice(0, LIMIT);
  console.log(`대상: ${cases.length}건 (전체 syncable ${listJson.syncable ?? "?"})\n`);

  const results = { ok: 0, fail: 0, skip: 0, noChange: 0, errors: [] };
  const t0 = Date.now();

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const label = `${c.caseNumber}`;
    process.stdout.write(`[${i + 1}/${cases.length}] ${label} … `);
    try {
      const res = await fetch(`${BASE}/api/cases/sync-deadlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ caseId: c.id }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.skippedNoChange) {
          results.noChange++;
          console.log("변경없음");
        } else {
          results.ok++;
          console.log(
            `OK +${json.eventsAdded ?? 0} ~${json.eventsUpdated ?? 0} -${json.eventsRemoved ?? 0}`
          );
        }
      } else if (json.skipped) {
        results.skip++;
        console.log(`SKIP ${json.skipReason ?? json.error}`);
      } else {
        results.fail++;
        const err = json.error ?? res.status;
        results.errors.push({ caseNumber: c.caseNumber, error: err });
        console.log(`FAIL ${err}`);
      }
    } catch (e) {
      results.fail++;
      const err = e instanceof Error ? e.message : String(e);
      results.errors.push({ caseNumber: c.caseNumber, error: err });
      console.log(`ERR ${err}`);
    }
  }

  const elapsed = Math.round((Date.now() - t0) / 1000);
  const summary = { ...results, elapsedSec: elapsed, base: BASE, at: new Date().toISOString() };
  const outPath = resolve(__dir, "../bulk-sync-result.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(`\n=== 완료 (${elapsed}s) ===`);
  console.log(`성공 ${results.ok}, 변경없음 ${results.noChange}, 제외 ${results.skip}, 실패 ${results.fail}`);
  console.log(`결과 저장: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
