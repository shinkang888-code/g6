import type { SupabaseClient } from "@supabase/supabase-js";
import type { LedgerEnqueueInput } from "./types";
import { isLedgerEnabled } from "./ledgerConfig";

export async function ledgerEnqueue(
  db: SupabaseClient,
  input: LedgerEnqueueInput
): Promise<string | null> {
  if (!isLedgerEnabled()) return null;

  try {
    const { data, error } = await db
      .from("ledger_transactions")
      .insert({
        tenant_id: input.tenantId,
        stream: input.stream,
        source_table: input.sourceTable,
        source_id: input.sourceId ?? null,
        trans_data: {
          ...input.transData,
          _actorUserId: input.actorUserId ?? null,
          _actorLoginId: input.actorLoginId ?? null,
          _enqueuedAt: new Date().toISOString(),
        },
        h_v_id: input.hVId,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[ledger/enqueue]", error.message);
      return null;
    }
    return String(data.id);
  } catch (e) {
    console.error("[ledger/enqueue]", e);
    return null;
  }
}

export async function linkSourceToLedger(
  db: SupabaseClient,
  sourceTable: string,
  sourceId: string,
  ledgerTxId: string
): Promise<void> {
  const allowed = [
    "case_audit_logs",
    "approval_actions",
    "user_admin_audit_logs",
    "finance_entries",
  ];
  if (!allowed.includes(sourceTable)) return;
  const { error } = await db
    .from(sourceTable)
    .update({ ledger_tx_id: ledgerTxId })
    .eq("id", sourceId);
  if (error) console.error("[ledger/link]", error.message);
}
