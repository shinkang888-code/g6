/**
 * 병렬 조회 워커 풀
 * LawTop 의 LawTopParsingBotWV1/2/3.exe(여러 인스턴스 병렬)에 대응.
 * 단일 브라우저에서 N개의 컨텍스트를 동시 운용해 큐를 소진합니다.
 */
import { config } from "./config.js";
import { ParsingBot } from "./bot.js";
import type { SearchOutcome, SearchParams } from "./types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RunOptions {
  concurrency?: number;
  /** 1건 완료 시 콜백 (스트리밍 저장/로그용) */
  onResult?: (outcome: SearchOutcome, index: number) => void | Promise<void>;
}

/**
 * 여러 사건을 병렬로 조회.
 * @returns 입력 순서와 동일한 순서의 결과 배열
 */
export async function runBatch(
  jobs: SearchParams[],
  options: RunOptions = {}
): Promise<SearchOutcome[]> {
  const concurrency = Math.max(1, options.concurrency ?? config.concurrency);
  const bot = new ParsingBot();
  await bot.launch();

  const results: SearchOutcome[] = new Array(jobs.length);
  let cursor = 0;

  const worker = async (workerId: number) => {
    const ctx = await bot.newContext();
    try {
      while (true) {
        const index = cursor++;
        if (index >= jobs.length) break;
        const job = jobs[index];
        const outcome = await bot.search(job, ctx);
        results[index] = outcome;
        await options.onResult?.(outcome, index);
        // 차단 회피: 요청 간 간격
        await sleep(config.requestDelayMs);
      }
    } finally {
      await ctx.close().catch(() => {});
      void workerId;
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, jobs.length) }, (_v, i) => worker(i))
    );
  } finally {
    await bot.close();
  }

  return results;
}
