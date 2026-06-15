/**
 * 직원 목록 엑셀 내보내기/가져오기 및 검증
 * 회원목록 형식(로그인ID, 이름, 역할, 관리번호, 상태, 가입일, 승인일, 승인자)과 동일하게 맞춤 — 승인 회원·직원 목록 일치용
 */
import * as XLSX from "xlsx";
import type { StaffMember } from "@/lib/types";

const ROLES: string[] = [
  "관리자",
  "임원",
  "변호사",
  "사무장",
  "국장",
  "직원",
  "사무원",
  "인턴",
];

/** 회원목록·직원목록 공통 양식 컬럼 (회원관리 엑셀다운/직원관리 양식·추가와 동일) */
export const MEMBER_LIST_HEADERS = [
  "로그인ID",
  "이름",
  "역할",
  "관리번호",
  "상태",
  "가입일",
  "승인일",
  "승인자",
] as const;

/** 직원 상세용 추가 컬럼 (선택) */
export const STAFF_EXTRA_HEADERS = ["부서", "이메일", "전화", "회사전화", "개인전화"] as const;

export const EXCEL_HEADERS = [...MEMBER_LIST_HEADERS, ...STAFF_EXTRA_HEADERS] as const;

function getCell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

function isValidEmail(s: string): boolean {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export interface ExcelValidationError {
  row: number; // 1-based (헤더 다음이 1행)
  field?: string;
  message: string;
}

export interface ExcelParseResult {
  valid: boolean;
  errors: ExcelValidationError[];
  staff: StaffMember[];
}

/**
 * 엑셀 파일 파싱 및 검증. 검증 실패 시 에러 목록 반환, 성공 시 staff 배열 반환.
 */
export function parseAndValidateExcel(file: File): Promise<ExcelParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({
            valid: false,
            errors: [{ row: 0, message: "파일을 읽을 수 없습니다." }],
            staff: [],
          });
          return;
        }
        const wb = XLSX.read(data, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
          resolve({
            valid: false,
            errors: [{ row: 0, message: "시트가 비어 있습니다." }],
            staff: [],
          });
          return;
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
          defval: "",
          raw: false,
        });
        if (!rows.length) {
          resolve({
            valid: false,
            errors: [{ row: 0, message: "데이터 행이 없습니다." }],
            staff: [],
          });
          return;
        }

        const errors: ExcelValidationError[] = [];
        const staff: StaffMember[] = [];
        const existingIds = new Set<string>();

        // 회원목록 형식: 로그인ID, 이름, 역할 필수. 부서·이메일 등 선택
        for (let i = 0; i < rows.length; i++) {
          const rowIndex = i + 1;
          const row = rows[i];
          const loginId = getCell(row, "로그인ID");
          const name = getCell(row, "이름");
          const role = getCell(row, "역할");
          const department = getCell(row, "부서");
          const email = getCell(row, "이메일");
          const phone = getCell(row, "전화");
          const companyPhone = getCell(row, "회사전화");
          const personalPhone = getCell(row, "개인전화");

          if (!loginId) {
            errors.push({ row: rowIndex, field: "로그인ID", message: "로그인ID가 비어 있습니다." });
          }
          if (!name) {
            errors.push({ row: rowIndex, field: "이름", message: "이름이 비어 있습니다." });
          }
          // 역할 비어 있으면 기본값 "직원"으로 반영 (오류로 막지 않음)
          const effectiveRole = role && ROLES.includes(role) ? role : "직원";
          if (role && !ROLES.includes(role)) {
            errors.push({
              row: rowIndex,
              field: "역할",
              message: `역할은 다음 중 하나여야 합니다: ${ROLES.join(", ")}`,
            });
          }
          if (email && !isValidEmail(email)) {
            errors.push({ row: rowIndex, field: "이메일", message: "올바른 이메일 형식이 아닙니다." });
          }

          if (loginId && existingIds.has(loginId.toLowerCase())) {
            errors.push({ row: rowIndex, field: "로그인ID", message: "동일한 로그인ID가 파일 내에 이미 있습니다." });
          }
          if (loginId) existingIds.add(loginId.toLowerCase());

          if (errors.some((e) => e.row === rowIndex)) continue;

          const level =
            effectiveRole === "임원" ? 5 :
            effectiveRole === "변호사" ? 3 :
            effectiveRole === "사무장" || effectiveRole === "국장" ? 2 :
            effectiveRole === "인턴" ? 0 : 1;

          const id = `s${Date.now()}-${i}`;
          staff.push({
            id,
            name,
            role: effectiveRole as StaffMember["role"],
            department: department || "",
            email: email || "",
            phone: phone || companyPhone || personalPhone || "",
            level,
            companyPhone: companyPhone || undefined,
            personalPhone: personalPhone || undefined,
            loginId: loginId || undefined,
          });
        }

        resolve({
          valid: errors.length === 0,
          errors,
          staff,
        });
      } catch (err) {
        resolve({
          valid: false,
          errors: [{ row: 0, message: err instanceof Error ? err.message : "파일 파싱 중 오류가 발생했습니다." }],
          staff: [],
        });
      }
    };
    reader.onerror = () => {
      resolve({
        valid: false,
        errors: [{ row: 0, message: "파일을 읽는 중 오류가 발생했습니다." }],
        staff: [],
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 직원 목록을 엑셀으로 다운로드 (회원목록 형식과 동일 — 승인 회원·직원 목록 일치용)
 */
export function exportStaffToExcel(staffList: StaffMember[]): void {
  const rows = staffList.map((s) => ({
    로그인ID: s.loginId ?? "",
    이름: s.name,
    역할: s.role,
    관리번호: "",
    상태: "승인",
    가입일: "",
    승인일: "",
    승인자: "",
    부서: s.department ?? "",
    이메일: s.email ?? "",
    전화: s.phone ?? "",
    회사전화: s.companyPhone ?? "",
    개인전화: s.personalPhone ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "회원목록");
  XLSX.writeFile(wb, `직원목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 직원 추가용 빈 양식 다운로드 (회원목록 형식과 동일 — 회원관리 엑셀다운·엑셀등록과 동일 양식)
 */
export function downloadStaffExcelTemplate(): void {
  const headers = [...MEMBER_LIST_HEADERS, ...STAFF_EXTRA_HEADERS];
  const ws = XLSX.utils.aoa_to_sheet([[...headers]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "회원목록");
  XLSX.writeFile(wb, `직원_회원목록_양식_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
