/**
 * OpenAI(ChatGPT) API 브릿지
 * env 우선, 없으면 시스템 설정 > AI 연동관리(DB)에서 읽음
 * Rate limiting 적용 (Gemini와 동일)
 */

import { NextResponse } from "next/server";
import { AI_FEATURES } from "@/lib/boardConfig";
import { getAppSetting } from "@/lib/appSettingsServer";
import { getClientIdentifier, LIMIT_AI_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { requireAuthenticatedSession } from "@/lib/adminSession";

const OPENAI_MODEL = "gpt-4o-mini";
const MAX_PROMPT_LENGTH = 32000;

async function getOpenAIApiKey(): Promise<string> {
  const envKey = process.env.OPENAI_API_KEY ?? "";
  if (envKey) return envKey.trim();
  const stored = await getAppSetting<{ openaiApiKey?: string }>("ai_settings");
  return (stored?.openaiApiKey ?? "").trim();
}

const SYSTEM_HINTS: Record<string, string> = {
  case_search: "당신은 대한민국 판례 검색·요약 전문가입니다. 질문에 맞는 판례 검색 방법, 요건, 관련 판례 요약을 답변하세요.",
  law_search: "당신은 대한민국 법령·조문 검색·해석 전문가입니다. 질문에 맞는 법령, 조문, 해석을 답변하세요.",
  doc_summary: "당신은 문서 요약 전문가입니다. 사용자가 제공한 문서를 핵심만 간결하게 요약하세요.",
  doc_draft: "당신은 법률 서면(진술서, 의견서 등) 초안 작성 전문가입니다. 요청에 맞는 서면 초안을 작성하세요.",
  ai_search: "당신은 법률·판례 통합 검색 도우미입니다. 자연어 질의를 분석하고 관련 법령·판례·해석을 종합해 답변하세요.",
};

const DEFAULT_SYSTEM = "당신은 법률 업무 지원 AI입니다. 질문에 맞게 정확하고 유용하게 답변하세요.";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const clientId = getClientIdentifier(req);
  const limited = enforceRateLimit(req, `ai:openai:${clientId}`, LIMIT_AI_PER_MIN, {
    routePath: "/api/ai/openai",
    source: "ai",
  });
  if (limited) return limited;

  let apiKey: string;
  try {
    apiKey = await getOpenAIApiKey();
  } catch (e) {
    console.error("getOpenAIApiKey error:", e);
    return NextResponse.json(
      {
        error: "OpenAI API 키를 불러오는 중 오류가 발생했습니다.",
        hint: "관리자 > 시스템 설정 > AI 연동관리에서 API 키를 확인하거나, .env.local에 OPENAI_API_KEY를 설정하세요.",
      },
      { status: 503 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OpenAI(ChatGPT) API 키가 설정되지 않았습니다.",
        hint: ".env.local에 OPENAI_API_KEY를 넣거나, 관리자 > 시스템 설정 > AI 연동관리에서 ChatGPT API 키를 입력하세요. (platform.openai.com에서 발급)",
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

    const systemHint = featureId && SYSTEM_HINTS[featureId] ? SYSTEM_HINTS[featureId] : DEFAULT_SYSTEM;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemHint },
          { role: "user", content: promptStr },
        ],
        max_tokens: 8192,
        temperature: 0.4,
      }),
    });

    const errText = await res.text();
    if (!res.ok) {
      let message = `OpenAI API 오류 (${res.status})`;
      try {
        const errJson = JSON.parse(errText) as { error?: { message?: string } };
        if (errJson?.error?.message) message = errJson.error.message;
      } catch {
        if (errText.includes("Incorrect API key") || errText.includes("invalid_api_key")) {
          message = "API 키가 유효하지 않습니다. OpenAI 대시보드에서 키를 확인하세요.";
        } else if (errText.includes("rate_limit") || errText.includes("quota")) {
          message = "OpenAI API 할당량을 초과했습니다. 잠시 후 다시 시도하거나 결제 정보를 확인하세요.";
        } else if (errText.length > 0 && errText.length < 300) {
          message = errText;
        }
      }
      return NextResponse.json(
        { error: message, detail: errText.slice(0, 300) },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = JSON.parse(errText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ text, model: OPENAI_MODEL });
  } catch (e) {
    console.error("OpenAI API error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const key = await getOpenAIApiKey();
  return NextResponse.json({
    configured: !!key,
    features: AI_FEATURES.map((f) => ({ id: f.id, name: f.name })),
  });
}
