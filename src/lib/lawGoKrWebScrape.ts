/**
 * 국가법령정보센터 웹 페이지에서 조문 본문 추출 (Open API IP 제한 우회)
 */

import { formatLawJoCode, sanitizeLawHtml } from "@/lib/lawGoKrHtml";

const LAW_GO_KR_ORIGIN = "https://www.law.go.kr";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; LawyGo/1.0; +https://lawygo.vercel.app)",
  Accept: "text/html,application/xhtml+xml",
};

const FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export type LawPageMeta = {
  lsiSeq: string;
  efYd: string;
  chrClsCd: string;
  lsId?: string;
};

export function buildLawNamePageUrl(lawName: string): string {
  const segment = encodeURIComponent(lawName.trim());
  return `${LAW_GO_KR_ORIGIN}/${encodeURIComponent("법령")}/${segment}`;
}

export async function resolveLawPageMeta(lawName: string): Promise<LawPageMeta | null> {
  const html = await fetchWithTimeout(buildLawNamePageUrl(lawName));
  const iframeMatch = html.match(/lsInfoP\.do\?([^"'>\s]+)/i);
  if (!iframeMatch) return null;

  const qs = iframeMatch[1].replace(/&amp;/g, "&");
  const params = new URLSearchParams(qs);
  const lsiSeq = params.get("lsiSeq");
  const efYd = params.get("efYd");
  const chrClsCd = params.get("chrClsCd") ?? "010202";
  if (!lsiSeq || !efYd) return null;

  return {
    lsiSeq,
    efYd,
    chrClsCd,
    lsId: params.get("lsId") ?? undefined,
  };
}

export function buildLsInfoRUrl(meta: LawPageMeta): string {
  const params = new URLSearchParams({
    lsiSeq: meta.lsiSeq,
    chrClsCd: meta.chrClsCd,
    urlMode: "lsInfoP",
    viewCls: "lsInfoP",
    efYd: meta.efYd,
    ancYnChk: "0",
  });
  if (meta.lsId) params.set("lsId", meta.lsId);
  return `${LAW_GO_KR_ORIGIN}/LSW/lsInfoR.do?${params.toString()}`;
}

function buildArticleMarker(articleNo: string, articleSub?: string): string {
  const main = articleNo.replace(/\D/g, "");
  const sub = articleSub?.replace(/\D/g, "") || "0";
  const joCode = formatLawJoCode(articleNo, articleSub);
  return `value="${main}:${sub}:${joCode}:`;
}

function findArticleBounds(
  html: string,
  articleNo: string,
  articleSub?: string
): { start: number; end: number } | null {
  const marker = buildArticleMarker(articleNo, articleSub);
  const markerIdx = html.indexOf(marker);
  if (markerIdx < 0) return null;

  const start = html.lastIndexOf("<p", markerIdx);
  if (start < 0) return null;

  const main = parseInt(articleNo.replace(/\D/g, ""), 10);
  const sub = articleSub ? parseInt(articleSub.replace(/\D/g, ""), 10) : 0;

  let end: number;
  if (sub > 0) {
    const nextSubMarker = buildArticleMarker(articleNo, String(sub + 1));
    const nextIdx = html.indexOf(nextSubMarker, markerIdx + marker.length);
    const nextMainMarker = buildArticleMarker(String(main + 1));
    const nextMainIdx = html.indexOf(nextMainMarker, markerIdx + marker.length);
    const candidates = [nextIdx, nextMainIdx, html.indexOf(`name="J${main}:${sub + 1}"`, markerIdx)].filter(
      (n) => n > markerIdx
    );
    end = candidates.length ? Math.min(...candidates) : html.length;
  } else {
    const nextMarker = buildArticleMarker(String(main + 1));
    const nextIdx = html.indexOf(nextMarker, markerIdx + marker.length);
    const anchorIdx = html.indexOf(`name="J${main + 1}:0"`, markerIdx);
    const candidates = [nextIdx, anchorIdx].filter((n) => n > markerIdx);
    end = candidates.length ? Math.min(...candidates) : html.length;
  }

  return { start, end };
}

export function extractArticleHtmlFromLawBody(
  html: string,
  articleNo: string,
  articleSub?: string
): string {
  const bounds = findArticleBounds(html, articleNo, articleSub);
  if (!bounds) return "";

  const chunk = html.slice(bounds.start, bounds.end);
  const cleaned = sanitizeLawHtml(chunk);
  if (!cleaned || cleaned.includes("오류페이지")) return "";
  return `<div class="law-article-body law-article-html">${cleaned}</div>`;
}

export function extractArticleTextFromLawBody(
  html: string,
  articleNo: string,
  articleSub?: string
): string {
  const bounds = findArticleBounds(html, articleNo, articleSub);
  if (!bounds) return "";

  return html
    .slice(bounds.start, bounds.end)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchLawArticleViaWeb(input: {
  lawName: string;
  articleNo: string;
  articleSub?: string;
}): Promise<{ html: string; text: string; meta: LawPageMeta } | null> {
  const meta = await resolveLawPageMeta(input.lawName);
  if (!meta) return null;

  const bodyHtml = await fetchWithTimeout(buildLsInfoRUrl(meta));
  const html = extractArticleHtmlFromLawBody(bodyHtml, input.articleNo, input.articleSub);
  if (!html) return null;

  const text = extractArticleTextFromLawBody(bodyHtml, input.articleNo, input.articleSub);
  return { html, text, meta };
}
