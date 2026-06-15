/**
 * 직원 목록 조회 (GET) / 직원 제외 (DELETE)
 *
 * 핵심 설계 변경: staff 테이블 sync를 완전히 제거하고,
 * site_users(approved) 를 직접 읽어 직원 목록으로 반환.
 * → "회원 관리에서 승인된 회원 = 직원"을 별도 sync 없이 항상 일치시킴.
 *
 * DELETE: body { id: string } — site_users 퇴사/제외 처리 (계정 삭제 → 재가입 허용)
 */

import { NextRequest, NextResponse } from "next/server";
import { userToStaffShape } from "@/lib/userAdmin";
import { deleteUserAccountForResign } from "@/lib/userResign";
import { assertUserInTenant, requireTenantSession } from "@/lib/tenantScope";

function roleToLevel(role: string | null): number {
  if (!role) return 1;
  if (role === "임원") return 5;
  if (role === "변호사") return 3;
  if (role === "사무장" || role === "국장") return 2;
  if (role === "인턴") return 0;
  return 1;
}

const ALLOWED_ROLES = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;
export async function GET() {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  try {
    const { data, error } = await db
      .from("site_users")
      .select("id, login_id, name, role, management_number, department, email, phone, profile, created_at")
      .eq("management_number", managementNumber)
      .in("status", ["active", "approved"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("staff GET site_users:", error.message);
      return NextResponse.json(
        { staff: [], count: 0, error: `회원 목록 조회 실패: ${error.message}` },
        { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const staff = (data ?? []).map(
      (u: {
        id: string;
        login_id: string;
        name: string | null;
        role: string | null;
        management_number?: string | null;
        department?: string | null;
        email?: string | null;
        phone?: string | null;
      }) => {
        const role =
          u.role && ALLOWED_ROLES.includes(u.role as (typeof ALLOWED_ROLES)[number])
            ? u.role
            : "직원";
        return {
          ...userToStaffShape({
            id: u.id,
            login_id: u.login_id,
            name: u.name,
            role,
            management_number: u.management_number ?? null,
            department: u.department,
            email: u.email,
            phone: u.phone,
            status: "active",
            created_at: "",
          }),
          level: roleToLevel(role),
        };
      }
    );

    return NextResponse.json(
      { staff, count: staff.length, managementNumber },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "직원 목록 조회 중 알 수 없는 오류";
    console.error("staff GET:", message);
    return NextResponse.json(
      { staff: [], count: 0, error: message },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

/**
 * 직원 제외 처리 — 계정을 삭제해 다른 관리번호로 재가입할 수 있게 함.
 * body: { id: string }  — site_users.id 전달
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  let body: { id?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "직원 id를 지정하세요." }, { status: 400 });
  }

  try {
    const inTenant = await assertUserInTenant(db, id, managementNumber);
    if (!inTenant) {
      return NextResponse.json({ error: "해당 회원을 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
    }

    const { data: user, error: findErr } = await db
      .from("site_users")
      .select("id, login_id, management_number, status")
      .eq("id", id)
      .single();

    if (findErr || !user) {
      return NextResponse.json({ error: "해당 회원을 찾을 수 없습니다." }, { status: 404 });
    }

    const loginId = (user.login_id as string | null) ?? "";
    if (!loginId.trim()) {
      return NextResponse.json({ error: "login_id가 없는 회원입니다." }, { status: 400 });
    }

    const result = await deleteUserAccountForResign(db, user, {
      actorLoginId: session.loginId,
      type: "excluded",
      reason: "직원관리에서 제외",
      auditSummary: "직원관리 제외 · 계정 삭제 (재가입 가능)",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: true,
      message: "직원에서 제외되었습니다. 해당 회원은 새 관리번호로 재가입할 수 있습니다.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "직원 제외 처리 중 오류";
    console.error("staff DELETE:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
