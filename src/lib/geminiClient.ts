/**
 * Gemini API 공통 클라이언트 (텍스트·Vision OCR)
 * env 우선 → app_settings.ai_settings.geminiApiKey
 *
 * 2026-06: gemini-1.5-* · gemini-2.0-* 종료 → 2.5/3.5 계열 사용
 */
import { getAppSetting } from "@/lib/appSettingsServer";

/** v1beta generateContent 지원 모델 (우선순위) */
export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-pro",
] as const;

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type GeminiGenerateResult =
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; message: string; invalidKey?: boolean };

export async function getGeminiApiKey(): Promise<string> {
  const envKey = (process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "").trim();
  if (envKey) return envKey;
  const stored = await getAppSetting<{ geminiApiKey?: string }>("ai_settings");
  return (stored?.geminiApiKey ?? "").trim();
}

export async function isGeminiConfigured(): Promise<boolean> {
  return (await getGeminiApiKey()).length > 0;
}

function resolveModelCandidates(): string[] {
  const override = (process.env.GEMINI_MODEL ?? process.env.GOOGLE_GEMINI_MODEL ?? "").trim();
  if (override) {
    return [override, ...GEMINI_MODELS.filter((m) => m !== override)];
  }
  return [...GEMINI_MODELS];
}

function isRetryableModelError(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("is not supported") ||
    lower.includes("no longer available") ||
    lower.includes("has been shutdown") ||
    lower.includes("deprecated")
  );
}

function mergeSystemHintIntoParts(parts: GeminiPart[], systemHint: string): GeminiPart[] {
  const hasVision = parts.some((p) => "inline_data" in p);
  if (hasVision) {
    const textParts = parts.filter((p): p is { text: string } => "text" in p);
    const visionParts = parts.filter((p) => "inline_data" in p);
    const mergedText = `${systemHint}\n\n---\n\n${textParts.map((p) => p.text).join("\n")}`;
    return [{ text: mergedText }, ...visionParts];
  }
  const userText = parts
    .filter((p): p is { text: string } => "text" in p)
    .map((p) => p.text)
    .join("\n");
  return [{ text: `${systemHint}\n\n---\n\n${userText}` }];
}

function parseGeminiError(status: number, body: string): Extract<GeminiGenerateResult, { ok: false }> {
  let message = `Gemini API 오류 (${status})`;
  let invalidKey = false;
  try {
    const json = JSON.parse(body) as { error?: { message?: string } };
    const msg = json.error?.message ?? "";
    if (msg) message = msg;
    const lower = msg.toLowerCase();
    if (lower.includes("api key not valid") || (lower.includes("invalid") && lower.includes("key"))) {
      invalidKey = true;
      message = "Gemini API 키가 유효하지 않습니다. Google AI Studio에서 새 키를 발급해 주세요.";
    }
  } catch {
    if (body.length > 0 && body.length < 400) message = body;
  }
  return { ok: false, status, message, invalidKey };
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  options: { systemHint?: string; temperature: number; maxOutputTokens: number }
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string; invalidKey?: boolean }> {
  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    },
  };
  if (options.systemHint) {
    payload.systemInstruction = { parts: [{ text: options.systemHint }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();

  if (!res.ok) {
    const parsed = parseGeminiError(res.status, body);
    return { ok: false, status: parsed.status, body, invalidKey: parsed.invalidKey };
  }

  try {
    const json = JSON.parse(body) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return { ok: true, text };
  } catch {
    return { ok: false, status: 502, body: "Gemini 응답 파싱 실패" };
  }
}

/** Gemini generateContent (텍스트·Vision 공통, 모델 폴백) */
export async function generateGeminiContent(options: {
  apiKey?: string;
  parts: GeminiPart[];
  systemHint?: string;
  temperature?: number;
  maxOutputTokens?: number;
  minTextLength?: number;
}): Promise<GeminiGenerateResult> {
  const apiKey = (options.apiKey ?? (await getGeminiApiKey())).trim();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      message:
        "Gemini API 키가 설정되지 않았습니다. 관리자 > AI 연동관리 또는 GOOGLE_GEMINI_API_KEY 환경 변수를 설정하세요.",
    };
  }

  const temperature = options.temperature ?? 0.2;
  const maxOutputTokens = options.maxOutputTokens ?? 8192;
  const minLen = options.minTextLength ?? 1;
  const models = resolveModelCandidates();
  const failures: string[] = [];

  let last: Extract<GeminiGenerateResult, { ok: false }> = {
    ok: false,
    status: 502,
    message: "Gemini 모델 호출 실패",
  };

  for (const model of models) {
    let result = await callGeminiModel(apiKey, model, options.parts, {
      systemHint: options.systemHint,
      temperature,
      maxOutputTokens,
    });

    if (
      !result.ok &&
      options.systemHint &&
      isRetryableModelError(result.body)
    ) {
      result = await callGeminiModel(
        apiKey,
        model,
        mergeSystemHintIntoParts(options.parts, options.systemHint),
        { temperature, maxOutputTokens }
      );
    }

    if (result.ok) {
      if (result.text.length >= minLen) {
        return { ok: true, text: result.text, model };
      }
      failures.push(`${model}: 빈 응답`);
      continue;
    }

    last = parseGeminiError(result.status, result.body);
    if (last.invalidKey) return last;

    failures.push(`${model}: ${last.message.slice(0, 120)}`);

    if (isRetryableModelError(result.body)) continue;
    if (result.body.toLowerCase().includes("quota")) continue;
    return last;
  }

  return {
    ok: false,
    status: last.status,
    message:
      failures.length > 0
        ? `사용 가능한 Gemini 모델을 찾지 못했습니다. (시도: ${models.join(", ")}). Google AI Studio에서 API 키·할당량을 확인하거나 GEMINI_MODEL 환경 변수로 모델을 지정하세요.`
        : last.message,
  };
}

/** API 키 유효성 검사 (저장 전) */
export async function validateGeminiApiKey(apiKey: string): Promise<{ ok: boolean; error?: string; model?: string }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, error: "API 키가 비어 있습니다." };
  const result = await generateGeminiContent({
    apiKey: key,
    parts: [{ text: "Reply with exactly: OK" }],
    temperature: 0,
    maxOutputTokens: 16,
    minTextLength: 1,
  });
  if (result.ok) return { ok: true, model: result.model };
  return { ok: false, error: result.message };
}
