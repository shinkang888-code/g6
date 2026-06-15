import type { SupabaseClient } from "@supabase/supabase-js";
import { isLedgerEnabled } from "./ledgerConfig";
import type { LedgerOverviewStats } from "./types";

export async function getLedgerOverview(db: SupabaseClient): Promise<LedgerOverviewStats> {
  if (!isLedgerEnabled()) {
    return {
      enabled: false,
      identityCount: 0,
      txPending: 0,
      txChained: 0,
      txBlockAssigned: 0,
      txTampered: 0,
      blockCount: 0,
      anchorCount: 0,
      alertOpen: 0,
      lastBlockAt: null,
      lastAnchorAt: null,
      streams: [],
      health: "disabled",
      healthMessage: "LEDGER_ENABLED=false — 분산 원장 비활성",
    };
  }

  const [
    identityRes,
    pendingRes,
    chainedRes,
    blockAssignedRes,
    tamperedRes,
    blockCountRes,
    anchorCountRes,
    alertRes,
    lastBlockRes,
    lastAnchorRes,
    streamRes,
  ] = await Promise.all([
    db.from("identity_verification_hashes").select("id", { count: "exact", head: true }),
    db.from("ledger_transactions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("ledger_transactions").select("id", { count: "exact", head: true }).eq("status", "chained"),
    db.from("ledger_transactions").select("id", { count: "exact", head: true }).eq("status", "block_assigned"),
    db.from("ledger_transactions").select("id", { count: "exact", head: true }).eq("status", "tampered"),
    db.from("ledger_blocks").select("id", { count: "exact", head: true }),
    db.from("ledger_anchors").select("id", { count: "exact", head: true }),
    db.from("ledger_integrity_alerts").select("id", { count: "exact", head: true }).is("resolved_at", null),
    db.from("ledger_blocks").select("created_at").order("created_at", { ascending: false }).limit(1),
    db.from("ledger_anchors").select("anchored_at").order("anchored_at", { ascending: false }).limit(1),
    db.from("ledger_transactions").select("stream, status"),
  ]);

  const txPending = pendingRes.count ?? 0;
  const txChained = chainedRes.count ?? 0;
  const alertOpen = alertRes.count ?? 0;
  const txTampered = tamperedRes.count ?? 0;

  const streamMap = new Map<string, { pending: number; chained: number; blocks: number }>();
  for (const row of streamRes.data ?? []) {
    const s = String(row.stream);
    if (!streamMap.has(s)) streamMap.set(s, { pending: 0, chained: 0, blocks: 0 });
    const entry = streamMap.get(s)!;
    if (row.status === "pending") entry.pending += 1;
    if (row.status === "chained") entry.chained += 1;
  }

  const { data: blockStreams } = await db.from("ledger_blocks").select("stream");
  for (const b of blockStreams ?? []) {
    const s = String(b.stream);
    if (!streamMap.has(s)) streamMap.set(s, { pending: 0, chained: 0, blocks: 0 });
    streamMap.get(s)!.blocks += 1;
  }

  let health: LedgerOverviewStats["health"] = "healthy";
  let healthMessage = "모든 원장 파이프라인 정상";

  if (txTampered > 0 || alertOpen > 0) {
    health = "critical";
    healthMessage = `변조·무결성 알림 ${alertOpen}건, tampered ${txTampered}건`;
  } else if (txPending > 50) {
    health = "degraded";
    healthMessage = `대기 중인 거래 ${txPending}건 — 워커 지연 가능`;
  }

  return {
    enabled: true,
    identityCount: identityRes.count ?? 0,
    txPending,
    txChained,
    txBlockAssigned: blockAssignedRes.count ?? 0,
    txTampered,
    blockCount: blockCountRes.count ?? 0,
    anchorCount: anchorCountRes.count ?? 0,
    alertOpen,
    lastBlockAt: lastBlockRes.data?.[0]?.created_at ?? null,
    lastAnchorAt: lastAnchorRes.data?.[0]?.anchored_at ?? null,
    streams: [...streamMap.entries()].map(([stream, v]) => ({ stream, ...v })),
    health,
    healthMessage,
  };
}
