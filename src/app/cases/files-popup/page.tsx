"use client";

import { useSearchParams } from "next/navigation";
import { CaseFilesRoomPopup } from "@/components/cases/CaseFilesRoomPopup";
import { CaseQuickPopupShell } from "@/components/cases/CaseQuickPopupShell";
import { useCaseItemById } from "@/hooks/useCaseItemById";
import { usePageTabTitle } from "@/lib/tabTitle";

export default function CaseFilesPopupPage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNumberParam = searchParams.get("caseNumber") ?? "";
  const { caseItem, loading } = useCaseItemById(caseId);

  const caseNumber = caseItem?.caseNumber ?? caseNumberParam;
  usePageTabTitle(caseNumber ? `자료실 · ${caseNumber}` : "자료실");

  return (
    <CaseQuickPopupShell title="자료실" caseNumber={caseNumber || undefined}>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          사건 정보를 불러오는 중…
        </div>
      ) : !caseItem ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          사건을 찾을 수 없습니다.
        </div>
      ) : (
        <CaseFilesRoomPopup caseItem={caseItem} />
      )}
    </CaseQuickPopupShell>
  );
}
