/**
 * 자질값 가중치 학습 — 반복해결 매커니즘 (특허 도5)
 */

import type { FeatureValue } from "./types";

export const BASE_FEATURE_WEIGHT = 1;
export const WEIGHT_INCREMENT = 0.08;
export const MAX_LEARNED_WEIGHT = 2.5;

export function nextWeight(current: number, selectionCount: number): number {
  const boosted = BASE_FEATURE_WEIGHT + selectionCount * WEIGHT_INCREMENT;
  return Math.min(MAX_LEARNED_WEIGHT, Math.max(current, boosted));
}

export function applyLearnedWeights(
  features: FeatureValue[],
  learned: Map<string, number>
): FeatureValue[] {
  return features.map((f) => {
    const learnedW = learned.get(f.label);
    if (!learnedW || learnedW <= 1) return f;
    return {
      ...f,
      weight: Number(Math.min(MAX_LEARNED_WEIGHT, f.weight * learnedW).toFixed(4)),
    };
  });
}

export function detectRepetitiveResolution(
  recentActions: { keyword: string; section_id: string | null }[],
  keyword: string,
  sectionId: string
): boolean {
  const same = recentActions.filter(
    (r) => r.keyword === keyword && r.section_id === sectionId
  );
  return same.length >= 2;
}
