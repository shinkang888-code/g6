import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAnchorHash } from "./hardBindingHash";
import { ledgerAnchorProvider } from "./ledgerConfig";

export interface AnchorWorkerResult {
  anchored: number;
  errors: string[];
}

export async function runAnchorWorker(db: SupabaseClient): Promise<AnchorWorkerResult> {
  const result: AnchorWorkerResult = { anchored: 0, errors: [] };
  const provider = ledgerAnchorProvider();

  const { data: blocks, error } = await db
    .from("ledger_blocks")
    .select("id, block_hash, merkle_root, created_at")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  for (const block of blocks ?? []) {
    const { data: existing } = await db
      .from("ledger_anchors")
      .select("id")
      .eq("block_id", block.id)
      .maybeSingle();

    if (existing) continue;

    const timestamp = String(block.created_at);
    const anchorHash = computeAnchorHash(String(block.block_hash), timestamp);

    let externalBlockHeight: number | null = null;
    let externalTxId: string | null = null;
    let anchorProof: Record<string, unknown> = { method: provider, timestamp };

    if (provider === "opentimestamps") {
      const ots = await tryOpenTimestamps(String(block.block_hash));
      if (ots) {
        externalTxId = ots.submitHash;
        anchorProof = { ...anchorProof, ...ots };
      }
    }

    const { error: insErr } = await db.from("ledger_anchors").insert({
      block_id: block.id,
      merkle_root: block.merkle_root,
      anchor_hash: anchorHash,
      external_network: provider,
      external_block_height: externalBlockHeight,
      external_tx_id: externalTxId,
      anchor_proof: anchorProof,
    });

    if (insErr) {
      result.errors.push(insErr.message);
      continue;
    }
    result.anchored += 1;
  }

  return result;
}

async function tryOpenTimestamps(blockHash: string): Promise<{
  submitHash: string;
  calendar: string;
} | null> {
  const calendar =
    process.env.OPENTIMESTAMP_CALENDAR?.trim() ||
    "https://a.pool.opentimestamps.org";
  try {
    const digest = Buffer.from(blockHash, "hex");
    const res = await fetch(`${calendar}/digest`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: digest,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const submitHash = (await res.text()).trim();
    return { submitHash, calendar };
  } catch {
    return null;
  }
}
