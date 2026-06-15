/**
 * 자질값 형성모듈(220)·의미벡터 변환(270)·차원감소(260)
 */

import type { FeatureValue, SemanticVector } from "./types";

export function formFeatureValues(
  keyword: string,
  synonyms: string[],
  relatedLaws: string[],
  domain: string
): FeatureValue[] {
  const features: FeatureValue[] = [
    {
      id: "f-kw",
      label: keyword,
      kind: "keyword",
      weight: 1,
    },
  ];

  synonyms.slice(0, 5).forEach((s, i) => {
    if (s !== keyword) {
      features.push({
        id: `f-syn-${i}`,
        label: s,
        kind: "synonym",
        weight: 0.85 - i * 0.05,
      });
    }
  });

  relatedLaws.forEach((law, i) => {
    features.push({
      id: `f-law-${i}`,
      label: law,
      kind: "law",
      weight: 0.9,
    });
  });

  if (domain && domain !== "전체") {
    features.push({
      id: "f-domain",
      label: domain,
      kind: "domain",
      weight: 0.75,
    });
  }

  return features;
}

/** 간이 해시 기반 의미벡터 (특허 의미벡터 저장·표시용) */
function hashToDims(text: string, dim = 8): number[] {
  const dims: number[] = [];
  for (let d = 0; d < dim; d++) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h * 31 + text.charCodeAt(i) + d * 17) % 997;
    }
    dims.push(Number((h / 997).toFixed(4)));
  }
  return dims;
}

export function textToSemanticVector(token: string): SemanticVector {
  const dimensions = hashToDims(token);
  const magnitude = Math.sqrt(dimensions.reduce((s, v) => s + v * v, 0));
  return {
    id: `vec-${token.slice(0, 12).replace(/\W/g, "")}-${Date.now().toString(36)}`,
    token,
    dimensions,
    magnitude: Number(magnitude.toFixed(4)),
  };
}

export function buildVectorsFromFeatures(features: FeatureValue[]): SemanticVector[] {
  return features.map((f) => textToSemanticVector(f.label));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
