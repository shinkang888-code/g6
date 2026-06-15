"use client";

import { useSearchParams } from "next/navigation";
import { CaseCourtDeadlinesSection } from "@/components/cases/CaseCourtDeadlinesSection";
import { CaseQuickPopupShell } from "@/components/cases/CaseQuickPopupShell";
import { useCaseItemById } from "@/hooks/useCaseItemById";
import { usePageTabTitle } from "@/lib/tabTitle";

export default function CaseDeadlineInfoPopupPage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNumberParam = searchParams.get("caseNumber") ?? "";
  const { caseItem, loading } = useCaseItemById(caseId);

  const caseNumber = caseItem?.caseNumber ?? caseNumberParam;
  usePageTabTitle(caseNumber ? `기일정보 · ${caseNumber}` : "기일정보");

  return (
    <CaseQuickPopupShell title="기일정보" caseNumber={caseNumber || undefined}>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          사건 정보를 불러오는 중…
        </div>
      ) : !caseItem ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          사건을 찾을 수 없습니다.
        </div>
      ) : (
        <div className="p-4 max-w-3xl mx-auto">
          <CaseCourtDeadlinesSection caseItem={caseItem} />
        </div>
      )}
    </CaseQuickPopupShell>
  );
}
