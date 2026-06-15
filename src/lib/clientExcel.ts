/**
 * 고객(의뢰인) 목록 엑셀 내보내기/가져오기
 * - 빈 행은 무시, 이름 필수 검증
 */
import * as XLSX from "xlsx";
import type { ClientItem } from "@/lib/types";

export const CLIENT_EXCEL_HEADERS = [
  "의뢰인",
  "연락처",
  "휴대폰",
  "이메일",
  "주소",
  "주민번호",
  "사업자번호",
  "메모",
] as const;

function getCell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

/** 행이 완전히 비었는지 (모든 셀 공백/빈값) */
function isEmptyRow(row: Record<string, unknown>): boolean {
  return CLIENT_EXCEL_HEADERS.every((h) => !getCell(row, h));
}

export interface ClientExcelValidationError {
  row: number;
  field?: string;
  message: string;
}

export interface ClientExcelParseResult {
  valid: boolean;
  errors: ClientExcelValidationError[];
  clients: Array<Omit<ClientItem, "id" | "createdAt" | "updatedAt" | "deletedAt" | "callMemoIds">>;
}

/**
 * 엑셀 파일 파싱 및 검증. 빈 행은 무시, 이름 필수.
 */
export function parseClientExcel(file: File): Promise<ClientExcelParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({
            valid: false,
            errors: [{ row: 0, message: "파일을 읽을 수 없습니다." }],
            clients: [],
          });
          return;
        }
        const wb = XLSX.read(data, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
          resolve({
            valid: false,
            errors: [{ row: 0, message: "시트가 비어 있습니다." }],
            clients: [],
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
            clients: [],
          });
          return;
        }

        const errors: ClientExcelValidationError[] = [];
        const clients: Array<Omit<ClientItem, "id" | "createdAt" | "updatedAt" | "deletedAt" | "callMemoIds">> = [];

        const headers = Object.keys(rows[0] ?? {});
        const isGuestlistFormat = headers.includes("의뢰인명");

        for (let i = 0; i < rows.length; i++) {
          const rowIndex = i + 1;
          const row = rows[i];
          if (isGuestlistFormat) {
            if (!getCell(row, "의뢰인명")) continue;
          } else if (isEmptyRow(row)) {
            continue;
          }

          const name = isGuestlistFormat ? getCell(row, "의뢰인명") : getCell(row, "의뢰인");
          const phone = getCell(row, "연락처") || (isGuestlistFormat ? getCell(row, "전화") : undefined);
          const mobile = isGuestlistFormat ? getCell(row, "이동전화") : getCell(row, "휴대폰");
          const email = getCell(row, "이메일") || undefined;
          const address = getCell(row, "주소") || undefined;
          const idNumber = getCell(row, "주민번호") || undefined;
          const bizNumber = getCell(row, "사업자번호") || undefined;
          let memo = getCell(row, "메모") || undefined;
          if (isGuestlistFormat) {
            const guestCode = getCell(row, "고유번호");
            const 비고 = getCell(row, "비고");
            const parts = [비고, guestCode ? `고유번호: ${guestCode}` : ""].filter(Boolean);
            if (parts.length) memo = [memo, ...parts].filter(Boolean).join(" / ") || undefined;
          }

          if (!name) {
            if (isGuestlistFormat) continue;
            errors.push({ row: rowIndex, field: "의뢰인", message: "의뢰인(이름)이 비어 있습니다." });
            continue;
          }

          clients.push({
            name,
            phone: phone || undefined,
            mobile: mobile || undefined,
            email: email || undefined,
            address: address || undefined,
            idNumber: idNumber || undefined,
            bizNumber: bizNumber || undefined,
            memo: memo || undefined,
          });
        }

        if (clients.length === 0 && errors.length === 0) {
          errors.push({ row: 0, message: "유효한 행이 없습니다. (빈 행은 제외되며, 의뢰인 이름은 필수입니다.)" });
        }

        resolve({
          valid: errors.length === 0,
          errors,
          clients,
        });
      } catch (err) {
        resolve({
          valid: false,
          errors: [{ row: 0, message: err instanceof Error ? err.message : "파일 파싱 중 오류가 발생했습니다." }],
          clients: [],
        });
      }
    };
    reader.onerror = () => {
      resolve({
        valid: false,
        errors: [{ row: 0, message: "파일을 읽는 중 오류가 발생했습니다." }],
        clients: [],
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

/** LawTop guestlist.xls 호환보내기 헤더 */
export const GUESTLIST_EXCEL_HEADERS = [
  "의뢰인명",
  "직위",
  "전화",
  "이동전화",
  "이메일",
  "주소",
  "고유번호",
  "비고",
] as const;

/**
 * LawTop guestlist 형식으로 고객 목록보내기
 */
export function exportClientsGuestlistToExcel(clients: ClientItem[]): void {
  const rows = clients.map((c) => ({
    의뢰인명: c.name ?? "",
    직위: c.position ?? "",
    전화: c.phone ?? "",
    이동전화: c.mobile ?? "",
    이메일: c.email ?? "",
    주소: c.address ?? "",
    고유번호: c.guestCode ?? "",
    비고: c.memo ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "guestlist");
  XLSX.writeFile(wb, `guestlist_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 고객 목록을 엑셀 파일로 다운로드
 */
export function exportClientsToExcel(clients: ClientItem[]): void {
  const rows = clients.map((c) => ({
    의뢰인: c.name ?? "",
    연락처: c.phone ?? "",
    휴대폰: c.mobile ?? "",
    이메일: c.email ?? "",
    주소: c.address ?? "",
    주민번호: c.idNumber ?? "",
    사업자번호: c.bizNumber ?? "",
    메모: c.memo ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "고객목록");
  XLSX.writeFile(wb, `고객목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 엑셀 추가용 빈 양식 다운로드
 */
export function downloadClientExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([[...CLIENT_EXCEL_HEADERS]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "고객목록");
  XLSX.writeFile(wb, `고객목록_양식_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
