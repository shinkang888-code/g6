/**
 * 관리자: 시스템 설정 조회/일괄 저장
 * app_settings 테이블 사용
 * - 서버: getSupabaseAdmin() 우선 사용 (SUPABASE_SERVICE_ROLE_KEY 있으면 연동됨)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession, requirePlatformSecretsAdmin } from "@/lib/adminSession";
import {
  filterSettingsForSession,
  isSensitiveSettingsKey,
} from "@/lib/platformSecretsAdmin";
import { validateGeminiApiKey } from "@/lib/geminiClient";

function getDb() {
  return getSupabaseAdmin() ?? supabase;
}

export async function GET() {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });
  }
  const { data, error } = await db
    .from("app_settings")
    .select("key, value");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const settings: Record<string, unknown> = {};
  (data ?? []).forEach((row: { key: string; value: unknown }) => {
    settings[row.key] = row.value;
  });
  return NextResponse.json(filterSettingsForSession(settings, admin.session));
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const keys = Object.keys(body);
  if (keys.length === 0) {
    return NextResponse.json({ error: "저장할 설정이 없습니다." }, { status: 400 });
  }
  for (const key of keys) {
    if (isSensitiveSettingsKey(key)) {
      const secretsAuth = await requirePlatformSecretsAdmin();
      if ("error" in secretsAuth) return secretsAuth.error;
    }

    if (key === "ai_settings" && body[key] && typeof body[key] === "object") {
      const ai = body[key] as { geminiApiKey?: string };
      const geminiKey = (ai.geminiApiKey ?? "").trim();
      if (geminiKey) {
        const check = await validateGeminiApiKey(geminiKey);
        if (!check.ok) {
          return NextResponse.json(
            { error: check.error ?? "Gemini API 키 검증에 실패했습니다." },
            { status: 400 }
          );
        }
      }
    }

    const { error: upsertError } = await db
      .from("app_settings")
      .upsert({ key, value: body[key] ?? {} }, { onConflict: "key" });
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 });
    }
  }
  return NextResponse.json({ success: true });
}
