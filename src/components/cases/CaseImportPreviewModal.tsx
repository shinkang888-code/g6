"use client";

import { X, FileSpreadsheet, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CaseImportPreviewData } from "@/lib/caseImportClient";
import type { CaseImportRowStatus } from "@/lib/caseImportServer";

const STATUS_LABEL: Record<CaseImportRowStatus, string> = {
  insert: "등록",
  duplicate_db: "DB중복",
  duplicate_batch: "파일중복",
  invalid: "오류",
};

const STATUS_CLASS: Record<CaseImportRowStatus, string> = {
  insert: "bg-primary-50 text-primary-700 border-primary-200",
  duplicate_db: "bg-amber-50 text-amber-800 border-amber-200",
  duplicate_batch: "bg-slate-100 text-slate-600 border-slate-200",
  invalid: "bg-danger-50 text-danger-700 border-danger-200",
};

type Props = {
  open: boolean;
  loading?: boolean;
  confirming?: boolean;
  data: CaseImportPreviewData | null;
  fileName?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function CaseImportPreviewModal({
  open,
  loading,
  confirming,
  data,
  fileName,
  onClose,
  onConfirm,
}: Props) {
  const summary = data?.summary;
  const insertCount = summary?.insert ?? 0;
  const invalidLocal = data?.invalidRows.length ?? 0;

  const allRows = [
    ...(data?.invalidRows.map((r) => ({
      excelRow: r.excelRow,
      caseNumber: "-",
      clientName: "-",
      caseName: "-",
      court: "-",
      assignedStaff: "-",
      status: "invalid" as const,
      reason: r.errors.join(" "),
    })) ?? []),
    ...(data?.rows ?? []),
  ].sort((a, b) => a.excelRow - b.excelRow);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
                <FileSpreadsheet size={22} className="text-primary-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900">사건 엑셀 import 미리보기</h3>
                  {fileName && <p className="text-xs text-slate-500 truncate">{fileName}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  aria-label="닫기"
                >
                  <X size={18} />
                </button>
              </div>

              {loading ? (
                <div className="p-10 text-center text-sm text-slate-500">엑셀 분석 및 DB 중복 확인 중…</div>
              ) : data ? (
                <>
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 shrink-0">
                    <span>
                      등록 예정 <strong className="text-primary-700">{insertCount}</strong>건
                    </span>
                    <span>
                      DB 중복 <strong className="text-amber-700">{summary?.duplicateDb ?? 0}</strong>건
                    </span>
                    <span>
                      파일 중복 <strong>{summary?.duplicateBatch ?? 0}</strong>건
                    </span>
                    {(invalidLocal > 0 || (summary?.invalid ?? 0) > 0) && (
                      <span>
                        오류 <strong className="text-danger-600">{invalidLocal + (summary?.invalid ?? 0)}</strong>건
                      </span>
                    )}
                    {data.mergedInFile > 0 && (
                      <span className="flex items-center gap-1">
                        <Copy size={12} />
                        엑셀 내 동일 사건 병합 <strong>{data.mergedInFile}</strong>건
                      </span>
                    )}
                    {data.skippedEmpty > 0 && (
                      <span>빈 행 무시 {data.skippedEmpty}건</span>
                    )}
                  </div>

                  <div className="overflow-auto flex-1 min-h-0">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-slate-200 text-xs text-slate-500">
                          <th className="px-3 py-2 text-left w-12">행</th>
                          <th className="px-3 py-2 text-left">사건번호</th>
                          <th className="px-3 py-2 text-left">의뢰인</th>
                          <th className="px-3 py-2 text-left">사건명</th>
                          <th className="px-3 py-2 text-left">기관</th>
                          <th className="px-3 py-2 text-left">담당</th>
                          <th className="px-3 py-2 text-left w-20">결과</th>
                          <th className="px-3 py-2 text-left">사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                              표시할 행이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          allRows.map((row, idx) => (
                            <tr key={`${row.excelRow}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50/80">
                              <td className="px-3 py-2 text-slate-500 tabular-nums">{row.excelRow}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{row.caseNumber}</td>
                              <td className="px-3 py-2">{row.clientName}</td>
                              <td className="px-3 py-2 max-w-[140px] truncate" title={row.caseName}>
                                {row.caseName}
                              </td>
                              <td className="px-3 py-2 text-xs">{row.court}</td>
                              <td className="px-3 py-2 text-xs">{row.assignedStaff}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                                    STATUS_CLASS[row.status]
                                  )}
                                >
                                  {STATUS_LABEL[row.status]}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-500 max-w-[200px]">{row.reason}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      {insertCount > 0 ? (
                        <>
                          <CheckCircle2 size={14} className="text-primary-600" />
                          확인 시 {insertCount}건만 DB에 등록됩니다.
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={14} className="text-amber-600" />
                          등록 가능한 신규 사건이 없습니다.
                        </>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={confirming}>
                        취소
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={onConfirm}
                        disabled={insertCount === 0 || confirming}
                      >
                        {confirming ? "등록 중…" : `${insertCount}건 등록`}
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
