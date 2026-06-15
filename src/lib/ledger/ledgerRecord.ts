import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/authSession";
import type { LedgerStream } from "./types";
import { ledgerEnqueue, linkSourceToLedger } from "./ledgerEnqueue";
import { getLatestIdentityHashForUser, getOrCreateSystemIdentityHash } from "./identityHash";
import { isLedgerEnabled } from "./ledgerConfig";

export async function resolveHVIdForSession(
  db: SupabaseClient,
  session: SessionPayload | null | undefined,
  tenantId: string
): Promise<string | null> {
  if (session?.hVId) return session.hVId;
  if (!session?.userId) {
    const system = await getOrCreateSystemIdentityHash(db, tenantId);
    return system?.id ?? null;
  }
  const latest = await getLatestIdentityHashForUser(db, tenantId, session.userId);
  return latest?.id ?? null;
}

export async function recordLedgerEvent(
  db: SupabaseClient,
  params: {
    tenantId?: string;
    stream: LedgerStream;
    sourceTable: string;
    sourceId: string;
    transData: Record<string, unknown>;
    session?: SessionPayload | null;
    actorUserId?: string;
    actorLoginId?: string;
  }
): Promise<string | null> {
  if (!isLedgerEnabled()) return null;

  const tenantId = params.tenantId?.trim() || params.session?.managementNumber?.trim();
  if (!tenantId) return null;

  const hVId = await resolveHVIdForSession(db, params.session, tenantId);
  if (!hVId) return null;

  const ledgerTxId = await ledgerEnqueue(db, {
    tenantId,
    stream: params.stream,
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
    transData: params.transData,
    hVId,
    actorUserId: params.actorUserId ?? params.session?.userId,
    actorLoginId: params.actorLoginId ?? params.session?.loginId,
  });

  if (ledgerTxId) {
    await linkSourceToLedger(db, params.sourceTable, params.sourceId, ledgerTxId);
  }
  return ledgerTxId;
}
