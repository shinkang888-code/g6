/**
 * 회원 목록 엑셀 다운로드 (회원 관리 페이지)
 * - 상세 export / import 재업로드용 export 분리
 */
import * as XLSX from "xlsx";

/** POST /api/admin/members/import-excel 과 호환되는 컬럼 */
export const MEMBER_IMPORT_HEADERS = ["로그인ID", "이름", "역할", "부서", "이메일", "전화"] as const;

export interface MemberForExport {
  id: string;
  login_id: string;
  management_number: string;
  status: string;
  name: string | null;
  role: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

/**
 * 현재 회원 목록을 엑셀 파일로 다운로드 (직원목록 형식과 동일한 컬럼 포함)
 */
export function exportMembersToExcel(members: MemberForExport[]): void {
  const rows = members.map((m) => ({
    로그인ID: m.login_id ?? "",
    이름: m.name ?? "",
    역할: m.role ?? "",
    관리번호: m.management_number ?? "",
    상태:
      m.status === "active" || m.status === "approved"
        ? "재직"
        : m.status === "pending"
          ? "대기"
          : m.status === "resigned"
            ? "퇴사"
            : m.status === "excluded"
              ? "제외"
              : m.status,
    가입일: formatDate(m.created_at),
    승인일: formatDate(m.approved_at),
    승인자: m.approved_by ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "회원목록");
  XLSX.writeFile(wb, `회원목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** import API에 바로 업로드 가능한 형식 (LawTop user_lawygo 호환) */
export function exportMembersForReimport(
  members: Array<MemberForExport & { department?: string | null; email?: string | null; phone?: string | null }>
): void {
  const rows = members.map((m) => ({
    로그인ID: m.login_id ?? "",
    이름: m.name ?? "",
    역할: m.role ?? "",
    부서: m.department ?? "",
    이메일: m.email ?? "",
    전화: m.phone ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(MEMBER_IMPORT_HEADERS.map((h) => [h, ""]))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "회원목록");
  XLSX.writeFile(wb, `회원목록_재업로드용_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadMemberExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([[...MEMBER_IMPORT_HEADERS]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "회원목록");
  XLSX.writeFile(wb, `회원등록_양식_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
