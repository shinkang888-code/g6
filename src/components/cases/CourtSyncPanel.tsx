"use client";

import { useCallback, useState } from "react";
import { Link2, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyCourtSyncDeadlineMemo,
  applyDeadlineMemoContent,
} from "@/lib/caseDeadlineMemo";
import { canSyncCase } from "@/lib/scourtCaseParams";
import { toast } from "@/components/ui/toast";
import type { CaseItem, Timeline } from "@/lib/types";

type SyncItem = {
  id: string;
  caseNumber: string;
  court: string;
  clientName: string;
};

type SyncJson = {
  deadlineMemoContent?: string;
  deadlineMemoDate?: string;
  deadlineMemoChanged?: boolean;
};

async function syncCaseDeadlineMemo(
  caseItem: Pick<CaseItem, "id" | "caseNumber" | "clientName" | "court"> & {
    nextDate?: string | null;
    nextDateType?: string | null;
  },
  json: SyncJson,
  onDone?: (caseId: string, memos?: Timeline[]) => void | Promise<void>
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

  await onDone?.(caseItem.id, memos);
}

export function CourtSyncRowButton({
  caseItem,
  onDone,
}: {
  caseItem: CaseItem;
  /** 연동 성공 시 caseId·갱신된 메모 목록 전달 */
  onDone?: (caseId: string, memos?: Timeline[]) => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const syncable = canSyncCase(caseItem);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!syncable) {
      toast.error("사건번호·법원·의뢰인 정보가 부족해 연동할 수 없습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cases/sync-deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caseId: caseItem.id }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.skippedNoChange) {
          toast.success(`${caseItem.caseNumber} — 기일 변경 없음`);
        } else {
          const parts = [
            json.eventsAdded ? `추가 ${json.eventsAdded}` : "",
            json.eventsUpdated ? `수정 ${json.eventsUpdated}` : "",
            json.eventsRemoved ? `삭제 ${json.eventsRemoved}` : "",
          ].filter(Boolean);
          toast.success(
            `${caseItem.caseNumber} — ${parts.length ? parts.join(", ") : `기일 ${json.eventsAdded ?? 0}건 반영`}`
          );
        }
        await syncCaseDeadlineMemo(caseItem, json, onDone);
      } else if (json.skipped) {
        toast.error(json.skipReason ?? json.error);
      } else {
        const msg = json.error ?? "기일연동 실패";
        toast.error(
          msg.includes("법원에 해당 사건 없음")
            ? `${msg} (의뢰인명에 '外'·쉼표가 있으면 자동 정리 후 재시도)`
            : msg
        );
      }
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={loading || !syncable}
      title={
        syncable
          ? "법원 나의사건검색으로 기일 자동 연동"
          : "사건번호·법원·의뢰인 필요"
      }
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
      연동
    </button>
  );
}

export function CourtSyncBulkButton({
  onComplete,
}: {
  onComplete?: (syncedCaseIds: string[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{
    ok: number;
    fail: number;
    skip: number;
    lastError?: string;
  } | null>(null);

  const runBulk = useCallback(async () => {
    setRunning(true);
    setResults(null);
    try {
      const listRes = await fetch("/api/cases/sync-deadlines?status=진행중", {
        credentials: "include",
      });
      const listJson = await listRes.json();
      if (!listRes.ok) throw new Error(listJson.error ?? "목록 조회 실패");

      const cases = (listJson.cases ?? []) as SyncItem[];
      setProgress({ current: 0, total: cases.length });

      let ok = 0;
      let fail = 0;
      let skip = 0;
      let lastError = "";
      const syncedIds: string[] = [];

      for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        setProgress({ current: i + 1, total: cases.length });
        try {
          const res = await fetch("/api/cases/sync-deadlines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ caseId: c.id }),
          });
          const json = await res.json();
          if (json.ok) {
            ok += 1;
            syncedIds.push(c.id);
            await syncCaseDeadlineMemo(c, json, undefined);
          } else if (json.skipped) skip += 1;
          else {
            fail += 1;
            lastError = json.error ?? c.caseNumber;
          }
        } catch {
          fail += 1;
          lastError = c.caseNumber;
        }
      }

      setResults({ ok, fail, skip, lastError: lastError || undefined });
      toast.success(`법원기일연동 완료 — 성공 ${ok}건, 실패 ${fail}건, 제외 ${skip}건`);
      await onComplete?.(syncedIds);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전체 연동 실패");
    } finally {
      setRunning(false);
    }
  }, [onComplete]);

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        leftIcon={running ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
        onClick={() => {
          setOpen(true);
          setResults(null);
        }}
        disabled={running}
      >
        법원기일연동
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">법원기일연동</h2>
                <p className="text-xs text-text-muted mt-1">
                  현재 로그인한 관리번호(회사)의 진행중 사건만 조회합니다. 이미 연동된 사건은 변경된 기일만 반영하고,
                  변경이 없으면 DB·타임라인을 건너뜁니다. 로컬 봇(npm run queue)이 실행 중이어야 합니다.
                </p>
              </div>
              <button type="button" onClick={() => !running && setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {running && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>처리 중…</span>
                  <span>
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 transition-all"
                    style={{
                      width: progress.total
                        ? `${Math.round((progress.current / progress.total) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            )}

            {results && !running && (
              <div className="mb-4 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 size={16} /> 성공 {results.ok}건
                </div>
                {results.fail > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle size={16} /> 실패 {results.fail}건
                    {results.lastError && (
                      <span className="text-xs text-red-500 truncate">({results.lastError})</span>
                    )}
                  </div>
                )}
                {results.skip > 0 && (
                  <div className="text-xs text-slate-500">형식 불가 제외 {results.skip}건</div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={running}>
                닫기
              </Button>
              {!running && (
                <Button size="sm" onClick={runBulk} leftIcon={<Link2 size={14} />}>
                  {results ? "다시 실행" : "전체 연동 시작"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
