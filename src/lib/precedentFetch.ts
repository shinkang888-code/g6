/**
 * 판례 본문 조회 — 국가법령정보 Open API → AI 캐시(호출측) → 외부 링크
 */
import { sanitizeLawHtml } from "@/lib/lawGoKrHtml";
import {
  buildPrecedentLawGoKrSearchUrl,
  buildPrecedentScourtSearchUrl,
} from "@/lib/precedentLinks";
import { normalizePrecedentCaseNumber } from "@/lib/precedentViewerStorage";

const DRF_BASE = "http://www.law.go.kr/DRF";
const OPEN_API_TIMEOUT_MS = 10_000;

export type PrecedentFetchResult = {
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

async function fetchOpenApi(url: string): Promise<Response> {
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(OPEN_API_TIMEOUT_MS) });
}

function extractPrecSearchRow(json: Record<string, unknown>, caseNumber: string): Record<string, unknown> | null {
  const root = json.PrecSearch as Record<string, unknown> | undefined;
  const prec = root?.prec;
  const rows = Array.isArray(prec) ? prec : prec ? [prec] : [];
  const target = normalizePrecedentCaseNumber(caseNumber);
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const nb = String(r.사건번호 ?? r.caseNo ?? r.case_number ?? "").replace(/\s/g, "");
    if (nb && normalizePrecedentCaseNumber(nb) === target) return r;
  }
  return (rows[0] as Record<string, unknown>) ?? null;
}

function extractPrecBody(json: Record<string, unknown>): string {
  const prec = json.PrecService as Record<string, unknown> | undefined;
  const service = prec ?? json;
  const candidates = [
    service.판례내용,
    service.판례전문,
    service.판결요지,
    service.판시사항,
    service.전문,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 40) return c.trim();
  }
  return "";
}

export async function fetchPrecedentContent(input: {
  caseNumber: string;
  oc?: string | null;
  aiText?: string;
}): Promise<PrecedentFetchResult> {
  const caseNumber = normalizePrecedentCaseNumber(input.caseNumber);
  const externalUrl = buildPrecedentLawGoKrSearchUrl(caseNumber);
  const scourtUrl = buildPrecedentScourtSearchUrl(caseNumber);

  const aiText = (input.aiText ?? "").trim();
  if (aiText.length > 40) {
    return {
      ok: true,
      source: "aiCache",
      caseNumber,
      text: aiText,
      html: `<div class="whitespace-pre-wrap leading-relaxed">${escapeHtml(aiText)}</div>`,
      externalUrl,
      scourtUrl,
    };
  }

  const oc = input.oc?.trim();
  if (oc) {
    try {
      const searchUrl = `${DRF_BASE}/lawSearch.do?OC=${encodeURIComponent(oc)}&target=prec&type=JSON&query=${encodeURIComponent(caseNumber)}&display=5`;
      const searchRes = await fetchOpenApi(searchUrl);
      if (searchRes.ok) {
        const searchJson = (await searchRes.json()) as Record<string, unknown>;
        if (!String(searchJson.result ?? "").includes("실패")) {
          const row = extractPrecSearchRow(searchJson, caseNumber);
          const precId = row ? String(row.판례일련번호 ?? row.precSeq ?? row.id ?? "") : "";
          const title = row ? String(row.사건명 ?? row.사건번호 ?? caseNumber) : caseNumber;
          const court = row ? String(row.법원명 ?? row.court ?? "") : undefined;
          const date = row ? String(row.선고일자 ?? row.date ?? "") : undefined;

          if (precId) {
            const detailUrl = `${DRF_BASE}/lawService.do?OC=${encodeURIComponent(oc)}&target=prec&ID=${encodeURIComponent(precId)}&type=JSON`;
            const detailRes = await fetchOpenApi(detailUrl);
            if (detailRes.ok) {
              const detailJson = (await detailRes.json()) as Record<string, unknown>;
              const body = extractPrecBody(detailJson);
              if (body) {
                return {
                  ok: true,
                  source: "openApi",
                  caseNumber,
                  title,
                  court,
                  date,
                  text: body,
                  html: `<div class="whitespace-pre-wrap leading-relaxed">${escapeHtml(body)}</div>`,
                  externalUrl,
                  scourtUrl,
                };
              }
            }

            const htmlUrl = `${DRF_BASE}/lawService.do?OC=${encodeURIComponent(oc)}&target=prec&ID=${encodeURIComponent(precId)}&type=HTML`;
            const htmlRes = await fetchOpenApi(htmlUrl);
            if (htmlRes.ok) {
              const raw = await htmlRes.text();
              const html = sanitizeLawHtml(raw);
              if (html.length > 80 && !html.includes("오류페이지")) {
                return {
                  ok: true,
                  source: "openApi",
                  caseNumber,
                  title,
                  court,
                  date,
                  html,
                  text: stripTags(html),
                  externalUrl,
                  scourtUrl,
                };
              }
            }
          }
        }
      }
    } catch {
      /* Open API 실패 → fallback */
    }
  }

  return {
    ok: true,
    source: "fallback",
    caseNumber,
    externalUrl,
    scourtUrl,
    error: oc
      ? "국가법령정보 Open API에서 판례 본문을 찾지 못했습니다. 아래 버튼으로 원문 사이트를 열거나, AI 추천 본문을 다시 불러오세요."
      : "LAW_GO_KR_OC 미설정 — AI 추천 본문 또는 아래 국가법령정보센터 링크를 이용하세요.",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
