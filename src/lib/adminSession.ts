import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/authSession";
import { isAnyPlatformStaff, isCompanyAdmin } from "@/lib/adminRoles";
import { isPlatformSecretsAdmin } from "@/lib/platformSecretsAdmin";
import { canAccessMenu } from "@/lib/rolePermissionsServer";

/** 플랫폼·사내 관리자 및 관리자 메뉴 권한 보유 계정 */
export function hasAdminAccess(session: SessionPayload): boolean {
  if (isAnyPlatformStaff(session)) return true;
  if (isCompanyAdmin(session)) return true;
  if ((session.role ?? "").trim() === "관리자") return true;
  const perms = session.menuPermissions ?? [];
  if (perms.includes("*")) return true;
  return canAccessMenu("관리자", perms);
}

export async function requireAuthenticatedSession(): Promise<
  { session: SessionPayload } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }
  return { session };
}

export async function requireAdminSession(): Promise<
  { session: SessionPayload } | { error: NextResponse }
> {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth;
  const { session } = auth;
  if (!hasAdminAccess(session)) {
    return {
      error: NextResponse.json(
        { error: "관리자만 이 설정을 변경할 수 있습니다." },
        { status: 403 }
      ),
    };
  }
  return { session };
}

/** 비밀키·환경변수형 관리자 설정 (shinkang / kangjunchul8@gmail.com) */
export async function requirePlatformSecretsAdmin(): Promise<
  { session: SessionPayload } | { error: NextResponse }
> {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth;
  const { session } = auth;
  if (!isPlatformSecretsAdmin(session)) {
    return {
      error: NextResponse.json(
        {
          error:
            "이 설정은 전체관리자(shinkang) 또는 전체부관리자(kangjunchul8@gmail.com)만 변경할 수 있습니다.",
        },
        { status: 403 }
      ),
    };
  }
  return { session };
}
