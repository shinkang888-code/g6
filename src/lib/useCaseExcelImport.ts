"use client";

import { useCallback, useState } from "react";
import { toast } from "@/components/ui/toast";
import { parseExcelFileDetailed } from "@/lib/caseExcel";
import {
  confirmCaseImport,
  fetchCaseImportPreview,
  type CaseImportPreviewData,
} from "@/lib/caseImportClient";

export function useCaseExcelImport(onSuccess?: () => void) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewData, setPreviewData] = useState<CaseImportPreviewData | null>(null);
  const [fileName, setFileName] = useState("");

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewData(null);
    setFileName("");
  }, []);

  const handleExcelFile = useCallback(async (file: File) => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    setFileName(file.name);
    setPreviewData(null);
    try {
      const parsed = await parseExcelFileDetailed(file);
      const invalidRows = parsed.details
        .filter((d) => d.errors.length > 0)
        .map((d) => ({ excelRow: d.excelRow, errors: d.errors }));

      if (parsed.items.length === 0 && invalidRows.length === 0) {
        toast.error("엑셀에서 사건 데이터를 찾을 수 없습니다. 첫 행에 헤더(사건번호, 의뢰인 등)가 있어야 합니다.");
        closePreview();
        return;
      }

      let apiPreview = {
        rows: [] as CaseImportPreviewData["rows"],
        summary: {
          total: 0,
          insert: 0,
          duplicateDb: 0,
          duplicateBatch: 0,
          invalid: invalidRows.length,
        },
        itemsToInsert: [] as CaseImportPreviewData["itemsToInsert"],
      };

      if (parsed.items.length > 0) {
        const remote = await fetchCaseImportPreview(parsed.items);
        apiPreview = {
          rows: remote.rows,
          summary: {
            ...remote.summary,
            invalid: remote.summary.invalid + invalidRows.length,
          },
          itemsToInsert: remote.itemsToInsert,
        };
      }

      setPreviewData({
        ...apiPreview,
        invalidRows,
        mergedInFile: parsed.mergedInFile,
        skippedEmpty: parsed.skippedEmpty,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "엑셀 분석 실패");
      closePreview();
    } finally {
      setPreviewLoading(false);
    }
  }, [closePreview]);

  const confirmImport = useCallback(async () => {
    if (!previewData?.itemsToInsert.length) return;
    setConfirming(true);
    try {
      const result = await confirmCaseImport(previewData.itemsToInsert);
      toast.success(result.message);
      closePreview();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "등록 실패");
    } finally {
      setConfirming(false);
    }
  }, [previewData, closePreview, onSuccess]);

  return {
    previewOpen,
    previewLoading,
    confirming,
    previewData,
    fileName,
    handleExcelFile,
    closePreview,
    confirmImport,
  };
}
