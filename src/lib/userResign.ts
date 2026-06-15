/**
 * 퇴사/제외 처리 — site_users 삭제로 동일 ID·Google 계정 재가입 허용
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import { isRelinquishedUserStatus, type ResignType } from "@/lib/userAdmin";

type ResignUserRef = {
  id: string;
  login_id: string;
  management_number?: string | null;
  status?: string | null;
};

async function purgeUserSideRecords(db: SupabaseClient, loginId: string): Promise<void> {
  try {
    await db.from("staff").delete().eq("login_id", loginId);
  } catch {
    /* staff 없거나 삭제 실패해도 계정 삭제 진행 */
  }

  try {
    await db.from("user_memos").delete().eq("login_id", loginId);
  } catch {
    /* 메모 없거나 삭제 실패해도 계정 삭제 진행 */
  }
}

export async function deleteUserAccountForResign(
  db: SupabaseClient,
  user: ResignUserRef,
  opts: {
    actorLoginId: string;
    type: ResignType;
    reason?: string | null;
    auditSummary?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { type, reason, actorLoginId, auditSummary } = opts;
  const loginId = user.login_id;

  await purgeUserSideRecords(db, loginId);

  const { error: delErr } = await db.from("site_users").delete().eq("id", user.id);
  if (delErr) {
    return { ok: false, error: delErr.message };
  }

  await logUserAdminAction(db, {
    targetLoginId: loginId,
    actorLoginId,
    action: type === "excluded" ? "exclude" : "resign",
    summary:
      auditSummary ??
      (type === "excluded"
        ? "제외 처리 · 계정 삭제 (재가입 가능)"
        : "퇴사 처리 · 계정 삭제 (재가입 가능)"),
    changes: {
      reason: reason ?? null,
      deletedUserId: user.id,
      management_number: user.management_number ?? null,
      previousStatus: user.status ?? null,
      hardDelete: true,
    },
  });

  return { ok: true };
}

/** 퇴사·제외 잔존 계정을 삭제해 동일 아이디/Google로 재가입 가능하게 함 */
export async function purgeRelinquishedAccountForRejoin(
  db: SupabaseClient,
  user: ResignUserRef,
  opts?: { actorLoginId?: string; reason?: string | null }
): Promise<{ ok: true; cleared: true } | { ok: false; error: string } | { ok: true; cleared: false }> {
  if (!isRelinquishedUserStatus(user.status)) {
    return { ok: true, cleared: false };
  }

  const type: ResignType = user.status === "excluded" ? "excluded" : "resigned";
  const result = await deleteUserAccountForResign(db, user, {
    actorLoginId: opts?.actorLoginId ?? "system-rejoin",
    type,
    reason: opts?.reason ?? "재가입을 위한 퇴사·제외 계정 정리",
    auditSummary: "퇴사·제외 계정 정리 (재가입 허용)",
  });

  if (!result.ok) return result;
  return { ok: true, cleared: true };
}
