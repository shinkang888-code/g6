"use client";

import { motion } from "framer-motion";
import { cn, getDDay } from "@/lib/utils";
import type { CaseItem } from "@/lib/types";
import { StatusBadge, DDayBadge, ElectronicBadge } from "@/components/ui/badge";
import { openCaseDetailPopup } from "@/lib/caseDetailPopup";
import { openCaseEditInNewTab, openCaseEditPopup } from "@/lib/caseEditPopup";

type Props = {
  cases: CaseItem[];
  selectedCaseId?: string | null;
  formatTableDate: (iso: string | null | undefined, compact?: boolean) => string;
  onSelect: (c: CaseItem) => void;
};

/** 모바일 전용 — 컴팩트 카드 목록 (세로 스크롤로 다건 표시) */
export function CasesMobileCardList({
  cases,
  selectedCaseId,
  formatTableDate,
  onSelect,
}: Props) {
  return (
    <ul className="lg:hidden divide-y divide-slate-100 pb-2">
      {cases.map((c) => {
        const dday = c.nextDate ? getDDay(c.nextDate) : null;
        const isUrgent = dday !== null && dday <= 0;

        return (
          <li key={c.id}>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => onSelect(c)}
              className={cn(
                "w-full text-left px-3 py-3 min-h-[72px]",
                "active:bg-primary-50/80 transition-colors",
                selectedCaseId === c.id && "bg-primary-50 ring-1 ring-inset ring-primary-200",
                isUrgent && selectedCaseId !== c.id && "bg-danger-50/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {c.isElectronic && <ElectronicBadge />}
                    <span
                      role="link"
                      tabIndex={0}
                      className="text-primary-600 font-bold text-sm truncate"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCaseDetailPopup(c.id, c.caseNumber);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          openCaseDetailPopup(c.id, c.caseNumber);
                        }
                      }}
                    >
                      {c.caseNumber}
                    </span>
                    <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1 py-0.5 shrink-0">
                      {c.caseType}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 text-sm mt-0.5 line-clamp-2 leading-snug">
                    {c.caseName || "-"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {c.clientName ? (
                      <span
                        role="link"
                        tabIndex={0}
                        className="text-primary-600 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCaseEditInNewTab(c.id, { clientName: c.clientName });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            openCaseEditInNewTab(c.id, { clientName: c.clientName });
                          }
                        }}
                      >
                        {c.clientName}
                      </span>
                    ) : (
                      "의뢰인 미등록"
                    )}
                    {c.court ? ` · ${c.court}` : ""}
                  </p>
                </div>
                {dday !== null && <DDayBadge dday={dday} />}
              </div>
              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100/80">
                <StatusBadge status={c.status} />
                <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                  {c.nextDate ? (
                    <span
                      className={cn(
                        "tabular-nums shrink-0",
                        isUrgent ? "text-danger-600 font-semibold" : "text-slate-700"
                      )}
                    >
                      기일 {formatTableDate(c.nextDate, true)}
                    </span>
                  ) : (
                    <span className="text-slate-400 shrink-0">기일 미정</span>
                  )}
                  {c.assignedStaff ? (
                    <>
                      <span className="text-slate-300">·</span>
                      <span
                        role="link"
                        tabIndex={0}
                        className="text-primary-600 truncate max-w-[5rem]"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCaseEditPopup(c.id, c.caseNumber);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            openCaseEditPopup(c.id, c.caseNumber);
                          }
                        }}
                      >
                        {c.assignedStaff}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}
