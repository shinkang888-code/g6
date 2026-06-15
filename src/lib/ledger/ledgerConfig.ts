export function isLedgerEnabled(): boolean {
  const v = process.env.LEDGER_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

export function ledgerBlockIntervalMin(): number {
  const n = Number(process.env.LEDGER_BLOCK_INTERVAL_MIN ?? "15");
  return Number.isFinite(n) && n > 0 ? n : 15;
}

export function ledgerBlockTxThreshold(): number {
  const n = Number(process.env.LEDGER_BLOCK_TX_THRESHOLD ?? "50");
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export function ledgerAnchorProvider(): string {
  return process.env.LEDGER_ANCHOR_PROVIDER?.trim() || "lawygo_timestamp_v1";
}
