"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LawArticleItem } from "@/lib/lawSearchParse";

type ArticlePayload = {
  ok: boolean;
  source: "openApi" | "web" | "fallback";
  html?: string;
  text?: string;
  externalUrl: string;
  embedUrl: string;
  error?: string;
};

type Props = {
  article: LawArticleItem;
};

export function LawArticleViewer({ article }: Props) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ArticlePayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        law: article.lawName,
        articleNo: article.articleNo,
      });
      if (article.articleSub) params.set("articleSub", article.articleSub);

      const res = await fetch(`/api/law/article?${params.toString()}`, { credentials: "include" });
      const data = (await res.json()) as ArticlePayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "조문 조회 실패");
      setPayload(data);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [article]);

  useEffect(() => {
    void load();
  }, [load]);

  const externalUrl = payload?.externalUrl || payload?.embedUrl || "";
  const hasBody = Boolean(payload?.html || payload?.text);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {(article.title || article.summary) && (
        <div className="shrink-0 rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3">
          {article.title ? (
            <p className="text-sm font-semibold text-slate-800">{article.title}</p>
          ) : null}
          {article.summary ? (
            <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">{article.summary}</p>
          ) : null}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm gap-2">
          <Loader2 size={18} className="animate-spin" />
          조문 원문 불러오는 중…
        </div>
      ) : hasBody ? (
        payload?.html ? (
          <div
            className={cn(
              "flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4",
              "text-sm text-slate-800 leading-relaxed law-article-html"
            )}
            dangerouslySetInnerHTML={{ __html: payload.html }}
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {payload?.text}
          </div>
        )
      ) : (
        <FallbackPanel article={article} externalUrl={externalUrl} message={payload?.error} />
      )}

      {payload && !loading && hasBody ? (
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
          {payload.error ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {payload.error}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              {payload.source === "openApi"
                ? "국가법령정보 Open API"
                : payload.source === "web"
                  ? "국가법령정보센터 웹 원문"
                  : null}
            </p>
          )}
          {externalUrl ? (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<ExternalLink size={14} />}
              onClick={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}
            >
              국가법령정보센터에서 보기
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FallbackPanel({
  article,
  externalUrl,
  message,
}: {
  article: LawArticleItem;
  externalUrl: string;
  message?: string;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-6 py-10 text-center">
      <AlertCircle size={40} className="text-amber-500 mb-3" />
      <p className="text-sm font-medium text-slate-700">조문 원문을 불러올 수 없습니다</p>
      <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
        {message ??
          "국가법령정보센터에서 직접 열어보시거나, 왼쪽 AI 요약을 참고하세요."}
      </p>
      {externalUrl ? (
        <Button
          size="sm"
          className="mt-4"
          leftIcon={<ExternalLink size={14} />}
          onClick={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}
        >
          {article.lawName} 제{article.articleNo}조 — 국가법령정보센터에서 보기
        </Button>
      ) : null}
    </div>
  );
}
