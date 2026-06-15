import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/authSession";
import { recordLedgerEvent } from "@/lib/ledger/ledgerRecord";

export type UserAuditAction =
  | "create"
  | "update"
  | "approve"
  | "hold"
  | "reject"
  | "resign"
  | "exclude"
  | "reactivate"
  | "password_reset"
  | "permission_change"
  | "hard_delete";

export async function logUserAdminAction(
  db: SupabaseClient,
  params: {
    targetLoginId: string;
    actorLoginId: string;
    action: UserAuditAction;
    summary?: string;
    changes?: Record<string, unknown>;
    tenantId?: string;
    session?: SessionPayload | null;
  }
): Promise<void> {
  let tenantId = params.tenantId?.trim() || params.session?.managementNumber?.trim();
  if (!tenantId && params.actorLoginId) {
    const { data: actor } = await db
      .from("site_users")
      .select("management_number")
      .eq("login_id", params.actorLoginId)
      .maybeSingle();
    tenantId = actor?.management_number?.trim();
  }

  const { data: inserted, error } = await db
    .from("user_admin_audit_logs")
    .insert({
      target_login_id: params.targetLoginId,
      actor_login_id: params.actorLoginId,
      action: params.action,
      summary: params.summary ?? null,
      changes: params.changes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[user_admin_audit]", error.message);
    return;
  }

  if (tenantId && inserted?.id) {
    await recordLedgerEvent(db, {
      tenantId,
      stream: "user_admin",
      sourceTable: "user_admin_audit_logs",
      sourceId: String(inserted.id),
      session: params.session,
      actorLoginId: params.actorLoginId,
      transData: {
        targetLoginId: params.targetLoginId,
        action: params.action,
        summary: params.summary,
        changes: params.changes,
      },
    });
  }
}
