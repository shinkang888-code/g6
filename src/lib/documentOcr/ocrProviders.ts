/**
 * 문서 OCR 프로바이더 (LawyGo bot과 동일 엔진 계열)
 * - Google Cloud Vision: 한글·판결문 OCR (권장)
 * - Naver CLOVA OCR: 한글 문서 (bot OCR_PROVIDER=clova)
 * - Gemini Vision: PDF·이미지 텍스트 추출 (AI 설정·env)
 */
import { generateGeminiContent, getGeminiApiKey, isGeminiConfigured } from "@/lib/geminiClient";
import { normalizeJudgmentText } from "@/lib/pdfTextExtract";
import type { OcrMethod } from "./types";

const OCR_PROMPT =
  "이 문서(판결문·법률 문서)의 본문 텍스트를 빠짐없이 추출하세요. 【주문】【이유】【범죄사실】 등 구조와 줄바꿈을 유지하고, 설명·요약 없이 추출된 텍스트만 출력하세요.";

function visionKey(): string {
  return process.env.GOOGLE_VISION_API_KEY?.trim() ?? "";
}

function clovaConfig(): { url: string; secret: string } {
  return {
    url: process.env.CLOVA_OCR_URL?.trim() ?? "",
    secret: process.env.CLOVA_OCR_SECRET?.trim() ?? "",
  };
}

/** Google Cloud Vision — DOCUMENT_TEXT_DETECTION (한글 가독성 우수) */
export async function ocrWithGoogleVision(
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const key = visionKey();
  if (!key) return null;

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: buffer.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: mimeType.startsWith("image/") ? { languageHints: ["ko", "en"] } : undefined,
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as {
    responses?: { fullTextAnnotation?: { text?: string }; textAnnotations?: { description?: string }[] }[];
  };
  const text =
    json.responses?.[0]?.fullTextAnnotation?.text ??
    json.responses?.[0]?.textAnnotations?.[0]?.description ??
    "";
  return text.trim() || null;
}

/** Naver CLOVA OCR — bot과 동일 API */
export async function ocrWithClova(buffer: Buffer, mimeType: string): Promise<string | null> {
  const { url, secret } = clovaConfig();
  if (!url || !secret) return null;

  const format = mimeType.includes("png")
    ? "png"
    : mimeType.includes("pdf")
      ? "pdf"
      : "jpg";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-OCR-SECRET": secret },
    body: JSON.stringify({
      version: "V2",
      requestId: `lawygo-doc-${Date.now()}`,
      timestamp: Date.now(),
      lang: "ko",
      images: [{ name: "document", format, data: buffer.toString("base64") }],
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as {
    images?: { fields?: { inferText?: string }[]; text?: string }[];
  };
  const img = json.images?.[0];
  const fromFields = (img?.fields ?? []).map((f) => f.inferText ?? "").join("\n");
  const text = (fromFields || img?.text || "").trim();
  return text || null;
}

export type OcrChainError = {
  code: "no_provider" | "invalid_gemini_key" | "gemini_failed";
  message: string;
};

/** Gemini — PDF·이미지에서 본문 텍스트 추출 */
export async function ocrWithGeminiVision(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string } | OcrChainError> {
  const key = await getGeminiApiKey();
  if (!key) {
    return {
      code: "no_provider",
      message:
        "Gemini API 키가 없습니다. 관리자 > AI 연동관리에서 Google AI Studio 키를 저장하거나 GOOGLE_GEMINI_API_KEY 환경 변수를 설정하세요.",
    };
  }

  const result = await generateGeminiContent({
    apiKey: key,
    parts: [
      { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
      { text: OCR_PROMPT },
    ],
    temperature: 0.1,
    maxOutputTokens: 8192,
    minTextLength: 8,
  });

  if (result.ok) return { text: result.text };
  if (result.invalidKey) {
    return {
      code: "invalid_gemini_key",
      message:
        "Gemini API 키가 유효하지 않습니다. Google AI Studio(https://aistudio.google.com/apikey)에서 새 키를 발급한 뒤 관리자 > AI 연동관리에 저장하세요.",
    };
  }
  return { code: "gemini_failed", message: result.message };
}

export async function runDocumentOcrChain(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; method: OcrMethod } | OcrChainError> {
  const vision = await ocrWithGoogleVision(buffer, mimeType);
  if (vision) return { text: normalizeJudgmentText(vision), method: "vision" };

  const clova = await ocrWithClova(buffer, mimeType);
  if (clova) return { text: normalizeJudgmentText(clova), method: "clova" };

  const gemini = await ocrWithGeminiVision(buffer, mimeType);
  if ("text" in gemini) {
    return { text: normalizeJudgmentText(gemini.text), method: "gemini-vision" };
  }
  return gemini;
}

export async function getOcrAvailability(): Promise<{
  vision: boolean;
  clova: boolean;
  gemini: boolean;
}> {
  return {
    vision: !!visionKey(),
    clova: !!clovaConfig().url && !!clovaConfig().secret,
    gemini: await isGeminiConfigured(),
  };
}
