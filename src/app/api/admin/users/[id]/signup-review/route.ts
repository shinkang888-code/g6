/**
 * 가입 심사 — 승인 / 보류 / 거절 (관리번호 테넌트 범위)
 * PATCH { action: "approve" | "hold" | "reject", comment?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { defaultPermissionRoleId } from "@/lib/userAdmin";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import { requireAdminSession } from "@/lib/adminSession";
import { assertUserManageableByAdmin } from "@/lib/companyRegistryAuth";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { resolveApprovalAdminFields } from "@/lib/tenantUser";
import { COMPANY_ADMIN_ROLE_ID } from "@/lib/adminRoles";

const SELECT_FIELDS =
  "id, login_id, management_number, status, name, role, department, email, phone, profile, permission_role_id, created_at, approved_at, approved_by, resigned_at, resigned_by, resign_reason, google_email, auth_provider";

const REVIEWABLE = new Set(["pending", "on_hold"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });
  }

  const { id } = await params;
  const access = await assertUserManageableByAdmin(db, session, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "사용자를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  let body: { action?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const action = (body.action ?? "").trim();
  if (!["approve", "hold", "reject"].includes(action)) {
    return NextResponse.json({ error: "action은 approve, hold, reject 중 하나여야 합니다." }, { status: 400 });
  }

  const { data: user } = await db
    .from("site_users")
    .select("login_id, role, permission_role_id, status, profile, management_number")
    .eq("id", id)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  if (!REVIEWABLE.has(String(user.status)) && action !== "approve") {
    return NextResponse.json(
      { error: "가입승인대기·승인보류 상태의 회원만 심사할 수 있습니다." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const comment = (body.comment ?? "").trim();
  const existingProfile =
    user.profile && typeof user.profile === "object" && !Array.isArray(user.profile)
      ? (user.profile as Record<string, unknown>)
      : {};

  let updateRow: Record<string, unknown>;
  let auditAction: "approve" | "hold" | "reject";
  let auditSummary: string;

  if (action === "approve") {
    const mn = (String(user.management_number ?? "").trim() || access.managementNumber);
    const adminFields = await resolveApprovalAdminFields(db, mn, now);
    const isFounder = Boolean(adminFields.is_company_founder);
    const approvedRole = isFounder ? adminFields.role : (user.role as string | null) || "직원";
    const permissionRoleId =
      user.permission_role_id ||
      (isFounder ? COMPANY_ADMIN_ROLE_ID : defaultPermissionRoleId(approvedRole));
    updateRow = {
      status: "active",
      approved_at: now,
      approved_by: session.loginId,
      permission_role_id: permissionRoleId,
      role: approvedRole,
      is_company_founder: isFounder,
      resigned_at: null,
      resigned_by: null,
      resign_reason: null,
      profile: { ...existingProfile, signupReviewComment: comment || undefined },
    };
    auditAction = "approve";
    auditSummary = "가입 승인 → 재직";
  } else if (action === "hold") {
    updateRow = {
      status: "on_hold",
      profile: { ...existingProfile, signupReviewComment: comment || "승인 보류" },
    };
    auditAction = "hold";
    auditSummary = "가입 승인 보류";
  } else {
    updateRow = {
      status: "rejected",
      resign_reason: comment || "가입 거절",
      profile: { ...existingProfile, signupReviewComment: comment || undefined },
    };
    auditAction = "reject";
    auditSummary = "가입 거절";
  }

  const { data: updated, error } = await db
    .from("site_users")
    .update(updateRow)
    .eq("id", id)
    .select(SELECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
        r === "임원" || r === "관리자"
          ? 5
          : r === "변호사"
            ? 3
            : r === "사무장" || r === "국장"
              ? 2
              : r === "인턴"
                ? 0
                : 1;
      await db.from("staff").upsert(
        [
          {
            login_id: user.login_id,
            name: (updated as { name?: string }).name || user.login_id,
            role,
            department: (updated as { department?: string }).department ?? "",
            email: (updated as { email?: string }).email ?? null,
            phone: (updated as { phone?: string }).phone ?? null,
            approval_level: roleToLevel(role),
          },
        ],
        { onConflict: "login_id" }
      );
    } catch {
      /* staff 연동 실패해도 승인은 유지 */
    }
  }

  return NextResponse.json({ user: updated, action });
}
