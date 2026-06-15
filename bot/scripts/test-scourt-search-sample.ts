/**
 * 나의사건검색 봇 조회 + 기일 파싱 검증 (로컬)
 * npx tsx bot/scripts/test-scourt-search-sample.ts
 *
 * bot/.env 에 Supabase 키, DDDDOCR_URL(선택) 설정 필요
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ParsingBot } from "../src/bot.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const SAMPLE = {
  courtName: "서울중앙지방법원",
  year: "2025",
  gubun: "가소",
  serial: "32949",
  partyName: "강준철",
};

async function main() {
  const bot = new ParsingBot();
  await bot.launch();
  try {
    const outcome = await bot.search(SAMPLE);
    const outPath = resolve(__dir, "../../tmp-scourt-sample-outcome.json");
    writeFileSync(outPath, JSON.stringify(outcome, null, 2), "utf8");
    console.log("saved:", outPath);

    if (!outcome.ok) {
      throw new Error(outcome.error ?? "조회 실패");
    }
    if (outcome.notFound) {
      throw new Error("사건을 찾지 못했습니다.");
    }
    const events = outcome.data?.events ?? [];
    console.log("case:", outcome.data?.caseNumber, outcome.data?.caseName);
    console.log("events:", events.length);
    if (events.length === 0) {
      console.log("warn: 기일 0건 — 사건에 최근기일이 없거나 소취하 등으로 비어 있을 수 있음");
    } else {
      console.log("sample event:", events[0]);
    }
    console.log("test-scourt-search-sample: passed");
  } finally {
    await bot.close();
  }
}

main().catch((e) => {
  console.error("test-scourt-search-sample: FAIL", e.message || e);
  process.exit(1);
});
