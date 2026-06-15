/**
 * 국가법령정보센터 조문 조회 — Open API → 웹 본문 추출 → 외부 링크
 */

import { escapeHtml, formatLawJoCode, sanitizeLawHtml } from "@/lib/lawGoKrHtml";
import { buildLawNamePageUrl, fetchLawArticleViaWeb } from "@/lib/lawGoKrWebScrape";

export { formatLawJoCode, sanitizeLawHtml } from "@/lib/lawGoKrHtml";

const LAW_API_BASE = "http://www.law.go.kr/DRF";
const OPEN_API_TIMEOUT_MS = 8_000;

export function buildLawScEmbedUrl(
  lawName: string,
  articleNo: string | number,
  articleSub?: string | number
): string {
  const jo = articleSub
    ? `제${articleNo}조의${articleSub}`
    : `제${articleNo}조`;
  const query = encodeURIComponent(`${lawName.trim()} ${jo}`);
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=0&subMenu=1&tabMenuId=81&query=${query}`;
}

function pickLawSearchRow(laws: unknown[], lawName: string): Record<string, unknown> | null {
  const target = lawName.trim();
  if (!target || !laws.length) return null;

  const normalized = (s: string) => s.replace(/\s/g, "");
  const exact = laws.find((row) => {
    const r = row as Record<string, unknown>;
    const name = String(r.법령명한글 ?? r.law_name ?? "").trim();
    return name === target || normalized(name) === normalized(target);
  });
  if (exact) return exact as Record<string, unknown>;

  const partial = laws.find((row) => {
    const r = row as Record<string, unknown>;
    const name = String(r.법령명한글 ?? r.law_name ?? "").trim();
    return name.includes(target) || target.includes(name);
  });
  return (partial as Record<string, unknown>) ?? null;
}

async function searchLawId(oc: string, lawName: string): Promise<string | null> {
  const url = `${LAW_API_BASE}/lawSearch.do?OC=${encodeURIComponent(oc)}&target=law&type=JSON&query=${encodeURIComponent(lawName.trim())}`;
  const res = await fetchOpenApi(url);
  if (!res.ok) return null;

  const json = (await res.json()) as Record<string, unknown>;
  if (json.result && String(json.result).includes("실패")) return null;

  const lawNode = (json.LawSearch as Record<string, unknown> | undefined)?.law;
  const laws = Array.isArray(lawNode) ? lawNode : lawNode ? [lawNode] : [];
  const row = pickLawSearchRow(laws, lawName);
  if (!row) return null;

  const id = row.법령ID ?? row.법령일련번호 ?? row.lawId;
  return id != null ? String(id) : null;
}

function extractJoTextFromJson(json: Record<string, unknown>): string {
  const jo = json.조문 as Record<string, unknown> | undefined;
  const body = jo?.조문내용 ?? jo?.joText ?? json.조문내용;
  if (typeof body === "string" && body.trim()) return body.trim();

  const hang = jo?.항 as unknown;
  if (Array.isArray(hang)) {
    return hang
      .map((h) => {
        const row = h as Record<string, unknown>;
        return String(row.항내용 ?? row.hangContent ?? "").trim();
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractJoHtmlFromHtml(html: string): string {
  const cleaned = sanitizeLawHtml(html);
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const inner = bodyMatch?.[1] ?? cleaned;
  if (inner.includes("오류페이지") || inner.includes("비정상")) return "";
  return inner.trim();
}

export type LawArticleFetchResult = {
  ok: boolean;
  source: "openApi" | "web" | "fallback";
  html?: string;
  text?: string;
  externalUrl: string;
  embedUrl: string;
  error?: string;
};

async function fetchOpenApi(url: string): Promise<Response> {
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(OPEN_API_TIMEOUT_MS) });
}

export async function fetchLawArticleContent(input: {
  lawName: string;
  articleNo: string;
  articleSub?: string;
  oc?: string | null;
}): Promise<LawArticleFetchResult> {
  const lawName = input.lawName.trim();
  const articleNo = input.articleNo.trim();
  const articleSub = input.articleSub?.trim();
  const embedUrl = buildLawScEmbedUrl(lawName, articleNo, articleSub);
  const externalUrl = embedUrl;
  const lawPageUrl = buildLawNamePageUrl(lawName);
  const jo = formatLawJoCode(articleNo, articleSub);
  const oc = input.oc?.trim();

  const fallback = (error: string): LawArticleFetchResult => ({
    ok: true,
    source: "fallback",
    externalUrl,
    embedUrl,
    error,
  });

  if (oc) {
    try {
      const lawId = await searchLawId(oc, lawName);
      if (lawId) {
        const jsonUrl = `${LAW_API_BASE}/lawService.do?OC=${encodeURIComponent(oc)}&target=lawjosub&type=JSON&ID=${encodeURIComponent(lawId)}&JO=${jo}`;
        const jsonRes = await fetchOpenApi(jsonUrl);
        if (jsonRes.ok) {
          const json = (await jsonRes.json()) as Record<string, unknown>;
          if (!json.result || !String(json.result).includes("실패")) {
            const text = extractJoTextFromJson(json);
            if (text) {
              return {
                ok: true,
                source: "openApi",
                text,
                html: `<div class="law-article-body whitespace-pre-wrap leading-relaxed">${escapeHtml(text)}</div>`,
                externalUrl,
                embedUrl,
              };
            }
          }
        }

        const htmlUrl = `${LAW_API_BASE}/lawService.do?OC=${encodeURIComponent(oc)}&target=lawjosub&type=HTML&ID=${encodeURIComponent(lawId)}&JO=${jo}`;
        const htmlRes = await fetchOpenApi(htmlUrl);
        if (htmlRes.ok) {
          const raw = await htmlRes.text();
          const html = extractJoHtmlFromHtml(raw);
          if (html) {
            return {
              ok: true,
              source: "openApi",
              html,
              externalUrl,
              embedUrl,
            };
          }
        }
      }
    } catch {
      /* Open API 실패 시 웹 추출로 계속 */
    }
  }

  try {
    const web = await fetchLawArticleViaWeb({ lawName, articleNo, articleSub });
    if (web?.html) {
      return {
        ok: true,
        source: "web",
        html: web.html,
        text: web.text,
        externalUrl: lawPageUrl,
        embedUrl,
        error: oc
          ? undefined
          : "LAW_GO_KR_OC 미설정 — 국가법령정보 웹 페이지에서 조문을 불러왔습니다.",
      };
    }
  } catch (e) {
    return fallback(
      e instanceof Error
        ? `조문 본문을 가져오지 못했습니다: ${e.message}`
        : "조문 본문을 가져오지 못했습니다."
    );
  }

  return fallback(
    oc
      ? "Open API(IP 미등록) 및 웹 추출 모두 실패했습니다. 국가법령정보센터에서 직접 확인하세요."
      : "조문 본문을 찾지 못했습니다. 국가법령정보센터에서 직접 확인하세요."
  );
}

