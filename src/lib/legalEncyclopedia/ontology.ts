/**
 * 키워드범위인식모듈(210) — 온톨로지·유의어·법률분야 한정
 * 정적 폴백 (DB 미연결 시 ontologySeed 사용)
 */

import type { LegalDomain } from "./types";
import { ontologySeedToMap } from "./ontologySeed";

const ONTOLOGY = ontologySeedToMap();

function normalizeKeyword(kw: string): string {
  return kw.trim().replace(/\s+/g, "");
}

export function expandOntology(keyword: string): {
  root: string;
  synonyms: string[];
  domain: LegalDomain;
  domainReason: string;
  relatedLaws: string[];
} {
  const norm = normalizeKeyword(keyword);
  const entry = ONTOLOGY[norm];

  if (entry) {
    return {
      root: norm,
      synonyms: [...new Set([norm, ...entry.synonyms])],
      domain: entry.domain,
      domainReason: `온톨로지 매핑: 「${norm}」→ ${entry.domain} 분야 검색 범위로 한정`,
      relatedLaws: entry.relatedLaws ?? [],
    };
  }

  const partial = Object.entries(ONTOLOGY).find(
    ([k, v]) => norm.includes(k) || k.includes(norm) || v.synonyms.some((s) => norm.includes(s) || s.includes(norm))
  );

  if (partial) {
    const [k, v] = partial;
    return {
      root: k,
      synonyms: [...new Set([norm, k, ...v.synonyms])],
      domain: v.domain,
      domainReason: `유사 키워드 연관: 「${norm}」≈ 「${k}」→ ${v.domain}`,
      relatedLaws: v.relatedLaws ?? [],
    };
  }

  return {
    root: norm,
    synonyms: [norm],
    domain: "전체",
    domainReason: "온톨로지 미등록 키워드 — 전체 분야에서 검색",
    relatedLaws: [],
  };
}

export function isDomainMatch(docDomain: LegalDomain, scope: LegalDomain): boolean {
  if (scope === "전체" || docDomain === "전체") return true;
  return docDomain === scope;
}
