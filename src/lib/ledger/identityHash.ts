import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "./cryptoUtils";

export interface IdentityHashRecord {
  id: string;
  h_v: string;
  tenant_id: string;
  user_id: string;
  verified_at: string;
}

/** H_v = Hash(UserID + VerificationResult + Timestamp) */
export function computeIdentityHash(
  userId: string,
  verificationResult: "approved",
  verifiedAt: string
): string {
  return sha256Hex(`${userId}|${verificationResult}|${verifiedAt}`);
}

export async function createIdentityHash(
  db: SupabaseClient,
  params: {
    tenantId: string;
    userId: string;
    sessionRef?: string;
    verifiedAt?: string;
  }
): Promise<IdentityHashRecord | null> {
  const verifiedAt = params.verifiedAt ?? new Date().toISOString();
  const h_v = computeIdentityHash(params.userId, "approved", verifiedAt);

  const { data, error } = await db
    .from("identity_verification_hashes")
    .insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      verification_result: "approved",
      verified_at: verifiedAt,
      h_v,
      session_ref: params.sessionRef ?? null,
    })
    .select("id, h_v, tenant_id, user_id, verified_at")
    .single();

  if (error) {
    console.error("[ledger/identityHash]", error.message);
    return null;
  }
  return data as IdentityHashRecord;
}

/** 시스템·배치 작업용 신원 (재무 자동 동기화 등) */
export async function getOrCreateSystemIdentityHash(
  db: SupabaseClient,
  tenantId: string
): Promise<IdentityHashRecord | null> {
  const systemUserId = `system:${tenantId}`;
  const { data: existing } = await db
    .from("identity_verification_hashes")
    .select("id, h_v, tenant_id, user_id, verified_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", systemUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as IdentityHashRecord;

  return createIdentityHash(db, {
    tenantId,
    userId: systemUserId,
    sessionRef: "system",
  });
}

export async function getIdentityHashById(
  db: SupabaseClient,
  hVId: string
): Promise<{ h_v: string } | null> {
  const { data } = await db
    .from("identity_verification_hashes")
    .select("h_v")
    .eq("id", hVId)
    .maybeSingle();
  return data as { h_v: string } | null;
}

export async function getLatestIdentityHashForUser(
  db: SupabaseClient,
  tenantId: string,
  userId: string
): Promise<IdentityHashRecord | null> {
  const { data } = await db
    .from("identity_verification_hashes")
    .select("id, h_v, tenant_id, user_id, verified_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as IdentityHashRecord) ?? null;
}
