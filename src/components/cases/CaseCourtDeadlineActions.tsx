"use client";

import { useCallback, useState } from "react";
import { ExternalLink, Link2, Loader2 } from "lucide-react";
import {
  applyCourtSyncDeadlineMemo,
  applyDeadlineMemoContent,
} from "@/lib/caseDeadlineMemo";
import { canSyncCase, buildScourtJobFromCase } from "@/lib/scourtCaseParams";
import { openScourtAssistForCase } from "@/lib/scourtLinks";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { CaseItem, Timeline } from "@/lib/types";

type SyncJson = {
  deadlineMemoContent?: string;
  deadlineMemoDate?: string;
  deadlineMemoChanged?: boolean;
  eventsAdded?: number;
  eventsUpdated?: number;
  eventsRemoved?: number;
  skippedNoChange?: boolean;
  ok?: boolean;
  error?: string;
  skipReason?: string;
  skipped?: boolean;
};

async function applySyncMemo(
  caseItem: Pick<CaseItem, "id" | "caseNumber" | "clientName" | "court"> & {
    nextDate?: string | null;
    nextDateType?: string | null;
  },
  json: SyncJson,
  onSyncDone?: (caseId: string, memos?: Timeline[]) => void | Promise<void>
) {
  let memos: Timeline[] | undefined;

  if (json.deadlineMemoContent && json.deadlineMemoChanged) {
    memos = applyDeadlineMemoContent(caseItem.id, json.deadlineMemoContent, {
      date: json.deadlineMemoDate ?? caseItem.nextDate ?? new Date().toISOString().slice(0, 10),
      id: "court-sync",
    });
  } else {
    const result = await applyCourtSyncDeadlineMemo(caseItem.id, {
      caseNumber: caseItem.caseNumber,
      clientName: caseItem.clientName,
      court: caseItem.court,
      nextDate: caseItem.nextDate ?? undefined,
      nextDateType: caseItem.nextDateType ?? undefined,
    });
    memos = result?.memos;
  }

  await onSyncDone?.(caseItem.id, memos);
}

function formatSyncToast(caseNumber: string, json: SyncJson): string {
  if (json.skippedNoChange) return `${caseNumber} — 기일 변경 없음`;
  const parts = [
    json.eventsAdded ? `추가 ${json.eventsAdded}` : "",
    json.eventsUpdated ? `수정 ${json.eventsUpdated}` : "",
    json.eventsRemoved ? `삭제 ${json.eventsRemoved}` : "",
  ].filter(Boolean);
  return `${caseNumber} — ${parts.length ? parts.join(", ") : "기일 연동 완료"}`;
}

export function CaseCourtDeadlineActions({
  caseItem,
  onSyncDone,
  mobile = false,
}: {
  caseItem: CaseItem;
  onSyncDone?: (caseId: string, memos?: Timeline[]) => void | Promise<void>;
  mobile?: boolean;
}) {
  const [autoLoading, setAutoLoading] = useState(false);
  const [assistLoading, setAssistLoading] = useState(false);
  const syncable = canSyncCase(caseItem);

  const handleAutoSync = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!syncable) {
        toast.error("사건번호·기관·당사자 정보가 부족해 연동할 수 없습니다.");
        return;
      }

      setAutoLoading(true);
      try {
        const res = await fetch("/api/cases/sync-deadlines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ caseId: caseItem.id }),
        });
        const json = (await res.json()) as SyncJson;

        if (json.ok) {
          toast.success(formatSyncToast(caseItem.caseNumber, json));
          await applySyncMemo(caseItem, json, onSyncDone);
          return;
        }

        if (json.skipped) {
          toast.error(json.skipReason ?? json.error ?? "연동 제외");
          return;
        }

        const msg = json.error ?? "기일 연동 실패";
        toast.error(
          msg.includes("법원에 해당 사건 없음")
            ? `${msg} (의뢰인명에 '外'·쉼표가 있으면 자동 정리 후 재시도)`
            : msg
        );
      } catch {
        toast.error("네트워크 오류로 기일 연동에 실패했습니다.");
      } finally {
        setAutoLoading(false);
      }
    },
    [caseItem, onSyncDone, syncable]
  );

  const handleScourtAssist = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!syncable) {
        toast.error("사건번호·기관·당사자 정보가 부족합니다.");
        return;
      }

      const built = buildScourtJobFromCase({
        id: caseItem.id,
        case_number: caseItem.caseNumber,
        court: caseItem.court,
        client_name: caseItem.clientName,
      });
      if ("error" in built) {
        toast.error(built.error);
        return;
      }

      setAssistLoading(true);
      try {
        const { copied, mode } = await openScourtAssistForCase({
          caseId: caseItem.id,
          caseNumber: caseItem.caseNumber,
          partyName: caseItem.clientName,
          court: caseItem.court,
          autoOpenSite: true,
          mobile,
        });

        if (copied) {
          toast.success(
            mode === "sheet"
              ? "나의사건검색 연동 화면을 열었습니다. 조회 후 [조회완료·기일연동]을 눌러주세요."
              : "검색 정보가 복사되었습니다. 나의사건검색 탭에서 붙여넣기 후, 보조창에서 [조회완료·기일연동]을 눌러주세요."
          );
        } else {
          toast.success("나의사건검색 연동 화면을 열었습니다.");
        }
      } catch {
        toast.error("나의사건검색 연동 화면을 열지 못했습니다.");
      } finally {
        setAssistLoading(false);
      }
    },
    [caseItem, mobile, syncable]
  );

  const btnClass = cn(
    "inline-flex items-center gap-1 rounded-md text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed",
    mobile ? "px-2.5 py-1.5 min-h-[32px]" : "px-2 py-1"
  );

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={handleAutoSync}
        disabled={autoLoading || assistLoading || !syncable}
        title={syncable ? "봇으로 나의사건검색 조회 후 기일 자동 연동" : "사건번호·기관·당사자 필요"}
        className={cn(btnClass, "text-primary-700 bg-primary-50 hover:bg-primary-100")}
      >
        {autoLoading ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
        연동
      </button>
      <button
        type="button"
        onClick={handleScourtAssist}
        disabled={autoLoading || assistLoading || !syncable}
        title="대법원 나의사건검색에서 조회 후 기일 연동"
        className={cn(btnClass, "text-slate-700 bg-white border border-slate-200 hover:bg-slate-50")}
      >
        {assistLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <ExternalLink size={12} />
        )}
        나사검연동
      </button>
    </div>
  );
}
