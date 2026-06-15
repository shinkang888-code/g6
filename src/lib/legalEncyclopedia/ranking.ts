/**
 * 순위화프레임워크(235)·관련도척도·순위점수
 * DB 저장 벡터 + 학습 가중치 반영
 */

import type { DictionarySection, EncyclopediaCategory, EncyclopediaDocumentMeta, FeatureValue, RankedLegalDocument, SemanticVector } from "./types";
import type { DbVectorRow } from "./legalEncyclopediaDb";
import { cosineSimilarity } from "./semanticVector";

export interface RawAiDocument {
  title: string;
  category: EncyclopediaCategory;
  domain: string;
  summary: string;
  body: string;
  source?: string;
  vectorId?: string;
  storedDims?: number[];
  storedMagnitude?: number;
  meta?: EncyclopediaDocumentMeta;
}

export function computeRelevanceMeasure(
  queryVector: SemanticVector,
  docVector: SemanticVector,
  features: FeatureValue[],
  docText: string,
  learnedWeights?: Map<string, number>
): number {
  const cos = cosineSimilarity(queryVector.dimensions, docVector.dimensions);
  let featureBoost = 0;
  for (const f of features) {
    if (docText.includes(f.label)) {
      const learned = learnedWeights?.get(f.label) ?? 1;
      featureBoost += f.weight * 0.08 * learned;
    }
  }
  return Math.min(1, cos * 0.7 + featureBoost + queryVector.magnitude * 0.05);
}

export function storedVectorsToRaw(stored: DbVectorRow[]): RawAiDocument[] {
  return stored.map((s) => ({
    title: s.title,
    category: (s.category as EncyclopediaCategory) || "관련법률문서",
    domain: s.domain,
    summary: s.body.slice(0, 160) + (s.body.length > 160 ? "…" : ""),
    body: s.body,
    source: s.source_type === "ingest" ? "업로드 법률DB" : "법률벡터DB",
    vectorId: s.id,
    storedDims: s.vector_dims,
    storedMagnitude: s.magnitude,
  }));
}

export function rankDocuments(
  keyword: string,
  queryVector: SemanticVector,
  features: FeatureValue[],
  rawDocs: RawAiDocument[],
  learnedWeights?: Map<string, number>
): RankedLegalDocument[] {
  const ranked = rawDocs.map((doc, idx) => {
    const storedDims = doc.storedDims;
    const docVector: SemanticVector = storedDims?.length
      ? {
          id: doc.vectorId ?? `doc-vec-${idx}`,
          token: doc.title,
          dimensions: storedDims,
          magnitude: doc.storedMagnitude ?? queryVector.magnitude,
        }
      : {
          id: doc.vectorId ?? `doc-vec-${idx}`,
          token: doc.title,
          dimensions: queryVector.dimensions.map((v, i) => {
            const seed = (doc.title.charCodeAt(i % doc.title.length) || 1) / 500;
            return Number(((v + seed) % 1).toFixed(4));
          }),
          magnitude: queryVector.magnitude,
        };

    const relevance = computeRelevanceMeasure(
      queryVector,
      docVector,
      features,
      `${doc.title} ${doc.body}`,
      learnedWeights
    );

    const dbBoost = doc.storedDims?.length ? 0.12 : 0;
    const rankingScore = (relevance + dbBoost) * 100;
    const learnedBoost = features
      .filter((f) => `${doc.title} ${doc.body}`.includes(f.label))
      .reduce((s, f) => s + ((learnedWeights?.get(f.label) ?? 1) - 1) * 0.1, 0);

    return {
      id: doc.vectorId ?? `doc-${idx}-${Date.now().toString(36)}`,
      title: doc.title,
      category: doc.category,
      domain: (doc.domain as RankedLegalDocument["domain"]) || "전체",
      summary: doc.summary,
      body: doc.body,
      rankingScore: Number(rankingScore.toFixed(1)),
      relevanceMeasure: Number(relevance.toFixed(4)),
      features: features.filter((f) => `${doc.title} ${doc.body}`.includes(f.label)).slice(0, 4),
      vectorId: docVector.id,
      source: doc.source,
      storedInDb: Boolean(doc.storedDims?.length),
      learnedBoost: learnedBoost > 0 ? Number(learnedBoost.toFixed(3)) : undefined,
      meta: doc.meta,
    } satisfies RankedLegalDocument;
  });

  return ranked.sort((a, b) => b.rankingScore - a.rankingScore);
}

export function mergeRawDocuments(aiDocs: RawAiDocument[], storedDocs: RawAiDocument[]): RawAiDocument[] {
  const seen = new Set<string>();
  const merged: RawAiDocument[] = [];
  for (const d of [...storedDocs, ...aiDocs]) {
    const key = `${d.title}::${d.body.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(d);
  }
  return merged;
}

/** 문자열 사전(285) — 키워드·분류·문서 소목차 트리 */
export function buildDictionarySections(
  keyword: string,
  documents: RankedLegalDocument[]
): DictionarySection[] {
  const sections: DictionarySection[] = [
    {
      id: "root",
      title: keyword,
      path: [keyword],
      vectorIds: documents.map((d) => d.vectorId),
      childCount: documents.length,
    },
  ];

  const byCategory = new Map<EncyclopediaCategory, RankedLegalDocument[]>();
  for (const doc of documents) {
    const list = byCategory.get(doc.category) ?? [];
    list.push(doc);
    byCategory.set(doc.category, list);
  }

  for (const [cat, docs] of byCategory) {
    sections.push({
      id: `cat-${cat}`,
      title: cat,
      path: [keyword, cat],
      vectorIds: docs.map((d) => d.vectorId),
      childCount: docs.length,
    });
    docs.slice(0, 8).forEach((doc, i) => {
      sections.push({
        id: `sec-${cat}-${i}`,
        title: doc.title.length > 40 ? `${doc.title.slice(0, 40)}…` : doc.title,
        path: [keyword, cat, doc.title],
        vectorIds: [doc.vectorId],
        childCount: 0,
      });
    });
  }

  return sections;
}
