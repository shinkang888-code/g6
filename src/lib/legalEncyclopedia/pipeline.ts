/**
 * 파이프라인 단계 정의 (특허 도1·도2 모듈 흐름)
 */

import type { PipelineStep } from "./types";

export const ENCYCLOPEDIA_PIPELINE_MODULES: Omit<PipelineStep, "status" | "summary">[] = [
  { moduleId: "110", moduleName: "키워드검색부" },
  { moduleId: "210", moduleName: "키워드범위인식(온톨로지)" },
  { moduleId: "220", moduleName: "자질값 형성" },
  { moduleId: "260", moduleName: "차원감소 추출" },
  { moduleId: "270", moduleName: "의미벡터 변환" },
  { moduleId: "230", moduleName: "AI 딥러닝 학습" },
  { moduleId: "235", moduleName: "순위화 프레임워크" },
  { moduleId: "285", moduleName: "문자열 사전" },
  { moduleId: "290", moduleName: "문서순위 출력" },
];

export function buildPipelineSteps(summaries: string[]): PipelineStep[] {
  return ENCYCLOPEDIA_PIPELINE_MODULES.map((m, i) => ({
    ...m,
    status: "done" as const,
    summary: summaries[i] ?? m.moduleName,
  }));
}

export const MODEL_ANSWER_PIPELINE: Omit<PipelineStep, "status" | "summary">[] = [
  { moduleId: "252", moduleName: "자질값 가중치 선택" },
  { moduleId: "253", moduleName: "반복해결 매커니즘" },
  { moduleId: "254", moduleName: "목적함수 생성" },
  { moduleId: "285", moduleName: "문자열 사전 연결" },
  { moduleId: "310", moduleName: "모범답안 산출" },
];

export function buildModelAnswerPipeline(summaries: string[]): PipelineStep[] {
  return MODEL_ANSWER_PIPELINE.map((m, i) => ({
    ...m,
    status: "done" as const,
    summary: summaries[i] ?? m.moduleName,
  }));
}

export const ENCYCLOPEDIA_CATEGORIES = [
  { id: "전체" as const, label: "전체" },
  { id: "판례" as const, label: "판례" },
  { id: "법령" as const, label: "법령" },
  { id: "서식" as const, label: "서식" },
  { id: "기타자료" as const, label: "기타자료" },
  { id: "관련법률문서" as const, label: "관련 법률문서" },
];
