/**
 * CLI 진입점
 *
 * 단일 조회:
 *   npm run search -- --court "대구지방법원" --year 2025 --gubun 노 --serial 5285 --party 이선아
 *
 * 배치 조회(JSON 파일: SearchParams[] 배열):
 *   npm run search -- --file jobs.json
 *
 * 옵션:
 *   --save      결과를 Supabase 에 저장 (환경변수 필요)
 *   --out FILE  결과를 JSON 파일로 저장
 */
import { readFile, writeFile } from "node:fs/promises";
import { config } from "./config.js";
import { runBatch } from "./pool.js";
import { saveCaseResult } from "./store.js";
import type { SearchOutcome, SearchParams } from "./types.js";

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

async function loadJobs(args: Record<string, string | boolean>): Promise<SearchParams[]> {
  if (typeof args.file === "string") {
    const raw = await readFile(args.file, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("배치 파일은 SearchParams 배열이어야 합니다.");
    return parsed as SearchParams[];
  }
  const single: SearchParams = {
    courtName: String(args.court ?? ""),
    year: String(args.year ?? ""),
    gubun: String(args.gubun ?? ""),
    serial: String(args.serial ?? ""),
    partyName: String(args.party ?? ""),
    matchCaseId: typeof args.matchCaseId === "string" ? args.matchCaseId : undefined,
  };
  if (!single.courtName || !single.year || !single.gubun || !single.serial || !single.partyName) {
    throw new Error(
      "필수 인자 누락: --court --year --gubun --serial --party (또는 --file jobs.json)"
    );
  }
  return [single];
}

function logOutcome(o: SearchOutcome, i: number): void {
  const tag = `[${i + 1}] ${o.params.year}${o.params.gubun}${o.params.serial} (${o.params.partyName})`;
  if (!o.ok) {
    console.error(`${tag} ✗ 오류: ${o.error}`);
    return;
  }
  if (o.notFound) {
    console.warn(`${tag} - 조회 결과 없음 (캡차 ${o.captchaAttempts}회)`);
    return;
  }
  console.log(`${tag} ✓ ${o.data?.caseNumber} | ${o.data?.caseName ?? ""}`);
  if (o.data?.rawLine) console.log(`     ${o.data.rawLine}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jobs = await loadJobs(args);
  const doSave = Boolean(args.save);

  console.log(
    `파싱봇 시작: ${jobs.length}건 | 동시 ${config.concurrency} | OCR=${config.ocr.provider} | 저장=${
      doSave && config.supabase.enabled ? "on" : "off"
    }`
  );
  console.log(`대상 폼: ${config.formUrl}\n`);

  const results = await runBatch(jobs, {
    onResult: async (o, i) => {
      logOutcome(o, i);
      if (doSave && o.ok && o.data && !o.notFound) {
        const r = await saveCaseResult(o.data);
        if (!r.saved) console.log(`     (저장 생략: ${r.reason})`);
      }
    },
  });

  if (typeof args.out === "string") {
    await writeFile(args.out, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n결과 저장: ${args.out}`);
  }

  const ok = results.filter((r) => r.ok && !r.notFound).length;
  const nf = results.filter((r) => r.notFound).length;
  const err = results.filter((r) => !r.ok).length;
  console.log(`\n완료 — 성공 ${ok} / 결과없음 ${nf} / 오류 ${err}`);
}

main().catch((e) => {
  console.error("치명적 오류:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
