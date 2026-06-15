"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CaseMemoTab } from "@/components/cases/CaseMemoTab";
import { CaseQuickPopupShell } from "@/components/cases/CaseQuickPopupShell";
import { useCaseItemById } from "@/hooks/useCaseItemById";
import { usePageTabTitle } from "@/lib/tabTitle";
import { mockTimeline } from "@/lib/mockData";
import {
  getInitialMemosFromMock,
  persistCaseMemos,
  readCaseMemosForCase,
  subscribeCaseMemoChanges,
} from "@/lib/caseScopedStorage";
import type { Timeline } from "@/lib/types";

export default function CaseMemoPopupPage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNumberParam = searchParams.get("caseNumber") ?? "";
  const { caseItem, loading } = useCaseItemById(caseId);
  const [memos, setMemos] = useState<Timeline[]>([]);

  const caseNumber = caseItem?.caseNumber ?? caseNumberParam;
  usePageTabTitle(caseNumber ? `메모장 · ${caseNumber}` : "메모장");

  const mockSeed = useMemo(() => getInitialMemosFromMock(mockTimeline), []);

  useEffect(() => {
    if (!caseId) {
      setMemos([]);
      return;
    }
    setMemos(readCaseMemosForCase(caseId, mockSeed));
  }, [caseId, mockSeed]);

  const updateMemos = useCallback(
    (next: Timeline[]) => {
      if (!caseId) return;
      setMemos(next);
      persistCaseMemos(caseId, next, mockSeed);
    },
    [caseId, mockSeed]
  );

  useEffect(() => {
    if (!caseId) return;
    return subscribeCaseMemoChanges((changedCaseId) => {
      if (changedCaseId && changedCaseId !== caseId) return;
      const fresh = readCaseMemosForCase(caseId, mockSeed);
      setMemos((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
    });
  }, [caseId, mockSeed]);

  return (
    <CaseQuickPopupShell title="메모장" caseNumber={caseNumber || undefined}>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          사건 정보를 불러오는 중…
        </div>
      ) : !caseItem ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          사건을 찾을 수 없습니다.
        </div>
      ) : (
        <CaseMemoTab caseItem={caseItem} memos={memos} onMemosChange={updateMemos} />
      )}
    </CaseQuickPopupShell>
  );
}
