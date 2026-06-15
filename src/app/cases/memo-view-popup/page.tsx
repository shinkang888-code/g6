"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { CaseQuickPopupShell } from "@/components/cases/CaseQuickPopupShell";
import { useCaseItemById } from "@/hooks/useCaseItemById";
import { usePageTabTitle } from "@/lib/tabTitle";
import { mockTimeline } from "@/lib/mockData";
import {
  getInitialMemosFromMock,
  readCaseMemosForCase,
  subscribeCaseMemoChanges,
} from "@/lib/caseScopedStorage";
import { formatDate } from "@/lib/utils";
import type { Timeline } from "@/lib/types";

export default function CaseMemoViewPopupPage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const memoId = searchParams.get("memoId");
  const caseNumberParam = searchParams.get("caseNumber") ?? "";
  const { caseItem, loading } = useCaseItemById(caseId);
  const [memo, setMemo] = useState<Timeline | null>(null);

  const caseNumber = caseItem?.caseNumber ?? caseNumberParam;
  const mockSeed = useMemo(() => getInitialMemosFromMock(mockTimeline), []);

  const loadMemo = () => {
    if (!caseId || !memoId) {
      setMemo(null);
      return;
    }
    const list = readCaseMemosForCase(caseId, mockSeed);
    setMemo(list.find((m) => m.id === memoId) ?? null);
  };

  useEffect(() => {
    loadMemo();
  }, [caseId, memoId, mockSeed]);

  useEffect(() => {
    return subscribeCaseMemoChanges((changedCaseId) => {
      if (!caseId || (changedCaseId && changedCaseId !== caseId)) return;
      loadMemo();
    });
  }, [caseId, memoId, mockSeed]);

  usePageTabTitle(
    memo?.title
      ? `메모 · ${memo.title}`
      : caseNumber
        ? `메모 보기 · ${caseNumber}`
        : "메모 보기"
  );

  const isCourtSync = memo?.id.startsWith("court-sync");

  return (
    <CaseQuickPopupShell
      title={memo?.title ?? "메모 보기"}
      caseNumber={caseNumber || undefined}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          사건 정보를 불러오는 중…
        </div>
      ) : !caseItem || !memoId ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          메모 정보가 없습니다.
        </div>
      ) : !memo ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          메모를 찾을 수 없습니다. 삭제되었을 수 있습니다.
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 sm:px-5 py-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <MessageSquare size={14} className="text-primary-600" />
            {isCourtSync ? (
              <span className="font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                기일연동
              </span>
            ) : (
              <span className="font-medium px-1.5 py-0.5 rounded bg-primary-50 text-primary-700">
                메모
              </span>
            )}
            <span className="tabular-nums">
              {formatDate(memo.date)} {formatDate(memo.date, "time")}
            </span>
            {memo.authorName ? <span>· {memo.authorName}</span> : null}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5">
            <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
              {memo.content || "(내용 없음)"}
            </pre>
          </div>
        </div>
      )}
    </CaseQuickPopupShell>
  );
}
