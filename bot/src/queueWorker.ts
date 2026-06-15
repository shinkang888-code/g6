/**
 * Supabase 작업 큐 워커 — 로컬 PC에서 상시 실행
 *   npm run queue
 *
 * Vercel /api/court-case 가 scourt_search_jobs 에 INSERT
 * → 이 워커가 pending 작업을 가져와 Playwright 봇 실행 → result UPDATE
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hostname } from "node:os";
import { config } from "./config.js";
import { ParsingBot } from "./bot.js";
import { saveCaseResult } from "./store.js";
import { normalizePartyNameForScourt } from "./partyName.js";
import type { SearchOutcome, SearchParams } from "./types.js";

const WORKER_ID = `${hostname()}-${process.pid}`;
const POLL_MS = Number(process.env.QUEUE_POLL_MS) || 3000;

type Db = SupabaseClient;

function getDb(): Db {
  if (!config.supabase.enabled) {
    throw new Error("Supabase 미설정. bot/.env 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 넣으세요.");
  }
  return createClient(config.supabase.url, config.supabase.serviceKey);
}

async function claimNext(db: Db) {
  const { data: pending } = await db
    .from("scourt_search_jobs")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  const id = (pending as { id: string }[] | null)?.[0]?.id;
  if (!id) return null;

  const { data: claimed } = await db
    .from("scourt_search_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      worker_id: WORKER_ID,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  return claimed as Record<string, unknown> | null;
}

async function finish(db: Db, id: string, outcome: SearchOutcome) {
  const slim = { ...outcome };
  delete (slim as { rawHtml?: string }).rawHtml;

  await db
    .from("scourt_search_jobs")
    .update({
      status: outcome.ok ? "done" : "failed",
      result: outcome.ok ? slim : null,
      error: outcome.ok ? null : outcome.error ?? "unknown",
      captcha_attempts: outcome.captchaAttempts ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function main() {
  const db = getDb();
  const bot = new ParsingBot();
  await bot.launch();
  console.log(`[queue-worker] ${WORKER_ID} polling every ${POLL_MS}ms`);

  const loop = async () => {
    try {
      const row = await claimNext(db);
      if (!row) return;

      const raw = row.params as SearchParams;
      const params: SearchParams = {
        ...raw,
        partyName: normalizePartyNameForScourt(raw.partyName) || raw.partyName,
      };
      const save = Boolean(row.save_to_case);
      if (row.match_case_id && !params.matchCaseId) {
        params.matchCaseId = String(row.match_case_id);
      }

      console.log(`[queue-worker] job ${row.id} ${params.year}${params.gubun}${params.serial} party=${params.partyName}`);
      const outcome = await bot.search(params);

      if (save && outcome.ok && outcome.data && !outcome.notFound) {
        await saveCaseResult(outcome.data).catch(() => {});
      }

      await finish(db, String(row.id), outcome);
      console.log(`[queue-worker] job ${row.id} → ${outcome.ok ? (outcome.notFound ? "notFound" : "ok") : "fail"}`);
    } catch (e) {
      console.error("[queue-worker]", e instanceof Error ? e.message : e);
    }
  };

  setInterval(loop, POLL_MS);
  await loop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
