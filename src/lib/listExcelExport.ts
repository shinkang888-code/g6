/**
 * 목록 화면 공통 — 검색·필터 결과 엑셀보내기 (LawTop btn__Search_Excel 패턴)
 */

import * as XLSX from "xlsx";

export type ExcelColumn<T> = {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

export function exportSearchResultExcel<T>(
  rows: T[],
  columns: ExcelColumn<T>[],
  options: {
    filenamePrefix: string;
    sheetName?: string;
  }
): boolean {
  if (rows.length === 0) return false;

  const sheetRows = rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of columns) {
      const v = col.value(row);
      out[col.header] = v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "Y" : "") : v;
    }
    return out;
  });

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName ?? "목록");
  XLSX.writeFile(wb, `${options.filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}
