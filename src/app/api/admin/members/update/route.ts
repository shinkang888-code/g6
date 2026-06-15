/**
 * 회원 정보 수정 (아이디, 이름, 권한/직급, 관리번호, 부서, 연락처) — 동일 회사코드(관리번호) 내에서만
 * PATCH body: {
 *   id?, loginId?, name?, role?, managementNumber?,
 *   department?, email?, phone?, jobTitle?, companyPhone?, personalPhone?
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { mergeStaffProfile, primaryPhoneFromStaffFields, type StaffProfileExtra } from "@/lib/staffProfile";
import { assertUserInTenant, requireTenantSession } from "@/lib/tenantScope";
import { requireAdminSession } from "@/lib/adminSession";

const ROLE_OPTIONS = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: {
    id?: string;
    loginId?: string;
    name?: string;
    role?: string;
    managementNumber?: string;
    department?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    companyPhone?: string;
    personalPhone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  const lookupByLoginId = (body.loginId ?? "").trim().toLowerCase();
  if (!id && !lookupByLoginId) {
    return NextResponse.json({ error: "id 또는 loginId를 입력하세요." }, { status: 400 });
  }

  let query = db
    .from("site_users")
    .select("id, login_id, name, role, management_number, department, email, phone, profile");
  if (id) query = query.eq("id", id);
  else query = query.eq("login_id", lookupByLoginId);
  const { data: user, error: findError } = await query.single();

  if (findError || !user) {
    return NextResponse.json({ error: "해당 회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const userMgmt = String(user.management_number ?? "").trim();
  if (userMgmt !== managementNumber) {
    return NextResponse.json({ error: "다른 회사코드(관리번호)의 회원은 수정할 수 없습니다." }, { status: 403 });
  }

  const inTenant = await assertUserInTenant(db, user.id as string, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ error: "해당 회원을 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const newLoginId = (body.loginId ?? "").trim().toLowerCase();
  if (newLoginId && newLoginId.length < 2) {
    return NextResponse.json({ error: "아이디는 2자 이상이어야 합니다." }, { status: 400 });
  }
  if (newLoginId && newLoginId !== (user.login_id ?? "")) {
    const { data: existing } = await db.from("site_users").select("id").eq("login_id", newLoginId).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
  }

  const updates: {
    login_id?: string;
    name?: string | null;
    role?: string | null;
    management_number?: string;
    department?: string | null;
    email?: string | null;
    phone?: string | null;
    profile?: Record<string, string>;
  } = {};

  if (newLoginId && newLoginId !== (user.login_id ?? "")) {
    updates.login_id = newLoginId;
  }
  if (body.name !== undefined) {
    updates.name = (body.name ?? "").trim() || null;
  }
  if (body.role !== undefined) {
    const role = (body.role ?? "").trim();
    updates.role = ROLE_OPTIONS.includes(role as (typeof ROLE_OPTIONS)[number]) ? role : null;
  }
  if (body.managementNumber !== undefined) {
    const v = (body.managementNumber ?? "").trim();
    updates.management_number = v || userMgmt || managementNumber;
  }
  if (body.department !== undefined) {
    updates.department = (body.department ?? "").trim() || null;
  }
  if (body.email !== undefined) {
    updates.email = (body.email ?? "").trim() || null;
  }

  const profilePatch: StaffProfileExtra = {};
  if (body.jobTitle !== undefined) {
    const jt = (body.jobTitle ?? "").trim();
    if (jt) profilePatch.jobTitle = jt as StaffProfileExtra["jobTitle"];
  }
  if (body.companyPhone !== undefined) profilePatch.companyPhone = (body.companyPhone ?? "").trim();
  if (body.personalPhone !== undefined) profilePatch.personalPhone = (body.personalPhone ?? "").trim();

  if (
    body.jobTitle !== undefined ||
    body.companyPhone !== undefined ||
    body.personalPhone !== undefined
  ) {
    updates.profile = mergeStaffProfile(user.profile, profilePatch);
  }

  if (body.phone !== undefined) {
    updates.phone = (body.phone ?? "").trim() || null;
  } else if (body.companyPhone !== undefined || body.personalPhone !== undefined) {
    const merged = mergeStaffProfile(user.profile, profilePatch);
    updates.phone =
      primaryPhoneFromStaffFields(user.phone as string | null, {
        companyPhone: merged.companyPhone,
        personalPhone: merged.personalPhone,
      }) || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, message: "변경 사항이 없습니다." });
  }

  const { error: updateError } = await db.from("site_users").update(updates).eq("id", user.id);

  if (updateError) {
    console.error("admin members update:", updateError);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      loginId: updates.login_id ?? user.login_id,
      name: updates.name ?? user.name,
      role: updates.role ?? user.role,
      department: updates.department ?? user.department,
      email: updates.email ?? user.email,
      phone: updates.phone ?? user.phone,
    },
  });
}
