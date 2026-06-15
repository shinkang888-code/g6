/**
 * 기일 엑셀 — LawTop datelist.xls 형식 import/export (round-trip)
 */

import * as XLSX from "xlsx";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** datelist.xls import API와 동일 헤더 */
export const DEADLINE_EXCEL_HEADERS = [
  "구분",
  "의뢰인(고객)",
  "진행일(요일)",
  "기일명/내용",
  "기관",
  "D-일",
  "▪ 특이사항",
  "결과",
  "사건번호",
  "출석",
  "수행",
  "장소",
  "시각",
  "약속시간",
  "등록인",
  "복대리",
  "준비사항/기타",
] as const;

export type DeadlineExportItem = {
  caseNumber?: string;
  clientName?: string;
  date?: string;
  type?: string;
  court?: string;
  memo?: string;
  assignedStaff?: string;
  isImmutable?: boolean;
  completedAt?: string | null;
};

function formatProgressDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const wd = WEEKDAYS[d.getDay()];
  return `${dateStr} (${wd})`;
}

function parseMemoField(memo: string, key: string): string {
  const re = new RegExp(`${key}:\\s*([^/·]+)`);
  const m = memo.match(re);
  return m ? m[1].trim() : "";
}

function splitMemoParts(memo: string): {
  special: string;
  prep: string;
  result: string;
  place: string;
  time: string;
  registrar: string;
  substitute: string;
} {
  const raw = String(memo ?? "").trim();
  if (!raw) {
    return { special: "", prep: "", result: "", place: "", time: "", registrar: "", substitute: "" };
  }
  const segments = raw.split(/\s*\/\s*/);
  let special = "";
  let prep = "";
  let result = "";
  for (const seg of segments) {
    if (seg.startsWith("담당자:") || seg.startsWith("장소:") || seg.startsWith("시각:") || seg.startsWith("등록인:") || seg.startsWith("복대리:")) {
      continue;
    }
    if (!special) special = seg;
    else if (!prep) prep = seg;
    else if (!result) result = seg;
  }
  return {
    special,
    prep,
    result,
    place: parseMemoField(raw, "장소"),
    time: parseMemoField(raw, "시각"),
    registrar: parseMemoField(raw, "등록인"),
    substitute: parseMemoField(raw, "복대리"),
  };
}

export function deadlineToLawTopRow(d: DeadlineExportItem): Record<string, string> {
  const parts = splitMemoParts(d.memo ?? "");
  const date = d.date ?? "";
  return {
    구분: "",
    "의뢰인(고객)": d.clientName ?? "",
    "진행일(요일)": date ? formatProgressDate(date) : "",
    "기일명/내용": d.type ?? "기일",
    기관: d.court ?? "",
    "D-일": d.isImmutable ? "불변" : "",
    "▪ 특이사항": parts.special,
    결과: d.completedAt ? parts.result || "완료" : parts.result,
    사건번호: d.caseNumber ?? "",
    출석: d.assignedStaff ?? "",
    수행: d.assignedStaff ?? "",
    장소: parts.place,
    시각: parts.time,
    약속시간: parts.time,
    등록인: parts.registrar,
    복대리: parts.substitute,
    "준비사항/기타": parts.prep,
  };
}

export function exportDeadlinesToLawTopExcel(
  items: DeadlineExportItem[],
  filenamePrefix = "기일목록"
): void {
  const rows = items.map(deadlineToLawTopRow);
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [Object.fromEntries(DEADLINE_EXCEL_HEADERS.map((h) => [h, ""]))]
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "기일");
  XLSX.writeFile(wb, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadDeadlineExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([[...DEADLINE_EXCEL_HEADERS]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "기일");
  XLSX.writeFile(wb, `기일등록_양식_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
