/**
 * Gemini API 연결 테스트 (관리자)
 * POST { geminiApiKey?: string } — 생략 시 저장된 키 검사
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { getGeminiApiKey, validateGeminiApiKey } from "@/lib/geminiClient";

export async function POST(request: NextRequest) {
  const admin = await requirePlatformSecretsAdmin();
  if ("error" in admin) return admin.error;

  let body: { geminiApiKey?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  const key = (body.geminiApiKey ?? (await getGeminiApiKey())).trim();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Gemini API 키가 없습니다. Google AI Studio에서 발급 후 입력하세요." },
      { status: 400 }
    );
  }

  const result = await validateGeminiApiKey(key);
  if (result.ok) {
    return NextResponse.json({ ok: true, model: result.model, message: "Gemini API 연결 성공" });
  }
  return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}
