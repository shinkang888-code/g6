/**
 * 종류 프레임별 국가법령정보 Open API 검색
 */

import { buildPrecedentLawGoKrSearchUrl } from "@/lib/precedentLinks";
import { buildLawGoKrLawSearchUrl } from "@/lib/lawLinks";
import { normalizePrecedentCaseNumber } from "@/lib/precedentViewerStorage";
import type { EncyclopediaCategory } from "./types";
import type { RawAiDocument } from "./ranking";

const DRF_BASE = "http://www.law.go.kr/DRF";
const TIMEOUT_MS = 12_000;

async function fetchDrf(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    if (json.result && String(json.result).includes("실패")) return null;
    return json;
  } catch {
    return null;
  }
}

function rowsFromNode(node: unknown): Record<string, unknown>[] {
  if (!node) return [];
  return Array.isArray(node) ? (node as Record<string, unknown>[]) : [node as Record<string, unknown>];
}

export async function fetchPrecedentDocuments(keyword: string, oc: string | null): Promise<RawAiDocument[]> {
  if (!oc?.trim()) return [];
  const url = `${DRF_BASE}/lawSearch.do?OC=${encodeURIComponent(oc)}&target=prec&type=JSON&query=${encodeURIComponent(keyword)}&display=12`;
  const json = await fetchDrf(url);
  if (!json) return [];

  const prec = (json.PrecSearch as Record<string, unknown> | undefined)?.prec;
  const out: RawAiDocument[] = [];
  for (const row of rowsFromNode(prec)) {
    const caseNumber = normalizePrecedentCaseNumber(String(row.사건번호 ?? row.caseNo ?? ""));
    if (!caseNumber) continue;
    const caseName = String(row.사건명 ?? row.caseName ?? "").trim();
    const court = String(row.법원명 ?? row.court ?? "").trim();
    const judgmentDate = String(row.선고일자 ?? row.date ?? "").trim();
    const gist = String(row.판시사항 ?? row.판결요지 ?? row.사건종류명 ?? "").trim();

    out.push({
      title: caseName ? `${caseNumber} · ${caseName}` : caseNumber,
      category: "판례",
      domain: "전체",
      summary: gist.slice(0, 200) || `${court} ${judgmentDate}`.trim() || "국가법령정보센터 판례",
      body: gist || caseName || `${keyword} 관련 판례`,
      source: "국가법령정보센터",
      meta: {
        caseNumber,
        court: court || undefined,
        judgmentDate: judgmentDate || undefined,
        externalUrl: buildPrecedentLawGoKrSearchUrl(caseNumber),
        precId: String(row.판례일련번호 ?? row.precSeq ?? "") || undefined,
      },
    });
  }
  return out;
}

export async function fetchLawDocuments(keyword: string, oc: string | null): Promise<RawAiDocument[]> {
  if (!oc?.trim()) return [];
  const url = `${DRF_BASE}/lawSearch.do?OC=${encodeURIComponent(oc)}&target=law&type=JSON&query=${encodeURIComponent(keyword)}&display=10`;
  const json = await fetchDrf(url);
  if (!json) return [];

  const law = (json.LawSearch as Record<string, unknown> | undefined)?.law;
  const out: RawAiDocument[] = [];
  for (const row of rowsFromNode(law)) {
    const lawName = String(row.법령명한글 ?? row.law_name ?? "").trim();
    if (!lawName) continue;
    const lawId = String(row.법령ID ?? row.법령일련번호 ?? row.lawId ?? "");
    const promulgation = String(row.공포일자 ?? row.promulgationDate ?? "").trim();
    const enforcement = String(row.시행일자 ?? row.enforcementDate ?? "").trim();

    out.push({
      title: lawName,
      category: "법령",
      domain: "전체",
      summary: `공포 ${promulgation || "-"} · 시행 ${enforcement || "-"}`,
      body: `${lawName} — ${keyword} 관련 법령. 국가법령정보센터에서 조문·부칙을 확인할 수 있습니다.`,
      source: "국가법령정보센터",
      meta: {
        lawName,
        lawId: lawId || undefined,
        externalUrl: buildLawGoKrLawSearchUrl(lawName),
      },
    });
  }
  return out;
}

export async function fetchCategoryDocuments(
  category: EncyclopediaCategory,
  keyword: string,
  oc: string | null
): Promise<RawAiDocument[]> {
  switch (category) {
    case "판례":
      return fetchPrecedentDocuments(keyword, oc);
    case "법령":
      return fetchLawDocuments(keyword, oc);
    default:
      return [];
  }
}
