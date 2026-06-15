import type { SupabaseClient } from "@supabase/supabase-js";
import { isLedgerEnabled } from "./ledgerConfig";
import { runChainWorker } from "./chainWorker";
import { runBlockWorker } from "./blockBuilder";
import { runAnchorWorker } from "./externalAnchor";
import { runIntegrityScan } from "./integrityScanner";

export interface LedgerWorkerRunResult {
  enabled: boolean;
  chain: { processed: number; errors: string[] };
  block: { blocksCreated: number; errors: string[] };
  anchor: { anchored: number; errors: string[] };
  integrity?: { scannedBlocks: number; scannedTx: number; alertsCreated: number; issues: string[] };
  durationMs: number;
}

export async function runAllLedgerWorkers(
  db: SupabaseClient,
  options?: { includeIntegrityScan?: boolean }
): Promise<LedgerWorkerRunResult> {
  const start = Date.now();
  if (!isLedgerEnabled()) {
    return {
      enabled: false,
      chain: { processed: 0, errors: [] },
      block: { blocksCreated: 0, errors: [] },
      anchor: { anchored: 0, errors: [] },
      durationMs: 0,
    };
  }

  const chain = await runChainWorker(db);
  const block = await runBlockWorker(db);
  const anchor = await runAnchorWorker(db);
  let integrity;
  if (options?.includeIntegrityScan) {
    integrity = await runIntegrityScan(db);
  }

  return {
    enabled: true,
    chain,
    block,
    anchor,
    integrity,
    durationMs: Date.now() - start,
  };
}
