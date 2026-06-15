/**
 * AI 프롬프트 — 로이고법률백과 검색·모범답안
 */

import type { EncyclopediaCategory, FeatureValue, RankedLegalDocument } from "./types";

export function buildSearchPrompt(params: {
  keyword: string;
  synonyms: string[];
  domain: string;
  domainReason: string;
  features: FeatureValue[];
  category: EncyclopediaCategory | "전체";
  detail?: string;
}): string {
  const { keyword, synonyms, domain, domainReason, features, category, detail } = params;
  const featureList = features.map((f) => `- ${f.label} (${f.kind}, 가중 ${f.weight})`).join("\n");

  return `당신은 대한민국 법률 온라인 백과사전 엔진입니다.
특허 기반 파이프라인(온톨로지→자질값→의미벡터→순위화)으로 법률정보를 검색합니다.

## 검색 키워드
${keyword}

## 온톨로지 유의어
${synonyms.join(", ")}

## 검색 범위(분야)
${domain} — ${domainReason}

## 자질값(Feature)
${featureList}

## 카테고리 필터
${category === "전체" ? "전체 (판롈·법령·서식·기타·관련문서 골고루)" : `반드시 category를 "${category}"(으)로만 작성. 다른 종류 금지.`}

${category === "판례" ? `## 판례 작성 규칙
- title에 실제 형식의 사건번호 포함 (예: 2019다123456)
- source에 사건번호·법원·선고일 반복 기재
- body에 핵심 쟁점·판결요지 200자 이상` : ""}

${category === "법령" ? `## 법령 작성 규칙
- title에 법령명 (예: 민법, 상법)
- body에 관련 조문 번호 (예: 제750조) 포함` : ""}

${detail ? `## 추가 상세정보\n${detail}` : ""}

다음 JSON 배열만 출력하세요 (마크다운 없이):
[
  {
    "title": "문서 제목",
    "category": "판례|법령|서식|기타자료|관련법률문서",
    "domain": "민법|형법|민사소송법|상법|헌법|행정법|기업법무|전체",
    "summary": "2~3문장 요약",
    "body": "핵심 법률구문·요건·쟁점 (200~400자)",
    "source": "출처(법령명·판례번호 등)"
  }
]

최소 5개, 최대 8개 항목. 관련성 높은 순으로 작성. 실제 한국 법률 체계에 맞게.`;
}

export function buildModelAnswerPrompt(params: {
  keyword: string;
  sectionTitle: string;
  documents: RankedLegalDocument[];
  features: FeatureValue[];
}): string {
  const { keyword, sectionTitle, documents, features } = params;
  const docBlock = documents
    .slice(0, 6)
    .map(
      (d, i) =>
        `[${i + 1}] ${d.title} (순위점수 ${d.rankingScore})\n요약: ${d.summary}\n본문: ${d.body}`
    )
    .join("\n\n");

  return `당신은 법률 모범답안 작성 엔진입니다.
선택된 소목차에 대해 순위화된 법률구문을 연결하여 하나의 웹문서형 모범답안을 작성하세요.

## 키워드
${keyword}

## 선택 소목차
${sectionTitle}

## 자질값
${features.map((f) => f.label).join(", ")}

## 순위화된 법률문서
${docBlock}

다음 형식으로 작성:
1. 서론 (쟁점 정리)
2. 법적 근거 (조문·판례)
3. 요건·판단기준
4. 실무 적용 (모범답안 핵심 논리)
5. 결론

각 절은 ---SECTION--- 구분자로 나누고, 절 제목을 첫 줄에 적으세요.
법률전문가가 바로 참고할 수 있는 모범답안 형태로 작성하세요.`;
}

export function parseAiDocumentsJson(text: string): {
  title: string;
  category: string;
  domain: string;
  summary: string;
  body: string;
  source?: string;
}[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const arr = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      .map((x) => ({
        title: String(x.title ?? "제목 없음"),
        category: String(x.category ?? "기타자료"),
        domain: String(x.domain ?? "전체"),
        summary: String(x.summary ?? ""),
        body: String(x.body ?? ""),
        source: x.source ? String(x.source) : undefined,
      }));
  } catch {
    return [];
  }
}

export function parseModelAnswerSections(text: string): { title: string; content: string }[] {
  const parts = text.split(/---SECTION---/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return [{ title: "모범답안", content: text.trim() }];
  }
  return parts.map((p) => {
    const lines = p.split("\n");
    const title = lines[0]?.replace(/^#+\s*/, "").trim() || "절";
    const content = lines.slice(1).join("\n").trim();
    return { title, content };
  });
}
