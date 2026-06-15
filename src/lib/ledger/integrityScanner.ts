import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMerkleRoot, findTamperedLeafIndex } from "./merkleTree";
import { computeTransactionHash, computeAnchorHash } from "./hardBindingHash";
import { getIdentityHashById } from "./identityHash";

export interface IntegrityScanResult {
  scannedBlocks: number;
  scannedTx: number;
  alertsCreated: number;
  issues: string[];
}

export async function runIntegrityScan(db: SupabaseClient): Promise<IntegrityScanResult> {
  const result: IntegrityScanResult = {
    scannedBlocks: 0,
    scannedTx: 0,
    alertsCreated: 0,
    issues: [],
  };

  // 1단계: 거래 해시 체인 검증
  const { data: chainedTx } = await db
    .from("ledger_transactions")
    .select("id, tenant_id, stream, trans_data, h_v_id, prev_hash, tx_hash, seq, status")
    .in("status", ["chained", "block_assigned"])
    .order("seq", { ascending: true })
    .limit(500);

  const byStream = new Map<string, typeof chainedTx>();
  for (const tx of chainedTx ?? []) {
    const key = `${tx.tenant_id}:${tx.stream}`;
    if (!byStream.has(key)) byStream.set(key, []);
    byStream.get(key)!.push(tx);
  }

  for (const [, txs] of byStream) {
    if (!txs?.length) continue;
    let expectedPrev = txs[0]?.prev_hash as string;
    for (const tx of txs) {
      result.scannedTx += 1;
      const identity = await getIdentityHashById(db, tx.h_v_id as string);
      if (!identity) {
        await createAlert(db, tx.tenant_id as string, "missing_h_v", tx.id as string, {
          message: "신원 해시 H_v 누락",
        });
        result.alertsCreated += 1;
        continue;
      }
      const recomputed = computeTransactionHash(
        String(tx.prev_hash),
        tx.trans_data as Record<string, unknown>,
        identity.h_v
      );
      if (recomputed !== tx.tx_hash) {
        await createAlert(db, tx.tenant_id as string, "tx_hash_mismatch", tx.id as string, {
          expected: recomputed,
          stored: tx.tx_hash,
        });
        result.alertsCreated += 1;
        result.issues.push(`tx ${tx.id} hash mismatch`);
      }
      if (tx.prev_hash !== expectedPrev && tx !== txs[0]) {
        await createAlert(db, tx.tenant_id as string, "chain_break", tx.id as string, {
          expectedPrev,
          actualPrev: tx.prev_hash,
        });
        result.alertsCreated += 1;
      }
      expectedPrev = tx.tx_hash as string;
    }
  }

  // 2단계: Merkle 블록 검증
  const { data: blocks } = await db
    .from("ledger_blocks")
    .select("id, tenant_id, stream, merkle_root, block_hash")
    .order("created_at", { ascending: false })
    .limit(100);

  for (const block of blocks ?? []) {
    result.scannedBlocks += 1;
    const { data: blockTxs } = await db
      .from("ledger_transactions")
      .select("id, tx_hash")
      .eq("block_id", block.id)
      .order("seq", { ascending: true });

    const leaves = (blockTxs ?? []).map((t) => String(t.tx_hash));
    const computedRoot = buildMerkleRoot(leaves);
    if (computedRoot !== block.merkle_root) {
      const tamperIdx = findTamperedLeafIndex(leaves, String(block.merkle_root));
      const tamperTxId = tamperIdx !== null ? blockTxs?.[tamperIdx]?.id : null;
      await createAlert(db, block.tenant_id as string, "merkle_root_mismatch", tamperTxId ?? null, {
        blockId: block.id,
        computedRoot,
        storedRoot: block.merkle_root,
      });
      result.alertsCreated += 1;
      result.issues.push(`block ${block.id} merkle mismatch`);
    }
  }

  // 3단계: 앵커 검증
  const { data: anchors } = await db
    .from("ledger_anchors")
    .select("id, block_id, merkle_root, anchor_hash, ledger_blocks(tenant_id, block_hash, created_at)")
    .limit(100);

  for (const anchor of anchors ?? []) {
    const block = anchor.ledger_blocks as {
      tenant_id?: string;
      block_hash?: string;
      created_at?: string;
    } | null;
    if (!block?.block_hash) continue;
    const expected = computeAnchorHash(String(block.block_hash), String(block.created_at));
    if (expected !== anchor.anchor_hash) {
      await createAlert(db, String(block.tenant_id ?? ""), "anchor_mismatch", null, {
        anchorId: anchor.id,
        expected,
        stored: anchor.anchor_hash,
      });
      result.alertsCreated += 1;
    }
  }

  return result;
}

async function createAlert(
  db: SupabaseClient,
  tenantId: string,
  alertType: string,
  tamperTxId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  await db.from("ledger_integrity_alerts").insert({
    tenant_id: tenantId,
    alert_type: alertType,
    tamper_point_tx_id: tamperTxId,
    details,
    replay_status: "pending",
  });
}

export async function runReplayForAlert(
  db: SupabaseClient,
  alertId: string
): Promise<{ ok: boolean; message: string }> {
  const { data: alert } = await db
    .from("ledger_integrity_alerts")
    .select("*")
    .eq("id", alertId)
    .maybeSingle();

  if (!alert) return { ok: false, message: "알림 없음" };

  await db
    .from("ledger_integrity_alerts")
    .update({ replay_status: "running" })
    .eq("id", alertId);

  const scan = await runIntegrityScan(db);

  await db
    .from("ledger_integrity_alerts")
    .update({
      replay_status: scan.issues.length === 0 ? "completed" : "failed",
      resolved_at: scan.issues.length === 0 ? new Date().toISOString() : null,
      details: { ...((alert.details as object) ?? {}), replayScan: scan },
    })
    .eq("id", alertId);

  return {
    ok: scan.issues.length === 0,
    message: scan.issues.length === 0 ? "리플레이 검증 완료" : scan.issues.join("; "),
  };
}
