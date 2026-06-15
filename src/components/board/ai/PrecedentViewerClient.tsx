"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ExternalLink, Loader2, RefreshCw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildPrecedentLawGoKrSearchUrl,
  buildPrecedentScourtSearchUrl,
  isValidPrecedentCaseNumber,
  openPrecedentExternalTab,
} from "@/lib/precedentLinks";
import { normalizePrecedentCaseNumber, readPrecedentViewerPayload } from "@/lib/precedentViewerStorage";

type PrecedentPayload = {
  ok: boolean;
  source: "openApi" | "aiCache" | "fallback";
  caseNumber: string;
  title?: string;
  court?: string;
  date?: string;
  html?: string;
  text?: string;
  externalUrl: string;
  scourtUrl: string;
  error?: string;
};

export function PrecedentViewerClient() {
  const searchParams = useSearchParams();
  const caseNumber = normalizePrecedentCaseNumber(searchParams.get("caseNumber") ?? "");
  const cached = useMemo(
    () => (caseNumber ? readPrecedentViewerPayload(caseNumber) : null),
    [caseNumber]
  );

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PrecedentPayload | null>(null);

  const aiFallbackText = (cached?.fullText ?? cached?.bodySummary ?? "").trim();

  const load = useCallback(async () => {
    if (!isValidPrecedentCaseNumber(caseNumber)) {
      setPayload(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ caseNumber });
      if (aiFallbackText) params.set("aiText", aiFallbackText.slice(0, 12000));

      const res = await fetch(`/api/precedent?${params.toString()}`, { credentials: "include" });
      const data = (await res.json()) as PrecedentPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "판례 조회 실패");
      setPayload(data);
    } catch (e) {
      setPayload({
        ok: true,
        source: "fallback",
        caseNumber,
        externalUrl: buildPrecedentLawGoKrSearchUrl(caseNumber),
        scourtUrl: buildPrecedentScourtSearchUrl(caseNumber),
        text: aiFallbackText || undefined,
        html: aiFallbackText
          ? `<div class="whitespace-pre-wrap leading-relaxed">${aiFallbackText.replace(/</g, "&lt;")}</div>`
          : undefined,
        error: e instanceof Error ? e.message : "판례를 불러오지 못했습니다.",
      });
    } finally {
      setLoading(false);
    }
  }, [caseNumber, aiFallbackText]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isValidPrecedentCaseNumber(caseNumber)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 max-w-md text-center">
          <Scale size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600">표시할 판례 번호가 없거나 형식이 올바르지 않습니다.</p>
        </div>
      </div>
    );
  }

  const externalUrl = payload?.externalUrl ?? buildPrecedentLawGoKrSearchUrl(caseNumber);
  const scourtUrl = payload?.scourtUrl ?? buildPrecedentScourtSearchUrl(caseNumber);
  const hasBody = Boolean(payload?.html || payload?.text);

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-100 overflow-hidden">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Scale size={18} className="text-primary-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              판례 · {payload?.title ?? caseNumber}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {[payload?.court ?? cached?.court, payload?.date ?? cached?.date]
                .filter(Boolean)
                .join(" · ") || "국가법령정보센터 · AI 추천 본문"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw size={12} />
            새로고침
          </button>
          <Button
            type="button"
            size="sm"
            leftIcon={<ExternalLink size={12} />}
            onClick={() => openPrecedentExternalTab(caseNumber)}
          >
            새 창에서 보기
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => window.open(scourtUrl, "_blank", "noopener,noreferrer")}
          >
            대법원
          </Button>
        </div>
      </header>

      {(cached?.issueSummary || cached?.matchReason) && (
        <div className="shrink-0 mx-4 mt-3 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2 text-xs text-slate-700 space-y-1">
          {cached.issueSummary ? <p><span className="font-semibold">쟁점:</span> {cached.issueSummary}</p> : null}
          {cached.matchReason ? <p><span className="font-semibold">매칭:</span> {cached.matchReason}</p> : null}
        </div>
      )}

      <main className="flex-1 min-h-0 p-3 flex flex-col gap-2">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm gap-2">
            <Loader2 size={18} className="animate-spin" />
            판례 본문 불러오는 중…
          </div>
        ) : hasBody ? (
          <div
            className={cn(
              "flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-5",
              "text-sm text-slate-800 leading-relaxed precedent-body"
            )}
          >
            {payload?.html ? (
              <div dangerouslySetInnerHTML={{ __html: payload.html }} />
            ) : (
              <article className="whitespace-pre-wrap break-words">{payload?.text}</article>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-6 py-10 text-center">
            <AlertCircle size={40} className="text-amber-500 mb-3" />
            <p className="text-sm font-medium text-slate-700">판례 본문을 이 창에 표시할 수 없습니다</p>
            <p className="text-xs text-slate-500 mt-2 max-w-lg leading-relaxed">
              {payload?.error ??
                "국가법령정보센터는 팝업 iframe 표시를 차단합니다. 「새 창에서 보기」로 원문 사이트를 열어 주세요."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" leftIcon={<ExternalLink size={14} />} onClick={() => openPrecedentExternalTab(caseNumber)}>
                국가법령정보센터에서 보기
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}
              >
                검색 결과 페이지
              </Button>
            </div>
          </div>
        )}

        {payload && !loading && hasBody ? (
          <p className="shrink-0 text-[11px] text-slate-500 px-1">
            {payload.source === "openApi"
              ? "국가법령정보 Open API"
              : payload.source === "aiCache"
                ? "AI 추천 본문 (판례자동추천)"
                : null}
            {payload.error ? ` · ${payload.error}` : null}
          </p>
        ) : null}
      </main>
    </div>
  );
}
