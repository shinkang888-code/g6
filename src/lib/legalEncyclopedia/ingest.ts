/**
 * 법률문서 ingest — 차원감소·구문 추출·벡터화
 */

import type { EncyclopediaCategory, LegalDomain } from "./types";
import { textToSemanticVector } from "./semanticVector";

export type ExtractedClause = {
  title: string;
  body: string;
  clauseIndex: number;
};

const ARTICLE_RE = /^(제\s*\d+\s*조(?:\s*의\s*\d+)?\s*[^\n]*)/;
const MAX_CHUNK = 900;

/** 법률구문 추출 (제N조 단위 → 없으면 문단 청크) */
export function extractLegalClauses(text: string): ExtractedClause[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const clauses: ExtractedClause[] = [];
  let currentTitle = "서문";
  let currentBody: string[] = [];
  let clauseIndex = 0;

  const flush = () => {
    const body = currentBody.join("\n").trim();
    if (body.length >= 20) {
      clauses.push({ title: currentTitle, body, clauseIndex });
      clauseIndex++;
    }
    currentBody = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(ARTICLE_RE);
    if (m) {
      flush();
      currentTitle = m[1].trim();
      const rest = trimmed.slice(m[1].length).trim();
      if (rest) currentBody.push(rest);
    } else {
      currentBody.push(trimmed);
    }
  }
  flush();

  if (clauses.length > 0) return clauses;

  // 폴백: 고정 길이 문단 청크
  const paras = normalized.split(/\n{2,}/).filter((p) => p.trim().length >= 30);
  return paras.map((p, i) => ({
    title: `구문 ${i + 1}`,
    body: p.trim().slice(0, MAX_CHUNK),
    clauseIndex: i,
  }));
}

export type IngestVectorRow = {
  title: string;
  body: string;
  category: EncyclopediaCategory;
  domain: LegalDomain;
  vector_dims: number[];
  magnitude: number;
  feature_labels: string[];
  clause_index: number;
};

export function clausesToVectors(
  clauses: ExtractedClause[],
  opts: { category: EncyclopediaCategory; domain: LegalDomain; featureLabels?: string[] }
): IngestVectorRow[] {
  return clauses.map((c) => {
    const token = `${c.title} ${c.body.slice(0, 120)}`;
    const vec = textToSemanticVector(token);
    const labels = [
      ...(opts.featureLabels ?? []),
      ...extractInlineFeatures(c.body),
    ].slice(0, 12);
    return {
      title: c.title,
      body: c.body,
      category: opts.category,
      domain: opts.domain,
      vector_dims: vec.dimensions,
      magnitude: vec.magnitude,
      feature_labels: [...new Set(labels)],
      clause_index: c.clauseIndex,
    };
  });
}

function extractInlineFeatures(body: string): string[] {
  const laws = body.match(/[가-힣]+법\s*제\d+조(?:의\d+)?/g) ?? [];
  const articles = body.match(/제\s*\d+\s*조(?:\s*의\s*\d+)?/g) ?? [];
  return [...laws, ...articles].slice(0, 6);
}
