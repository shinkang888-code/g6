/**
 * AI 기능 산출물 → ingest 벡터 변환 어댑터
 */

import type { PrecedentCard } from "@/components/board/ai/CaseRecommendTab";
import type { LawArticleItem } from "@/lib/lawSearchParse";
import type { EncyclopediaCategory, LegalDomain } from "../types";
import type { IngestVectorRow } from "../ingest";
import { extractLegalClauses, clausesToVectors } from "../ingest";
import { textToSemanticVector } from "../semanticVector";

export type SourceFeatureId =
  | "case_search"
  | "doc_summary"
  | "law_search"
  | "ai_search"
  | "doc_draft"
  | "legal_encyclopedia";

export type FeatureArtifactPayload = {
  sourceFeature: SourceFeatureId;
  title: string;
  contentText: string;
  category: EncyclopediaCategory;
  domain: LegalDomain;
  structured?: unknown;
  featureLabels?: string[];
};

export function precedentCardsToArtifact(cards: PrecedentCard[], domain: LegalDomain = "전체"): FeatureArtifactPayload {
  const lines = cards.map(
    (c) =>
      `[${c.caseNumber}] ${c.court} ${c.date}\n쟁점: ${c.issueSummary}\n매칭: ${c.matchReason}\n${c.bodySummary ?? ""}\n${c.fullText ?? ""}`
  );
  return {
    sourceFeature: "case_search",
    title: `판례추천 ${cards.length}건`,
    contentText: lines.join("\n\n---\n\n"),
    category: "판례",
    domain,
    structured: cards,
    featureLabels: cards.flatMap((c) => [c.caseNumber, c.issueSummary].filter(Boolean)).slice(0, 12),
  };
}

export function pdfSummaryToArtifact(params: {
  fileName: string;
  summary: string;
  ocrText?: string;
  domain?: LegalDomain;
}): FeatureArtifactPayload {
  const raw = params.ocrText?.trim() || params.summary;
  return {
    sourceFeature: "doc_summary",
    title: params.fileName || "판결문 요약",
    contentText: `${params.summary}\n\n--- OCR/원문 ---\n${raw}`,
    category: "관련법률문서",
    domain: params.domain ?? "전체",
    structured: { summary: params.summary, fileName: params.fileName },
    featureLabels: [params.fileName],
  };
}

export function lawArticlesToArtifact(articles: LawArticleItem[], query: string): FeatureArtifactPayload {
  const lines = articles.map((a) => `${a.label}\n${a.summary}`);
  return {
    sourceFeature: "law_search",
    title: `법령검색: ${query.slice(0, 40)}`,
    contentText: lines.join("\n\n"),
    category: "법령",
    domain: "전체",
    structured: articles,
    featureLabels: articles.map((a) => a.label).slice(0, 12),
  };
}

export function aiSearchToArtifact(query: string, answer: string): FeatureArtifactPayload {
  return {
    sourceFeature: "ai_search",
    title: `AI검색: ${query.slice(0, 40)}`,
    contentText: answer,
    category: "기타자료",
    domain: "전체",
    featureLabels: [query],
  };
}

export function briefDraftToArtifact(title: string, content: string): FeatureArtifactPayload {
  return {
    sourceFeature: "doc_draft",
    title: title || "서면 초안",
    contentText: content,
    category: "서식",
    domain: "전체",
  };
}

export function artifactToVectors(artifact: FeatureArtifactPayload): IngestVectorRow[] {
  const clauses = extractLegalClauses(artifact.contentText);
  if (clauses.length > 0) {
    return clausesToVectors(clauses, {
      category: artifact.category,
      domain: artifact.domain,
      featureLabels: artifact.featureLabels,
    });
  }

  const vec = textToSemanticVector(artifact.title);
  return [
    {
      title: artifact.title,
      body: artifact.contentText.slice(0, 4000),
      category: artifact.category,
      domain: artifact.domain,
      vector_dims: vec.dimensions,
      magnitude: vec.magnitude,
      feature_labels: artifact.featureLabels ?? [],
      clause_index: 0,
    },
  ];
}
