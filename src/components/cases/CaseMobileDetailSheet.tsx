"use client";

import { MessageSquare, FileIcon } from "lucide-react";
import { MobileBottomSheet } from "@/components/ui/MobileBottomSheet";
import { CaseCourtDeadlinesSection } from "@/components/cases/CaseCourtDeadlinesSection";
import { StatusBadge } from "@/components/ui/badge";
import type { CaseItem, Timeline } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  caseItem: CaseItem | null;
  onCourtSyncDone?: (caseId: string, memos?: Timeline[]) => void;
  deadlinesRefreshKey?: number;
  memoPanel: React.ReactNode;
  docsPanel: React.ReactNode;
};

export function CaseMobileDetailSheet({
  open,
  onClose,
  caseItem,
  onCourtSyncDone,
  deadlinesRefreshKey,
  memoPanel,
  docsPanel,
}: Props) {
  const title = caseItem
    ? `${caseItem.caseNumber}${caseItem.caseName ? ` · ${caseItem.caseName}` : ""}`
    : "사건 상세";

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title={title}
      className="!max-h-[94dvh]"
    >
      {!caseItem ? (
        <p className="text-sm text-text-muted py-8 text-center">사건을 선택해 주세요.</p>
      ) : (
        <div className="flex flex-col gap-4 -mx-1 max-h-[min(82dvh,720px)] overflow-y-auto overscroll-contain pb-2">
          <div className="flex flex-wrap items-center gap-2 px-0.5 text-xs text-slate-600">
            <span className="truncate">{caseItem.court || "기관 미등록"}</span>
            <span className="text-slate-300">·</span>
            <span className="truncate">{caseItem.clientName || "의뢰인 미등록"}</span>
            <StatusBadge status={caseItem.status} />
          </div>

          <section aria-label="법원 기일 정보">
            <CaseCourtDeadlinesSection
              caseItem={caseItem}
              onSyncDone={onCourtSyncDone}
              refreshKey={deadlinesRefreshKey}
              mobile
            />
          </section>

          <section aria-label="메모장">
            <div className="flex items-center gap-1.5 mb-2 px-0.5 text-sm font-semibold text-slate-800">
              <MessageSquare size={15} className="text-primary-600" />
              메모장
            </div>
            <div className="min-h-[240px]">{memoPanel}</div>
          </section>

          <section aria-label="자료실">
            <div className="flex items-center gap-1.5 mb-2 px-0.5 text-sm font-semibold text-slate-800">
              <FileIcon size={15} className="text-primary-600" />
              자료실
            </div>
            <div className="min-h-[280px]">{docsPanel}</div>
          </section>
        </div>
      )}
    </MobileBottomSheet>
  );
}
