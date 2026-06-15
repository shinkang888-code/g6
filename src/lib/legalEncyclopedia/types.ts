/**
 * 로이고법률백과 — 특허 10-2019-0015797 기반 타입 정의
 * 인공지능 딥러닝 + 순위화프레임워크 + 온라인 법률정보사전
 */

export type LegalDomain =
  | "민법"
  | "형법"
  | "민사소송법"
  | "형사소송법"
  | "상법"
  | "헌법"
  | "행정법"
  | "기업법무"
  | "전체";

export type EncyclopediaCategory =
  | "판례"
  | "법령"
  | "서식"
  | "기타자료"
  | "관련법률문서";

export type EncyclopediaViewMode = "search" | "detail";

/** 문서별 외부 연동 메타 (판례·법령) */
export interface EncyclopediaDocumentMeta {
  caseNumber?: string;
  court?: string;
  judgmentDate?: string;
  precId?: string;
  lawName?: string;
  lawId?: string;
  articleNo?: string;
  articleSub?: string;
  externalUrl?: string;
}

/** 자질값(Feature) — 공통 법령·판례·키워드 특성 */
export interface FeatureValue {
  id: string;
  label: string;
  kind: "law" | "precedent" | "keyword" | "domain" | "synonym";
  weight: number;
}

/** 의미벡터 — 차원감소·벡터변환 결과 (UI·순위화용) */
export interface SemanticVector {
  id: string;
  token: string;
  dimensions: number[];
  magnitude: number;
}

/** 순위화된 법률문서 항목 */
export interface RankedLegalDocument {
  id: string;
  title: string;
  category: EncyclopediaCategory;
  domain: LegalDomain;
  summary: string;
  body: string;
  rankingScore: number;
  relevanceMeasure: number;
  features: FeatureValue[];
  vectorId: string;
  source?: string;
  storedInDb?: boolean;
  learnedBoost?: number;
  meta?: EncyclopediaDocumentMeta;
  /** 조회수 집계 키 */
  documentKey?: string;
  viewCount?: number;
}

/** 문자열 사전 소목차 */
export interface DictionarySection {
  id: string;
  title: string;
  path: string[];
  vectorIds: string[];
  childCount: number;
}

/** 모범답안 (목적함수벡터 연결 결과) */
export interface ModelAnswerBlock {
  id: string;
  sectionTitle: string;
  clauses: string[];
  objectiveFunctionLabel?: string;
}

export interface EncyclopediaSearchRequest {
  keyword: string;
  category?: EncyclopediaCategory | "전체";
  domain?: LegalDomain;
  detail?: string;
}

export interface EncyclopediaSearchResult {
  keyword: string;
  synonyms: string[];
  domain: LegalDomain;
  domainReason: string;
  features: FeatureValue[];
  vectors: SemanticVector[];
  documents: RankedLegalDocument[];
  sections: DictionarySection[];
  pipeline: PipelineStep[];
  stats?: {
    vectorCount: number;
    documentCount: number;
    usageCount: number;
    fromDb: boolean;
  };
  repetitiveResolution?: boolean;
}

export interface PipelineStep {
  moduleId: string;
  moduleName: string;
  status: "done" | "active" | "pending";
  summary: string;
}

export interface ModelAnswerRequest {
  keyword: string;
  sectionId: string;
  sectionTitle: string;
  documents: RankedLegalDocument[];
  features: FeatureValue[];
}

export interface ModelAnswerResult {
  title: string;
  blocks: ModelAnswerBlock[];
  fullText: string;
  pipeline: PipelineStep[];
  repetitiveResolution?: boolean;
}
