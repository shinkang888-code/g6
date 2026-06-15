/**
 * 법률백과 문서 메타 — 판례번호·법령 조문 추출
 */

import { buildPrecedentLawGoKrSearchUrl, isValidPrecedentCaseNumber } from "@/lib/precedentLinks";
import { buildLawGoKrArticleUrl, buildLawGoKrLawSearchUrl } from "@/lib/lawLinks";
import { normalizePrecedentCaseNumber } from "@/lib/precedentViewerStorage";
import type { EncyclopediaDocumentMeta } from "./types";

const CASE_NUMBER_RE = /\d{4}[가-힣]{1,3}\d+/g;

export function extractCaseNumber(text: string): string | null {
  const m = text.match(CASE_NUMBER_RE);
  if (!m?.length) return null;
  for (const raw of m) {
    const n = normalizePrecedentCaseNumber(raw);
    if (isValidPrecedentCaseNumber(n)) return n;
  }
  return null;
}

export function enrichPrecedentMeta(
  title: string,
  source: string | undefined,
  body: string,
  partial?: Partial<EncyclopediaDocumentMeta>
): EncyclopediaDocumentMeta {
  const caseNumber =
    partial?.caseNumber ??
    extractCaseNumber(title) ??
    extractCaseNumber(source ?? "") ??
    extractCaseNumber(body) ??
    undefined;

  return {
    ...partial,
    caseNumber,
    court: partial?.court,
    judgmentDate: partial?.judgmentDate,
    externalUrl: caseNumber ? buildPrecedentLawGoKrSearchUrl(caseNumber) : partial?.externalUrl,
  };
}

export function enrichLawMeta(
  title: string,
  body: string,
  partial?: Partial<EncyclopediaDocumentMeta>
): EncyclopediaDocumentMeta {
  const lawMatch = title.match(/([가-힣][가-힣\s]*(?:법|령|규칙|규정|조례))/) ?? body.match(/([가-힣][가-힣\s]*(?:법|령|규칙|규정|조례))/);
  const articleMatch =
    title.match(/제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/) ?? body.match(/제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/);

  const lawName = partial?.lawName ?? lawMatch?.[1]?.trim();
  const articleNo = partial?.articleNo ?? articleMatch?.[1];
  const articleSub = partial?.articleSub ?? articleMatch?.[2];

  let externalUrl = partial?.externalUrl;
  if (!externalUrl && lawName && articleNo) {
    externalUrl = buildLawGoKrArticleUrl(lawName, articleNo, articleSub);
  } else if (!externalUrl && lawName) {
    externalUrl = buildLawGoKrLawSearchUrl(lawName);
  }

  return { ...partial, lawName, articleNo, articleSub, externalUrl };
}
