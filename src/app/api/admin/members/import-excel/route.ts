/**
 * 회원·직원 엑셀 일괄 등록
 * FormData: file (.xlsx/.xls), replace (true|false)
 *
 * 지원 형식:
 * 1) LawTop 직원목록 (성명, ID, 사용자유형, 이메일, 소속부서, 업무전화, 이동전화 …)
 * 2) 표준 회원목록 (로그인ID, 이름, 역할, …)
 */

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { hashPassword } from "@/lib/authPassword";
import { defaultPermissionRoleId } from "@/lib/userAdmin";
import { getClientIdentifier, LIMIT_IMPORT_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { requireTenantSession } from "@/lib/tenantScope";
import { requireAdminSession } from "@/lib/adminSession";
import {
  isLawtopStaffExcel,
  parseLawtopStaffExcelRows,
  lawtopRowToProfile,
  DEFAULT_IMPORT_PASSWORD,
  type LawtopStaffImportRow,
} from "@/lib/lawtopStaffExcel";

const ALLOWED_ROLES = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;
const REQUIRED_HEADERS = ["로그인ID", "이름", "역할"] as const;
const ADMIN_LOGIN_ID = "shinkang";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

function isAllowedExcelBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true;
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return true;
  return false;
}

export interface ExcelRowError {
  row: number;
  field?: string;
  message: string;
}

type ParsedMember = {
  loginId: string;
  name: string;
  role: string;
  password: string;
  department?: string;
  email?: string;
  phone?: string;
  profile?: Record<string, string>;
  source: "lawtop" | "standard";
};

function getCell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

function roleToLevel(role: string): number {
  if (role === "임원" || role === "관리자") return 5;
  if (role === "변호사") return 3;
  if (role === "사무장" || role === "국장") return 2;
  if (role === "인턴") return 0;
  return 1;
}

function lawtopToParsed(row: LawtopStaffImportRow): ParsedMember {
  return {
    loginId: row.loginId,
    name: row.name,
    role: row.role,
    password: row.password,
    department: row.department || undefined,
    email: row.email || undefined,
    phone: row.phone || undefined,
    profile: lawtopRowToProfile(row),
    source: "lawtop",
  };
}

