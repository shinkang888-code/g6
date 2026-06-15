/**
 * 사건 목록 엑셀 양식 다운로드 및 파싱 (관리자·사건 목록 페이지 공통)
 * - LawTop datacase.xlsx (키값·기일 행 포함) 지원
 */

import * as XLSX from "xlsx";
import { inferTrialLevel } from "@/lib/caseInstitutionTypes";

export const EXCEL_COLUMN_MAP: Record<string, string> = {
  키값: "managementKey",
  사건번호: "caseNumber",
  "사건 번호": "caseNumber",
  case_number: "caseNumber",
  사건종류: "caseType",
  종류: "caseType",
  소분류: "caseType",
  case_type: "caseType",
  사건명: "caseName",
  "사건 명": "caseName",
  case_name: "caseName",
  법원: "court",
  court: "court",
  계속기관: "court",
  계속부서: "courtDivision",
  의뢰인: "clientName",
  당사자: "clientName",
  client_name: "clientName",
  지위: "clientPosition",
  "의)지위": "clientPosition",
  client_position: "clientPosition",
  상대방: "opponentName",
  opponent_name: "opponentName",
  상태: "status",
  status: "status",
  담당자: "assignedStaff",
  수행변호사: "assignedStaff",
  수행: "assignedStaff",
  assigned_staff_name: "assignedStaff",
  수임: "retainerStaff",
  보조: "assistants",
  assistants: "assistants",
  수임일: "receivedDate",
  received_date: "receivedDate",
  등록일: "registeredDate",
  등록인: "createdByName",
  created_by_name: "createdByName",
  수임료: "amount",
  amount: "amount",
  수납액: "receivedAmount",
  received_amount: "receivedAmount",
  미수금: "pendingAmount",
  pending_amount: "pendingAmount",
  전자소송: "isElectronic",
  전자: "isElectronic",
  긴급: "isUrgent",
  기일고정: "isImmutable",
  is_electronic: "isElectronic",
  is_urgent: "isUrgent",
  is_immutable_deadline: "isImmutable",
  "진행/잔여일": "nextHearingDate",
  기일명: "nextHearingType",
  시각: "nextHearingTime",
  비고: "notes",
  notes: "notes",
};

