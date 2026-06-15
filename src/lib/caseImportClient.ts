import type { CaseExcelRow } from "@/lib/caseExcel";
import type { CaseImportPlanRow } from "@/lib/caseImportServer";

export type CaseImportPreviewSummary = {
  total: number;
  insert: number;
  duplicateDb: number;
  duplicateBatch: number;
  invalid: number;
};

export type CaseImportPreviewData = {
  rows: CaseImportPlanRow[];
  invalidRows: Array<{ excelRow: number; errors: string[] }>;
  mergedInFile: number;
  skippedEmpty: number;
  summary: CaseImportPreviewSummary;
  itemsToInsert: CaseExcelRow[];
};

export async function fetchCaseImportPreview(
  items: CaseExcelRow[]
): Promise<CaseImportPreviewData> {
  const res = await fetch("/api/admin/cases/import-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "import 미리보기 실패");
  }
  return {
    rows: json.rows ?? [],
    invalidRows: [],
    mergedInFile: 0,
    skippedEmpty: 0,
    summary: json.summary ?? {
      total: 0,
      insert: 0,
      duplicateDb: 0,
      duplicateBatch: 0,
      invalid: 0,
    },
    itemsToInsert: json.itemsToInsert ?? [],
  };
}

export async function confirmCaseImport(items: CaseExcelRow[]): Promise<{
  message: string;
  inserted: number;
  skippedExisting: number;
  skippedInBatch: number;
}> {
  const payload = items.map(({ _excelRow, ...rest }) => rest);
  const res = await fetch("/api/admin/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items: payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "등록 실패");
  return {
    message: data.message ?? "등록되었습니다.",
    inserted: data.inserted ?? 0,
    skippedExisting: data.skippedExisting ?? 0,
    skippedInBatch: data.skippedInBatch ?? 0,
  };
}