function parseStandardRows(rows: Record<string, unknown>[]): { parsed: ParsedMember[]; errors: ExcelRowError[] } {
  const errors: ExcelRowError[] = [];
  const loginIdsInFile = new Set<string>();
  const parsed: ParsedMember[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 1;
    const row = rows[i];
    const loginId = getCell(row, "로그인ID").toLowerCase();
    const name = getCell(row, "이름");
    const role = getCell(row, "역할");
    const password = getCell(row, "비밀번호") || DEFAULT_IMPORT_PASSWORD;

    if (!loginId) {
      errors.push({ row: rowIndex, field: "로그인ID", message: "로그인ID가 비어 있습니다." });
    } else if (loginId.length < 2) {
      errors.push({ row: rowIndex, field: "로그인ID", message: "로그인ID는 2자 이상이어야 합니다." });
    } else if (loginIdsInFile.has(loginId)) {
      errors.push({ row: rowIndex, field: "로그인ID", message: "파일 내 동일한 로그인ID가 이미 있습니다." });
    } else {
      loginIdsInFile.add(loginId);
    }

    if (!name) {
      errors.push({ row: rowIndex, field: "이름", message: "이름이 비어 있습니다." });
    }

    const effectiveRole =
      role && ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]) ? role : "직원";
    if (role && !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      errors.push({
        row: rowIndex,
        field: "역할",
        message: `역할은 다음 중 하나여야 합니다: ${ALLOWED_ROLES.join(", ")}`,
      });
    }
    if (password.length < 4) {
      errors.push({ row: rowIndex, field: "비밀번호", message: "비밀번호는 4자 이상이어야 합니다." });
    }

    if (errors.some((e) => e.row === rowIndex)) continue;

    const department = getCell(row, "소속부서") || getCell(row, "부서");
    const email = getCell(row, "이메일");
    const phone = getCell(row, "이동전화") || getCell(row, "업무전화") || getCell(row, "전화");
    const companyPhone = getCell(row, "회사전화") || getCell(row, "업무전화");
    const personalPhone = getCell(row, "개인전화") || getCell(row, "이동전화");

    const profile: Record<string, string> = {};
    if (companyPhone) profile.companyPhone = companyPhone;
    if (personalPhone) profile.personalPhone = personalPhone;

    parsed.push({
      loginId,
      name: name || loginId,
      role: effectiveRole,
      password,
      department: department || undefined,
      email: email || undefined,
      phone: phone || undefined,
      profile: Object.keys(profile).length ? profile : undefined,
      source: "standard",
    });

  }

  return { parsed, errors };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  const limited = enforceRateLimit(request, `import:members:${getClientIdentifier(request)}`, LIMIT_IMPORT_PER_MIN, {
    routePath: "/api/admin/members/import-excel",
    source: "upload",
  });
  if (limited) return limited;

  let file: File;
  let replaceMode = false;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File;
    const replaceParam = formData.get("replace");
    replaceMode =
      replaceParam === "true" || replaceParam === "1" || String(replaceParam).toLowerCase() === "true";
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "엑셀 파일을 선택해 주세요." }, { status: 400 });
    }
    const name = (file.name ?? "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((e) => name.endsWith(e))) {
      return NextResponse.json({ error: "엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB 이하여야 합니다.` },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isAllowedExcelBuffer(buffer)) {
    return NextResponse.json(
      {
        error: "허용되지 않은 파일 형식입니다. 실제 엑셀(.xlsx, .xls) 파일을 업로드해 주세요.",
        errors: [{ row: 0, message: "MIME/매직 바이트 검증 실패" }],
      },
      { status: 400 }
    );
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json(
      { error: "엑셀 파일을 읽을 수 없습니다.", errors: [{ row: 0, message: "파일 형식이 올바르지 않습니다." }] },
      { status: 400 }
    );
  }

  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) {
    return NextResponse.json(
      { error: "엑셀 형식 오류", errors: [{ row: 0, message: "시트가 비어 있습니다." }] },
      { status: 400 }
    );
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
  if (!rawRows.length) {
    return NextResponse.json(
      { error: "엑셀 형식 오류", errors: [{ row: 0, message: "데이터 행이 없습니다." }] },
      { status: 400 }
    );
  }

  const headers = Object.keys(rawRows[0] ?? {});
  const hasLawtop = isLawtopStaffExcel(headers);
  const hasStandard = REQUIRED_HEADERS.every((h) => headers.includes(h));

  if (!hasLawtop && !hasStandard) {
    return NextResponse.json(
      {
        error:
          "엑셀 형식이 맞지 않습니다. LawTop 직원목록(성명·ID·사용자유형) 또는 표준 회원목록(로그인ID·이름·역할) 형식이어야 합니다.",
        errors: [
          {
            row: 0,
            field: "헤더",
            message: "LawTop: 성명, ID, 사용자유형 / 표준: 로그인ID, 이름, 역할",
          },
        ],
      },
      { status: 400 }
    );
  }

  let parsed: ParsedMember[] = [];
  let errors: ExcelRowError[] = [];
  let format: "lawtop" | "standard" = hasLawtop ? "lawtop" : "standard";

  if (hasLawtop) {
    const result = parseLawtopStaffExcelRows(rawRows);
    errors = result.errors;
    parsed = result.rows.map(lawtopToParsed);
  } else {
    const result = parseStandardRows(rawRows);
    errors = result.errors;
    parsed = result.parsed;
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "엑셀 형식 또는 데이터가 맞지 않아 등록되지 않았습니다.", errors },
      { status: 400 }
    );
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "등록할 회원 데이터가 없습니다.", errors: [{ row: 0, message: "유효한 데이터 행이 없습니다." }] },
      { status: 400 }
    );
  }

  if (replaceMode) {
    const { data: existingUsers } = await db
      .from("site_users")
      .select("id, login_id")
      .eq("management_number", managementNumber);

    const toDeleteUserIds = (existingUsers ?? [])
      .filter((r) => String(r.login_id).toLowerCase() !== ADMIN_LOGIN_ID)
      .map((r) => r.id as string);

    for (let i = 0; i < toDeleteUserIds.length; i += 100) {
      const chunk = toDeleteUserIds.slice(i, i + 100);
      const { error } = await db.from("site_users").delete().in("id", chunk);
      if (error) {
        return NextResponse.json({ error: `기존 회원 삭제 실패: ${error.message}` }, { status: 500 });
      }
    }

    await db.from("app_settings").upsert(
      { key: "staff_excluded_login_ids", value: [] },
      { onConflict: "key" }
    );
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of parsed) {
    if (row.loginId === ADMIN_LOGIN_ID) {
      skipped++;
      continue;
    }

    const { data: existing } = await db
      .from("site_users")
      .select("id, profile, status")
      .eq("login_id", row.loginId)
      .maybeSingle();

    const now = new Date().toISOString();
    const profile = row.profile ?? {};

    if (existing) {
      if (replaceMode) {
        const password_hash = hashPassword(row.password);
        const { error: updErr } = await db
          .from("site_users")
          .update({
            password_hash,
            name: row.name,
            role: row.role,
            status: "active",
            management_number: managementNumber,
            department: row.department ?? null,
            email: row.email || null,
            phone: row.phone || null,
            profile,
            permission_role_id: defaultPermissionRoleId(row.role),
            approved_at: now,
            approved_by: "excel-replace",
            resigned_at: null,
            resigned_by: null,
            resign_reason: null,
          })
          .eq("id", existing.id);

        if (updErr) {
          console.error("member import replace update:", updErr);
          skipped++;
          continue;
        }
        updated++;
      } else {
        const mergedProfile = {
          ...(typeof existing.profile === "object" && existing.profile && !Array.isArray(existing.profile)
            ? (existing.profile as Record<string, string>)
            : {}),
          ...profile,
        };
        const { error: updErr } = await db
          .from("site_users")
          .update({
            name: row.name,
            role: row.role,
            management_number: managementNumber,
            department: row.department ?? null,
            email: row.email || null,
            phone: row.phone || null,
            profile: mergedProfile,
            status: existing.status === "excluded" || existing.status === "resigned" ? "active" : existing.status,
            permission_role_id: defaultPermissionRoleId(row.role),
            resigned_at: null,
            resigned_by: null,
            resign_reason: null,
          })
          .eq("id", existing.id);

        if (updErr) {
          console.error("member import upsert update:", updErr);
          skipped++;
          continue;
        }
        updated++;
      }
    } else {
      const password_hash = hashPassword(row.password);
      const { error: insertError } = await db.from("site_users").insert({
        login_id: row.loginId,
        password_hash,
        name: row.name,
        role: row.role,
        status: "active",
        management_number: managementNumber,
        department: row.department ?? null,
        email: row.email || null,
        phone: row.phone || null,
        profile,
        permission_role_id: defaultPermissionRoleId(row.role),
        approved_at: now,
        approved_by: replaceMode ? "excel-replace" : "excel-import",
      });

      if (insertError) {
        console.error("member import insert:", insertError);
        skipped++;
        continue;
      }
      created++;
    }

    try {
      await db.from("staff").upsert(
        [
          {
            login_id: row.loginId,
            name: row.name,
            role: row.role,
            department: row.department ?? "",
            email: row.email || null,
            phone: row.phone || null,
            approval_level: roleToLevel(row.role),
          },
        ],
        { onConflict: "login_id" }
      );
    } catch {
      // staff 연동 실패해도 회원은 반영됨
    }
  }

  return NextResponse.json({
    success: true,
    count: created + updated,
    created,
    updated,
    skipped,
    total: parsed.length,
    replaced: replaceMode,
    format,
    managementNumber,
    importedBy: session.loginId,
  });
}