/** 의뢰인명 앞에 오면 '종결'로 간주하는 기호 (◐ ◑ ◒ ◓ 등, 괄호 포함 가능) */
const CLOSED_SYMBOL_PATTERN = /[\u25D0-\u25D3]/u;
const CLOSED_STATUS_PREFIX = /^\s*\(?\s*[\u25D0-\u25D3\s]+/u;

export function normalizeClientNameForClosedStatus(
  name: string
): { name: string; status: "종결" | null } {
  const s = String(name ?? "").trim();
  if (!s) return { name: s, status: null };
  if (!CLOSED_SYMBOL_PATTERN.test(s)) return { name: s, status: null };
  const trimmed = s.replace(CLOSED_STATUS_PREFIX, "").replace(/[\u25D0-\u25D3\s]+/g, " ").trim();
  return { name: trimmed || s, status: "종결" };
}

export function toExcelBool(v: string | number | boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toUpperCase();
  return (
    s === "Y" ||
    s === "YES" ||
    s === "O" ||
    s === "1" ||
    s === "TRUE" ||
    s === "예" ||
    s === "ELEC"
  );
}

function excelDateToString(v: unknown): string | undefined {
  if (v === undefined || v === null || String(v).trim() === "") return undefined;
  if (typeof v === "number" && v > 10000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.slice(0, 10);
}

/** 사건번호 패턴으로 종류 추론 (LawTop 소분류 '기타' 보완) */
export function inferCaseType(caseNumber: string, caseType?: string): string {
  const t = String(caseType ?? "").trim();
  if (t && t !== "기타") return t;
  const n = String(caseNumber ?? "").replace(/\s/g, "");
  if (/고단|고합|노|초|재|준|^\d{4}두|^\d{4}카/.test(n)) return "형사";
  if (/가단|가합|가소|조|배|머|^\d{4}가/.test(n)) return "민사";
  if (/헌|헌바/.test(n)) return "헌법";
  if (/행/.test(n)) return "행정";
  if (/드|느|르|브|^\d{4}사/.test(n)) return "가사";
  return t || "민사";
}

function buildNotes(row: CaseExcelRow): string {
  const parts: string[] = [];
  const existing = String(row.notes ?? "").trim();
  if (existing) parts.push(existing);
  if (row.retainerStaff) parts.push(`수임: ${row.retainerStaff}`);
  if (row.nextHearingType || row.nextHearingDate) {
    const when = [row.nextHearingDate, row.nextHearingTime].filter(Boolean).join(" ");
    parts.push(`다음기일: ${row.nextHearingType ?? ""} ${when}`.trim());
  }
  return parts.join(" | ").slice(0, 2000);
}

function resolveCaseNumber(raw: Record<string, unknown>): string {
  const courtCase = String(raw.caseNumber ?? raw["사건번호"] ?? "").trim();
  if (courtCase) return courtCase;
  return String(raw.managementKey ?? raw["키값"] ?? "").trim();
}

function normalizeRow(raw: Record<string, unknown>): CaseExcelRow | null {
  const caseNumber = resolveCaseNumber(raw);
  if (!caseNumber) return null;

  const normalized: CaseExcelRow = { caseNumber };

  Object.entries(raw).forEach(([k, v]) => {
    const nk = EXCEL_COLUMN_MAP[k];
    if (!nk || nk === "caseNumber" || nk === "managementKey") return;
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      normalized[nk] = typeof v === "number" ? v : String(v).trim();
    }
  });

  const rawClientName = String(normalized.clientName ?? raw["의뢰인"] ?? "").trim();
  const { name: clientNameTrimmed, status: closedOverride } =
    normalizeClientNameForClosedStatus(rawClientName);
  normalized.clientName = clientNameTrimmed || "(의뢰인 없음)";
  if (closedOverride) normalized.status = closedOverride;
  if (!normalized.status) normalized.status = "진행중";

  normalized.caseType = inferCaseType(caseNumber, String(normalized.caseType ?? ""));
  normalized.trialLevel = inferTrialLevel(caseNumber);

  const received = excelDateToString(normalized.receivedDate ?? raw["수임일"]);
  if (received) normalized.receivedDate = received;

  const registered = excelDateToString(normalized.registeredDate ?? raw["등록일"]);
  if (registered) normalized.registeredDate = registered;

  const registrar = String(normalized.createdByName ?? raw["등록인"] ?? "").trim();
  if (registrar) normalized.createdByName = registrar;

  if (normalized.isElectronic !== undefined) {
    normalized.isElectronic = toExcelBool(normalized.isElectronic as string | number | boolean);
  }
  if (normalized.isUrgent !== undefined) {
    normalized.isUrgent = toExcelBool(normalized.isUrgent as string | number | boolean);
  }
  if (normalized.isImmutable !== undefined) {
    normalized.isImmutable = toExcelBool(normalized.isImmutable as string | number | boolean);
  }

  const notes = buildNotes(normalized);
  if (notes) normalized.notes = notes;

  // API에 불필요한 보조 필드 제거 (managementKey·courtDivision은 caseItemToDbRow로 전달)
  delete normalized.retainerStaff;
  delete normalized.nextHearingDate;
  delete normalized.nextHearingType;
  delete normalized.nextHearingTime;
  return normalized;
}

/** 사건번호+의뢰인 기준 중복 제거 (datacase는 기일별 다행) */
export function dedupeCaseRows(rows: CaseExcelRow[]): CaseExcelRow[] {
  const map = new Map<string, CaseExcelRow>();
  for (const row of rows) {
    const key = `${String(row.caseNumber).trim()}|${String(row.clientName ?? "").trim()}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    // 더 많은 정보가 있는 행 우선
    const score = (r: CaseExcelRow) =>
      [r.caseName, r.court, r.assignedStaff, r.notes].filter((v) => String(v ?? "").trim()).length;
    if (score(row) > score(prev)) map.set(key, row);
  }
  return Array.from(map.values());
}

export type CaseExcelParseDetail = {
  excelRow: number;
  item: CaseExcelRow | null;
  errors: string[];
};

export type CaseExcelParseResult = {
  details: CaseExcelParseDetail[];
  items: CaseExcelRow[];
  mergedInFile: number;
  skippedEmpty: number;
};

function isEmptySheetRow(row: unknown[]): boolean {
  return row.every((v) => v === undefined || v === null || String(v).trim() === "");
}

function parseRowsDetailed(rows: unknown[][]): CaseExcelParseResult {
  const details: CaseExcelParseDetail[] = [];
  let skippedEmpty = 0;

  if (rows.length < 2) {
    return { details, items: [], mergedInFile: 0, skippedEmpty: 0 };
  }

  const headers = (rows[0] as unknown[]).map((h) => String(h ?? "").trim());
  const validItems: CaseExcelRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const excelRow = i + 1;
    const row = rows[i] as unknown[];
    if (isEmptySheetRow(row)) {
      skippedEmpty += 1;
      continue;
    }

    const raw: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      if (!h) return;
      const val = row[j];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        raw[h] = val;
        const mapped = EXCEL_COLUMN_MAP[h];
        if (mapped) raw[mapped] = val;
      }
    });

    const caseNumber = resolveCaseNumber(raw);
    if (!caseNumber) {
      details.push({
        excelRow,
        item: null,
        errors: ["사건번호(또는 키값)가 없습니다."],
      });
      continue;
    }

    const normalized = normalizeRow(raw);
    if (!normalized) {
      details.push({ excelRow, item: null, errors: ["행을 사건 데이터로 변환할 수 없습니다."] });
      continue;
    }

    normalized._excelRow = excelRow;
    validItems.push(normalized);
    details.push({ excelRow, item: normalized, errors: [] });
  }

  const items = dedupeCaseRows(validItems);
  const mergedInFile = Math.max(0, validItems.length - items.length);

  return { details, items, mergedInFile, skippedEmpty };
}

function parseRows(rows: unknown[][]): CaseExcelRow[] {
  return parseRowsDetailed(rows).items;
}

export type CaseExcelRow = Record<string, string | number | boolean>;

/** Node/스크립트용 — Buffer에서 사건 행 파싱 */
export function parseExcelBufferToCases(buffer: ArrayBuffer | Buffer): CaseExcelRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  return parseRows(rows);
}

function readWorkbookRows(data: string | ArrayBuffer): unknown[][] {
  const wb =
    typeof data === "string"
      ? XLSX.read(data, { type: "binary" })
      : XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
}

export function parseExcelFileToCases(file: File): Promise<CaseExcelRow[]> {
  return parseExcelFileDetailed(file).then((r) => r.items);
}

/** LawTop ImportRow 패턴 — 행별 오류·병합 건수 포함 상세 파싱 */
export function parseExcelFileDetailed(file: File): Promise<CaseExcelParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          return reject(new Error("파일을 읽을 수 없습니다."));
        }
        resolve(parseRowsDetailed(readWorkbookRows(data)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsArrayBuffer(file);
  });
}

export const CASE_EXCEL_HEADERS = [
  "사건번호",
  "사건종류",
  "사건명",
  "법원",
  "의뢰인",
  "지위",
  "상대방",
  "상태",
  "담당자",
  "보조",
  "수임일",
  "등록일",
  "등록인",
  "수임료",
  "수납액",
  "미수금",
  "전자소송",
  "긴급",
  "기일고정",
  "비고",
] as const;

export function downloadCaseExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([[...CASE_EXCEL_HEADERS]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사건목록");
  XLSX.writeFile(wb, `사건등록_양식_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function toExcelYn(v: boolean | undefined): string {
  return v ? "Y" : "";
}

/** import 양식과 동일 컬럼으로 변환 (LawTop 그리드 ↔ 엑셀 round-trip) */
export function caseToExcelRow(c: {
  caseNumber?: string;
  caseType?: string;
  caseName?: string;
  court?: string;
  clientName?: string;
  clientPosition?: string;
  opponentName?: string;
  status?: string;
  assignedStaff?: string;
  assistants?: string;
  receivedDate?: string;
  registeredDate?: string;
  createdByName?: string;
  createdAt?: string;
  amount?: number;
  receivedAmount?: number;
  pendingAmount?: number;
  isElectronic?: boolean;
  isUrgent?: boolean;
  isImmutable?: boolean;
  notes?: string;
  nextDate?: string | null;
  nextDateType?: string;
}): Record<string, string | number> {
  let clientName = c.clientName ?? "";
  if (c.status === "종결" && !CLOSED_SYMBOL_PATTERN.test(clientName)) {
    clientName = `◐${clientName}`;
  }

  return {
    사건번호: c.caseNumber ?? "",
    사건종류: c.caseType ?? "",
    사건명: c.caseName ?? "",
    법원: c.court ?? "",
    의뢰인: clientName,
    지위: c.clientPosition ?? "",
    상대방: c.opponentName ?? "",
    상태: c.status ?? "진행중",
    담당자: c.assignedStaff ?? "",
    보조: c.assistants ?? "",
    수임일: c.receivedDate ?? "",
    등록일: c.registeredDate ?? c.createdAt?.slice(0, 10) ?? "",
    등록인: c.createdByName ?? "",
    수임료: c.amount ?? 0,
    수납액: c.receivedAmount ?? 0,
    미수금: c.pendingAmount ?? 0,
    전자소송: toExcelYn(c.isElectronic),
    긴급: toExcelYn(c.isUrgent),
    기일고정: toExcelYn(c.isImmutable),
    비고: c.notes ?? "",
    "진행/잔여일": c.nextDate ?? "",
    기일명: c.nextDateType ?? "",
  };
}

/** 검색·필터 결과를 엑셀로보내기 (import 양식과 호환) */
export function exportCasesToExcel(
  cases: Parameters<typeof caseToExcelRow>[0][],
  filenamePrefix = "사건목록"
): void {
  const rows = cases.map(caseToExcelRow);
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [Object.fromEntries(CASE_EXCEL_HEADERS.map((h) => [h, ""]))]
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사건목록");
  XLSX.writeFile(wb, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
