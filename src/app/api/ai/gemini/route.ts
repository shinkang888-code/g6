/**
 * Gemini AI API 브릿지
 * env 우선, 없으면 시스템 설정 > AI 연동관리(DB)에서 읽음
 * Rate limiting 적용 (비용·남용 방지)
 */

import { NextResponse } from "next/server";
import { AI_FEATURES } from "@/lib/boardConfig";
import { getClientIdentifier, LIMIT_AI_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import {
  GEMINI_MODELS,
  generateGeminiContent,
  getGeminiApiKey,
  isGeminiConfigured,
} from "@/lib/geminiClient";

/** 사용자 입력 최대 길이 (Prompt Injection 완화) */
const MAX_PROMPT_LENGTH = 32000;

const SYSTEM_HINTS: Record<string, string> = {
  legal_encyclopedia:
    "당신은 특허 기반 로이고법률백과 AI입니다. 온톨로지·자질값·의미벡터·순위화·모범답안 파이프라인에 맞게 법률정보를 구조화하세요.",
  case_search: "당신은 대한민국 판례 검색·요약 전문가입니다. 질문에 맞는 판례 검색 방법, 요건, 관련 판례 요약을 답변하세요.",
  law_search: "당신은 대한민국 법령·조문 검색·해석 전문가입니다. 질문에 맞는 법령, 조문, 해석을 답변하세요.",
  doc_summary: "당신은 문서 요약 전문가입니다. 사용자가 제공한 문서를 핵심만 간결하게 요약하세요.",
  doc_draft: "당신은 법률 서면(진술서, 의견서 등) 초안 작성 전문가입니다. 요청에 맞는 서면 초안을 작성하세요.",
  ai_search: "당신은 법률·판례 통합 검색 도우미입니다. 자연어 질의를 분석하고 관련 법령·판례·해석을 종합해 답변하세요.",
};

export async function POST(req: Request) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const clientId = getClientIdentifier(req);
  const limited = enforceRateLimit(req, `ai:gemini:${clientId}`, LIMIT_AI_PER_MIN, {
    routePath: "/api/ai/gemini",
    source: "ai",
  });
  if (limited) return limited;

  let GEMINI_API_KEY: string;
  try {
    GEMINI_API_KEY = await getGeminiApiKey();
  } catch (e) {
    console.error("getGeminiApiKey error:", e);
    return NextResponse.json(
      {
        error: "Gemini API 키를 불러오는 중 오류가 발생했습니다.",
        hint: "관리자 > 시스템 설정 > AI 연동관리에서 API 키를 확인하거나, .env.local에 GOOGLE_GEMINI_API_KEY 또는 GEMINI_API_KEY를 설정하세요.",
      },
      { status: 503 }
    );
  }

  if (!GEMINI_API_KEY || !GEMINI_API_KEY.trim()) {
    return NextResponse.json(
      {
        error: "Gemini API 키가 설정되지 않았습니다.",
        hint: ".env.local에 GOOGLE_GEMINI_API_KEY 또는 GEMINI_API_KEY를 넣거나, 관리자 > 시스템 설정 > AI 연동관리에서 API 키를 입력하세요. (Google AI Studio에서 발급)",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, featureId } = (body || {}) as { prompt?: string; featureId?: string };
    const promptStr = typeof prompt === "string" ? prompt.trim() : "";

    if (!promptStr) {
      return NextResponse.json(
        { error: "질문 내용이 비어 있습니다. 사건 요지 또는 검색어를 입력해 주세요." },
        { status: 400 }
      );
    }
    if (promptStr.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `질문은 ${MAX_PROMPT_LENGTH.toLocaleString()}자 이내로 입력해 주세요.` },
        { status: 400 }
      );
    }

    const systemHint = featureId && SYSTEM_HINTS[featureId]
      ? SYSTEM_HINTS[featureId]
      : "당신은 법률 업무 지원 AI입니다. 질문에 맞게 정확하고 유용하게 답변하세요.";

    const generationConfig = { temperature: 0.4, maxOutputTokens: 8192 };
    const result = await generateGeminiContent({
      parts: [{ text: promptStr }],
      systemHint: systemHint,
      temperature: generationConfig.temperature,
      maxOutputTokens: generationConfig.maxOutputTokens,
    });

    if (result.ok) {
      return NextResponse.json({ text: result.text, model: result.model });
    }

    let message = result.message;
    const lastStatus = result.status;
    const lastErrText = result.message;
    return NextResponse.json(
      { error: message, detail: lastErrText.slice(0, 300) },
      { status: lastStatus >= 500 ? 502 : 400 }
    );
  } catch (e) {
    console.error("Gemini API error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    configured: await isGeminiConfigured(),
    models: GEMINI_MODELS,
    features: AI_FEATURES.map((f) => ({ id: f.id, name: f.name })),
  });
}
