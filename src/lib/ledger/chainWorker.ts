import type { SupabaseClient } from "@supabase/supabase-js";
import { GENESIS_HASH, computeTransactionHash } from "./hardBindingHash";
import { getIdentityHashById } from "./identityHash";

export interface ChainWorkerResult {
  processed: number;
  errors: string[];
}

export async function runChainWorker(db: SupabaseClient): Promise<ChainWorkerResult> {
  const result: ChainWorkerResult = { processed: 0, errors: [] };

  const { data: pending, error } = await db
    .from("ledger_transactions")
    .select("id, tenant_id, stream, trans_data, h_v_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    result.errors.push(error.message);
    return result;
  }
  if (!pending?.length) return result;

  const chainHeads = new Map<string, { hash: string; seq: number }>();

  for (const tx of pending) {
    const key = `${tx.tenant_id}:${tx.stream}`;
    if (!chainHeads.has(key)) {
      const head = await loadChainHead(db, tx.tenant_id as string, tx.stream as string);
      chainHeads.set(key, head);
    }
    const head = chainHeads.get(key)!;

    const identity = await getIdentityHashById(db, tx.h_v_id as string);
    if (!identity) {
      result.errors.push(`missing H_v for tx ${tx.id}`);
      continue;
    }

    const txHash = computeTransactionHash(
      head.hash,
      tx.trans_data as Record<string, unknown>,
      identity.h_v
    );
    const nextSeq = head.seq + 1;

    const { error: rpcErr } = await db.rpc("ledger_chain_transaction", {
      p_tx_id: tx.id,
      p_prev_hash: head.hash,
      p_tx_hash: txHash,
      p_seq: nextSeq,
    });

    if (rpcErr) {
      result.errors.push(rpcErr.message);
      continue;
    }

    chainHeads.set(key, { hash: txHash, seq: nextSeq });
    result.processed += 1;
  }

  return result;
}

async function loadChainHead(
  db: SupabaseClient,
  tenantId: string,
  stream: string
): Promise<{ hash: string; seq: number }> {
  const { data } = await db
    .from("ledger_transactions")
    .select("tx_hash, seq")
    .eq("tenant_id", tenantId)
    .eq("stream", stream)
    .in("status", ["chained", "block_assigned"])
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.tx_hash) {
    return { hash: String(data.tx_hash), seq: Number(data.seq ?? 0) };
  }
  return { hash: GENESIS_HASH, seq: 0 };
}
