import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "./cryptoUtils";
import { computeAgreementHash } from "./hardBindingHash";
import { ledgerEnqueue, linkSourceToLedger } from "./ledgerEnqueue";

export type NegotiationEventType = "proposal" | "revision" | "agreement";

export function hashNegotiationEvent(
  eventType: NegotiationEventType,
  approvalId: string,
  payload: Record<string, unknown>
): string {
  return sha256Hex(`${eventType}|${approvalId}|${JSON.stringify(payload)}`);
}

export async function recordApprovalLedgerEvent(
  db: SupabaseClient,
  params: {
    tenantId: string;
    hVId: string;
    approvalId: string;
    actionId: string;
    action: string;
    actorUserId: string;
    actorLoginId?: string;
    comment?: string | null;
    docTitle?: string;
  }
): Promise<string | null> {
  const eventType: NegotiationEventType =
    params.action === "submit"
      ? "proposal"
      : params.action === "approve" && params.comment
        ? "revision"
        : params.action === "approve"
          ? "agreement"
          : "revision";

  const eventHash = hashNegotiationEvent(eventType, params.approvalId, {
    action: params.action,
    actorUserId: params.actorUserId,
    comment: params.comment,
  });

  const ledgerTxId = await ledgerEnqueue(db, {
    tenantId: params.tenantId,
    stream: "approval",
    sourceTable: "approval_actions",
    sourceId: params.actionId,
    hVId: params.hVId,
    actorUserId: params.actorUserId,
    actorLoginId: params.actorLoginId,
    transData: {
      approvalId: params.approvalId,
      action: params.action,
      eventType,
      eventHash,
      docTitle: params.docTitle,
      comment: params.comment,
    },
  });

  if (ledgerTxId) {
    await linkSourceToLedger(db, "approval_actions", params.actionId, ledgerTxId);
  }
  return ledgerTxId;
}

export async function finalizeApprovalAgreement(
  db: SupabaseClient,
  approvalId: string,
  finalState: Record<string, unknown>
): Promise<string | null> {
  const { data: actions } = await db
    .from("approval_actions")
    .select("action, created_at, actor_id")
    .eq("approval_id", approvalId)
    .order("created_at", { ascending: true });

  if (!actions?.length) return null;

  const proposal = actions.find((a) => a.action === "submit");
  const proposalHash = proposal
    ? hashNegotiationEvent("proposal", approvalId, { action: "submit" })
    : sha256Hex("no_proposal");

  const revisionHashes = actions
    .filter((a) => a.action !== "submit" && a.action !== "approve")
    .map((a) => hashNegotiationEvent("revision", approvalId, { action: a.action }));

  const agreementHash = computeAgreementHash(proposalHash, revisionHashes, finalState);

  await db.from("approvals").update({ agreement_hash: agreementHash }).eq("id", approvalId);
  return agreementHash;
}
