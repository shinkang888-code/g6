"use client";

import { X, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BulkStaffPlan, BulkStaffPlanStatus } from "@/lib/bulkStaffCore";

const STATUS_LABEL: Record<BulkStaffPlanStatus, string> = {
  apply: "적용",
  skip: "건너뜀",
  error: "오류",
};

const STATUS_CLASS: Record<BulkStaffPlanStatus, string> = {
  apply: "bg-primary-50 text-primary-700 border-primary-200",
  skip: "bg-slate-100 text-slate-600 border-slate-200",
  error: "bg-danger-50 text-danger-700 border-danger-200",
};

type Props = {
  open: boolean;
  loading?: boolean;
  confirming?: boolean;
  plan: BulkStaffPlan | null;
  selectedCount?: number;
  onClose: () => void;
  onConfirm: () => void;
};

export function BulkStaffPreviewModal({
  open,
  loading,
  confirming,
  plan,
  selectedCount = 0,
  onClose,
  onConfirm,
}: Props) {
  const applyCount = plan?.summary.apply ?? 0;

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
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
                <Users size={22} className="text-primary-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900">담당 일괄변경 미리보기</h3>
                  {plan?.actionLabel && (
                    <p className="text-xs text-primary-700 mt-0.5">{plan.actionLabel}</p>
                  )}
                  <p className="text-xs text-slate-500">선택 {selectedCount}건</p>
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
                <div className="p-10 text-center text-sm text-slate-500">변경 계획 계산 중…</div>
              ) : plan ? (
                <>
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 shrink-0">
                    <span>
                      적용 예정 <strong className="text-primary-700">{applyCount}</strong>건
                    </span>
                    <span>
                      건너뜀 <strong>{plan.summary.skip}</strong>건
                    </span>
                    {plan.summary.error > 0 && (
                      <span>
                        오류 <strong className="text-danger-600">{plan.summary.error}</strong>건
                      </span>
                    )}
                  </div>

                  <div className="overflow-auto flex-1 min-h-0">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-slate-200 text-xs text-slate-500">
                          <th className="px-3 py-2 text-left">사건번호</th>
                          <th className="px-3 py-2 text-left">의뢰인</th>
                          <th className="px-3 py-2 text-left hidden md:table-cell">사건명</th>
                          <th className="px-3 py-2 text-left">변경 전 수행</th>
                          <th className="px-3 py-2 text-left hidden lg:table-cell">변경 전 보조</th>
                          <th className="px-3 py-2 text-left">변경 후 수행</th>
                          <th className="px-3 py-2 text-left hidden lg:table-cell">변경 후 보조</th>
                          <th className="px-3 py-2 text-left w-16">결과</th>
                          <th className="px-3 py-2 text-left">사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.rows.map((row) => (
                          <tr key={row.caseId} className="border-b border-slate-50 hover:bg-slate-50/80">
                            <td className="px-3 py-2 font-medium text-slate-800">{row.caseNumber || "-"}</td>
                            <td className="px-3 py-2">{row.clientName || "-"}</td>
                            <td className="px-3 py-2 hidden md:table-cell max-w-[120px] truncate" title={row.caseName}>
                              {row.caseName || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs">{row.before.assignedStaff || "-"}</td>
                            <td className="px-3 py-2 text-xs hidden lg:table-cell max-w-[100px] truncate" title={row.before.assistants}>
                              {row.before.assistants || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-primary-800">
                              {row.after.assignedStaff || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs hidden lg:table-cell max-w-[100px] truncate" title={row.after.assistants}>
                              {row.after.assistants || "-"}
                            </td>
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
                            <td className="px-3 py-2 text-xs text-slate-500 max-w-[160px]">{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      {applyCount > 0 ? (
                        <>
                          <CheckCircle2 size={14} className="text-primary-600" />
                          확인 시 {applyCount}건만 반영됩니다.
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={14} className="text-amber-600" />
                          적용 가능한 사건이 없습니다.
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
                        disabled={applyCount === 0 || confirming}
                      >
                        {confirming ? "적용 중…" : `${applyCount}건 적용`}
                      </Button>
                    </div>
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
