"use client";

import { X, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientImportPlan, ClientImportRowStatus } from "@/lib/clientImportServer";

const STATUS_LABEL: Record<ClientImportRowStatus, string> = {
  insert: "등록",
  duplicate_db: "DB중복",
  duplicate_batch: "파일중복",
  invalid: "오류",
};

const STATUS_CLASS: Record<ClientImportRowStatus, string> = {
  insert: "bg-primary-50 text-primary-700 border-primary-200",
  duplicate_db: "bg-amber-50 text-amber-800 border-amber-200",
  duplicate_batch: "bg-slate-100 text-slate-600 border-slate-200",
  invalid: "bg-danger-50 text-danger-700 border-danger-200",
};

type Props = {
  open: boolean;
  loading?: boolean;
  confirming?: boolean;
  isGuestlist?: boolean;
  plan: ClientImportPlan | null;
  fileName?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ClientImportPreviewModal({
  open,
  loading,
  confirming,
  isGuestlist,
  plan,
  fileName,
  onClose,
  onConfirm,
}: Props) {
  const summary = plan?.summary;
  const insertCount = summary?.insert ?? 0;

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
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
                <FileSpreadsheet size={22} className="text-primary-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900">고객 엑셀 import 미리보기</h3>
                  {fileName && <p className="text-xs text-slate-500 truncate">{fileName}</p>}
                  {isGuestlist && (
                    <p className="text-xs text-primary-600 mt-0.5">LawTop guestlist 형식 감지</p>
                  )}
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
              ) : plan ? (
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
                  </div>

                  {insertCount === 0 && (
                    <div className="mx-5 mt-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>등록할 신규 고객이 없습니다. 중복 행만 있거나 데이터가 비어 있습니다.</span>
                    </div>
                  )}

                  <div className="overflow-auto flex-1 min-h-0">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold text-slate-600">행</th>
                          <th className="text-left px-4 py-2 font-semibold text-slate-600">의뢰인</th>
                          <th className="text-left px-4 py-2 font-semibold text-slate-600 hidden sm:table-cell">고유번호</th>
                          <th className="text-left px-4 py-2 font-semibold text-slate-600 hidden md:table-cell">연락처</th>
                          <th className="text-left px-4 py-2 font-semibold text-slate-600">상태</th>
                          <th className="text-left px-4 py-2 font-semibold text-slate-600">사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.rows.map((row) => (
                          <tr key={row.excelRow} className="border-b border-slate-50 hover:bg-slate-50/80">
                            <td className="px-4 py-2 text-slate-500">{row.excelRow}</td>
                            <td className="px-4 py-2 font-medium text-slate-800">{row.name}</td>
                            <td className="px-4 py-2 text-slate-600 hidden sm:table-cell">{row.guestCode || "-"}</td>
                            <td className="px-4 py-2 text-slate-600 hidden md:table-cell">{row.phone || "-"}</td>
                            <td className="px-4 py-2">
                              <span
                                className={cn(
                                  "inline-flex px-2 py-0.5 rounded border text-[11px] font-medium",
                                  STATUS_CLASS[row.status]
                                )}
                              >
                                {STATUS_LABEL[row.status]}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-600">{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
                    <Button
                      size="sm"
                      onClick={onConfirm}
                      disabled={insertCount === 0 || confirming}
                    >
                      {confirming ? "등록 중…" : `${insertCount}건 등록`}
                    </Button>
                    <Button size="sm" variant="outline" onClick={onClose} disabled={confirming}>
                      취소
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-10 text-center text-sm text-slate-500">미리보기 데이터가 없습니다.</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
