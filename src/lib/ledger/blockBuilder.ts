import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMerkleRoot } from "./merkleTree";
import { computeBlockHash, GENESIS_HASH } from "./hardBindingHash";
import { ledgerBlockTxThreshold } from "./ledgerConfig";

export interface BlockWorkerResult {
  blocksCreated: number;
  errors: string[];
}

export async function runBlockWorker(db: SupabaseClient): Promise<BlockWorkerResult> {
  const result: BlockWorkerResult = { blocksCreated: 0, errors: [] };
  const threshold = ledgerBlockTxThreshold();

  const { data: groups, error } = await db
    .from("ledger_transactions")
    .select("tenant_id, stream")
    .eq("status", "chained")
    .is("block_id", null);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const keys = new Set(
    (groups ?? []).map((g) => `${g.tenant_id}:${g.stream}`)
  );

  for (const key of keys) {
    const [tenantId, stream] = key.split(":");
    const { data: txs } = await db
      .from("ledger_transactions")
      .select("id, tx_hash")
      .eq("tenant_id", tenantId)
      .eq("stream", stream)
      .eq("status", "chained")
      .is("block_id", null)
      .order("seq", { ascending: true })
      .limit(threshold);

    if (!txs?.length) continue;

    const leaves = txs.map((t) => String(t.tx_hash));
    const merkleRoot = buildMerkleRoot(leaves);
    const now = new Date().toISOString();

    const { data: lastBlock } = await db
      .from("ledger_blocks")
      .select("block_height, block_hash")
      .eq("tenant_id", tenantId)
      .eq("stream", stream)
      .order("block_height", { ascending: false })
      .limit(1)
      .maybeSingle();

    const blockHeight = lastBlock ? Number(lastBlock.block_height) + 1 : 1;
    const prevBlockHash = lastBlock ? String(lastBlock.block_hash) : GENESIS_HASH;
    const blockHash = computeBlockHash(prevBlockHash, merkleRoot, blockHeight, now);

    const { data: block, error: blockErr } = await db
      .from("ledger_blocks")
      .insert({
        tenant_id: tenantId,
        stream,
        block_height: blockHeight,
        prev_block_hash: prevBlockHash,
        merkle_root: merkleRoot,
        block_hash: blockHash,
        tx_count: txs.length,
      })
      .select("id")
      .single();

    if (blockErr || !block) {
      result.errors.push(blockErr?.message ?? "block insert failed");
      continue;
    }

    const txIds = txs.map((t) => t.id);
    const { error: assignErr } = await db.rpc("ledger_assign_block", {
      p_tx_ids: txIds,
      p_block_id: block.id,
    });

    if (assignErr) {
      result.errors.push(assignErr.message);
      continue;
    }

    result.blocksCreated += 1;
  }

  return result;
}
