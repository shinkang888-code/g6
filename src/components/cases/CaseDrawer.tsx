"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Zap, AlertTriangle } from "lucide-react";
import type { CaseItem } from "@/lib/types";
import { cn, formatDate, getDDay, formatAmount } from "@/lib/utils";
import { StatusBadge, DDayBadge, ElectronicBadge, ImmutableBadge } from "@/components/ui/badge";
import { StaffChips } from "./StaffChips";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CaseDrawerProps {
  caseItem: CaseItem | null;
  onClose: () => void;
}

export function CaseDrawer({ caseItem, onClose }: CaseDrawerProps) {
  return (
    <AnimatePresence>
      {caseItem && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className={cn(
              "flex items-start justify-between p-5 border-b border-slate-100",
              caseItem.isUrgent && caseItem.nextDate && getDDay(caseItem.nextDate) <= 0
                ? "bg-danger-50"
                : "bg-white"
            )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {caseItem.isElectronic && <ElectronicBadge />}
                  {caseItem.isImmutable && <ImmutableBadge />}
                  <StatusBadge status={caseItem.status} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{caseItem.caseNumber}</h2>
                <p className="text-sm text-slate-600 mt-0.5">{caseItem.caseName}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Next date */}
              {caseItem.nextDate && (
                <div className={cn(
                  "rounded-xl p-4 border",
                  getDDay(caseItem.nextDate) <= 0
                    ? "bg-danger-50 border-danger-200"
                    : getDDay(caseItem.nextDate) <= 3
                    ? "bg-warning-50 border-warning-200"
                    : "bg-primary-50 border-primary-200"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-text-muted mb-1">다음 기일</div>
                      <div className="text-lg font-bold text-slate-900">{formatDate(caseItem.nextDate)}</div>
                      <div className="text-sm text-slate-600">{caseItem.nextDateType} · {caseItem.court}</div>
                    </div>
                    <DDayBadge dday={getDDay(caseItem.nextDate)} />
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="의뢰인" value={caseItem.clientName} />
                <InfoRow label="지위" value={caseItem.clientPosition} />
                <InfoRow label="상대방" value={caseItem.opponentName} />
                <InfoRow label="사건종류" value={caseItem.caseType} />
                <InfoRow label="수임일" value={formatDate(caseItem.receivedDate)} />
                <InfoRow label="담당 변호사" value={caseItem.assignedStaff} />
              </div>

              {/* Staff */}
              <div>
                <div className="text-xs font-medium text-text-muted mb-2">담당 직원</div>
                <StaffChips staffStr={caseItem.assistants} max={5} />
              </div>

              {/* Finance */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600 mb-3">수임료 현황</div>
                <FinanceRow label="수임료" value={formatAmount(caseItem.amount)} />
                <FinanceRow label="수납액" value={formatAmount(caseItem.receivedAmount)} positive />
                <div className="border-t border-slate-200 pt-2 mt-1">
                  <FinanceRow
                    label="미수금"
                    value={formatAmount(caseItem.pendingAmount)}
                    danger={caseItem.pendingAmount > 0}
                  />
                </div>
              </div>

              {/* Notes */}
              {caseItem.notes && (
                <div>
                  <div className="text-xs font-medium text-text-muted mb-1.5">비고</div>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">
                    {caseItem.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-slate-100 p-4 flex gap-2">
              <Link href={`/cases/${caseItem.id}`} className="flex-1">
                <Button variant="primary" className="w-full" leftIcon={<ExternalLink size={14} />}>
                  상세 보기
                </Button>
              </Link>
              <Button variant="outline" onClick={onClose}>
                닫기
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value || "-"}</div>
    </div>
  );
}

function FinanceRow({ label, value, positive, danger }: {
  label: string; value: string; positive?: boolean; danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={cn(
        "font-semibold tabular-nums",
        positive ? "text-success-600" : danger ? "text-danger-600" : "text-slate-800"
      )}>
        {value}
      </span>
    </div>
  );
}

