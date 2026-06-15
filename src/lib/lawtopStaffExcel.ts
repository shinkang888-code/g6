/**
 * LawTop GL 직원목록 엑셀 (성명·사용자유형·ID·소속부서·연락처 등) 파싱
 */

import type { JobTitleOption } from "@/lib/types";

export const LAWTOP_STAFF_HEADERS = ["성명", "ID", "사용자유형"] as const;

export type LawtopStaffImportRow = {
  loginId: string;
  name: string;
  role: string;
  password: string;
  department: string;
  email: string;
  phone: string;
  companyPhone: string;
  personalPhone: string;
  jobTitle?: JobTitleOption;
  lawtopUserType: string;
  hireDate?: string;
  gender?: string;
  extension?: string;
  fax?: string;
  memo?: string;
};

export type LawtopStaffParseError = {
  row: number;
  field?: string;
  message: string;
};

const ALLOWED_ROLES = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;
const JOB_TITLES = new Set<string>(["부장", "팀장", "과장", "대리", "주임", "인턴"]);

export const DEFAULT_IMPORT_PASSWORD = "changeMe1!";

function getCell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

export function isLawtopStaffExcel(headers: string[]): boolean {
  return LAWTOP_STAFF_HEADERS.every((h) => headers.includes(h));
}

/** LawTop 사용자유형 → 시스템 역할 */
export function mapLawtopUserTypeToRole(userType: string): string {
  const s = String(userType ?? "").trim();
  if (!s) return "직원";
  if (s.includes("관리자")) return "관리자";
  if (s.includes("변호사")) return "변호사";
  if (s.includes("임원")) return "임원";
  if (s.includes("국장")) return "국장";
  if (s.includes("사무장")) return "사무장";
  if (s.includes("인턴")) return "인턴";
  if (s.includes("사무원")) return "사무원";
  if (s.includes("스탭") || s.includes("스텝")) return "직원";
  if (s.includes("기타")) return "직원";
  return "직원";
}

function mapJobTitle(raw: string): JobTitleOption | undefined {
  const s = raw.trim();
  return JOB_TITLES.has(s) ? (s as JobTitleOption) : undefined;
}

function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

function resolvePassword(raw: string): string {
  const pw = raw.trim();
  if (!pw || pw === "****" || pw === "********") return DEFAULT_IMPORT_PASSWORD;
  return pw.length >= 4 ? pw : DEFAULT_IMPORT_PASSWORD;
}

function isValidEmail(s: string): boolean {
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function parseLawtopStaffExcelRows(
  rows: Record<string, unknown>[]
): { rows: LawtopStaffImportRow[]; errors: LawtopStaffParseError[] } {
  const errors: LawtopStaffParseError[] = [];
  const parsed: LawtopStaffImportRow[] = [];
  const loginIdsInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 1;
    const row = rows[i];
    const name = getCell(row, "성명");
    const loginIdRaw = getCell(row, "ID");
    const loginId = normalizeLoginId(loginIdRaw);
    const userType = getCell(row, "사용자유형");
    const role = mapLawtopUserTypeToRole(userType);
    const password = resolvePassword(getCell(row, "PW"));
    const department = getCell(row, "소속부서");
    const email = getCell(row, "이메일");
    const companyPhone = getCell(row, "업무전화");
    const personalPhone = getCell(row, "이동전화");
    const phone = personalPhone || companyPhone;
    const jobTitle = mapJobTitle(getCell(row, "직위"));
    const hireDate = getCell(row, "입사일");
    const gender = getCell(row, "성별");
    const extension = getCell(row, "내선번호");
    const fax = getCell(row, "업무팩스");
    const memo = getCell(row, "비고");

    if (!name) {
      errors.push({ row: rowIndex, field: "성명", message: "성명이 비어 있습니다." });
    }
    if (!loginId) {
      errors.push({ row: rowIndex, field: "ID", message: "ID(로그인ID)가 비어 있습니다." });
    } else if (loginId.length < 2) {
      errors.push({ row: rowIndex, field: "ID", message: "ID는 2자 이상이어야 합니다." });
    } else if (loginIdsInFile.has(loginId)) {
      errors.push({ row: rowIndex, field: "ID", message: "파일 내 동일한 ID가 이미 있습니다." });
    } else {
      loginIdsInFile.add(loginId);
    }

    if (email && !isValidEmail(email)) {
      errors.push({ row: rowIndex, field: "이메일", message: "올바른 이메일 형식이 아닙니다." });
    }

    if (role && !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      errors.push({ row: rowIndex, field: "사용자유형", message: `지원하지 않는 역할입니다: ${role}` });
    }

    if (errors.some((e) => e.row === rowIndex)) continue;

    parsed.push({
      loginId,
      name,
      role,
      password,
      department,
      email,
      phone,
      companyPhone,
      personalPhone,
      jobTitle,
      lawtopUserType: userType,
      hireDate: hireDate || undefined,
      gender: gender || undefined,
      extension: extension || undefined,
      fax: fax || undefined,
      memo: memo || undefined,
    });
  }

  return { rows: parsed, errors };
}

export function lawtopRowToProfile(row: LawtopStaffImportRow): Record<string, string> {
  const profile: Record<string, string> = {};
  if (row.jobTitle) profile.jobTitle = row.jobTitle;
  if (row.companyPhone) profile.companyPhone = row.companyPhone;
  if (row.personalPhone) profile.personalPhone = row.personalPhone;
  if (row.lawtopUserType) profile.lawtopUserType = row.lawtopUserType;
  if (row.hireDate) profile.hireDate = row.hireDate;
  if (row.gender) profile.gender = row.gender;
  if (row.extension) profile.extension = row.extension;
  if (row.fax) profile.fax = row.fax;
  if (row.memo) profile.memo = row.memo;
  return profile;
}
