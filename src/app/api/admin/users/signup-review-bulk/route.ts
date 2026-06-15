/**
 * 가입 심사 일괄 처리 — 승인 / 보류 / 삭제(거절·미승인 계정 제거)
 * POST { ids: string[], action: "approve" | "hold" | "delete", comment?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { defaultPermissionRoleId } from "@/lib/userAdmin";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import { requireAdminSession } from "@/lib/adminSession";
import { assertUserManageableByAdmin } from "@/lib/companyRegistryAuth";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { resolveApprovalAdminFields } from "@/lib/tenantUser";
import { COMPANY_ADMIN_ROLE_ID } from "@/lib/adminRoles";

const REVIEWABLE = new Set(["pending", "on_hold", "rejected"]);
const DELETABLE = new Set(["pending", "on_hold", "rejected"]);

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });
  }

  let body: { ids?: string[]; action?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const ids = [...new Set((body.ids ?? []).map((id) => String(id).trim()).filter(Boolean))];
  const action = (body.action ?? "").trim();
  const comment = (body.comment ?? "").trim();

  if (!ids.length) {
    return NextResponse.json({ error: "처리할 회원을 선택하세요." }, { status: 400 });
  }
  if (!["approve", "hold", "delete"].includes(action)) {
    return NextResponse.json({ error: "action은 approve, hold, delete 중 하나여야 합니다." }, { status: 400 });
  }

  let processed = 0;
  const errors: string[] = [];

  for (const id of ids) {
    const access = await assertUserManageableByAdmin(db, session, id);
    if (!access.allowed) {
      errors.push(`${id}: 권한 없음`);
      continue;
    }

    const { data: user } = await db
      .from("site_users")
      .select("id, login_id, role, permission_role_id, status, profile, name, department, email, phone, management_number")
      .eq("id", id)
      .maybeSingle();

    if (!user) {
      errors.push(`${id}: 없음`);
      continue;
    }

    if (action === "delete") {
      if (!DELETABLE.has(String(user.status))) {
        errors.push(`${user.login_id}: 삭제 불가 상태`);
        continue;
      }
      const { error: delErr } = await db.from("site_users").delete().eq("id", id);
      if (delErr) {
        errors.push(`${user.login_id}: ${delErr.message}`);
        continue;
      }
      await logUserAdminAction(db, {
        targetLoginId: user.login_id,
        actorLoginId: session.loginId,
        action: "hard_delete",
        summary: "가입 신청 삭제",
        changes: { comment: comment || null },
      });
      processed++;
      continue;
    }

    if (!REVIEWABLE.has(String(user.status)) && action !== "approve") {
      errors.push(`${user.login_id}: 심사 불가 상태`);
      continue;
    }

    const existingProfile =
      user.profile && typeof user.profile === "object" && !Array.isArray(user.profile)
        ? (user.profile as Record<string, unknown>)
        : {};

    const now = new Date().toISOString();
    let updateRow: Record<string, unknown>;
    let auditAction: "approve" | "hold" | "reject";
    let auditSummary: string;

    if (action === "approve") {
      const mn = (String(user.management_number ?? "").trim() || access.managementNumber);
      const adminFields = await resolveApprovalAdminFields(db, mn, now);
      const isFounder = Boolean(adminFields.is_company_founder);
      const approvedRole = isFounder ? adminFields.role : (user.role as string | null) || "직원";
      updateRow = {
        status: "active",
        approved_at: now,
        approved_by: session.loginId,
        permission_role_id:
          user.permission_role_id ||
          (isFounder ? COMPANY_ADMIN_ROLE_ID : defaultPermissionRoleId(approvedRole)),
        role: approvedRole,
        is_company_founder: isFounder,
        resigned_at: null,
        resigned_by: null,
        resign_reason: null,
        profile: { ...existingProfile, signupReviewComment: comment || undefined },
      };
      auditAction = "approve";
      auditSummary = "가입 일괄 승인";
    } else {
      updateRow = {
        status: "on_hold",
        profile: { ...existingProfile, signupReviewComment: comment || "승인 보류" },
      };
      auditAction = "hold";
      auditSummary = "가입 일괄 보류";
    }

    const { error: updErr } = await db.from("site_users").update(updateRow).eq("id", id);
    if (updErr) {
      errors.push(`${user.login_id}: ${updErr.message}`);
      continue;
    }

    await logUserAdminAction(db, {
      targetLoginId: user.login_id,
      actorLoginId: session.loginId,
      action: auditAction,
      summary: auditSummary,
      changes: { comment: comment || null },
    });

    if (action === "approve") {
      try {
        const role = (user.role as string | null) || "직원";
        const roleToLevel = (r: string) =>
          r === "임원" || r === "관리자" ? 5 : r === "변호사" ? 3 : r === "사무장" || r === "국장" ? 2 : r === "인턴" ? 0 : 1;
        await db.from("staff").upsert(
          [
            {
              login_id: user.login_id,
              name: (user.name as string | null) || user.login_id,
              role,
              department: (user.department as string | null) ?? "",
              email: (user.email as string | null) ?? null,
              phone: (user.phone as string | null) ?? null,
              approval_level: roleToLevel(role),
            },
          ],
          { onConflict: "login_id" }
        );
      } catch {
        /* ignore */
      }
    }

    processed++;
  }

  return NextResponse.json({
    success: processed > 0,
    processed,
    total: ids.length,
    errors: errors.length ? errors : undefined,
  });
}
