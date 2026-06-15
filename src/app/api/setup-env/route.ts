/**
 * 로컬 개발 전용: .env.local 읽기/저장
 * NODE_ENV=development 일 때만 동작합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { ALL_ENV_SETUP_KEYS } from "@/lib/envSetupKeys";
import { mergeEnvLocal, readEnvLocal, maskSecret } from "@/lib/envLocalFile";

const SECRET_KEYS = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "SESSION_SECRET",
  "VERCEL_ACCESS_TOKEN",
  "LAW_GO_KR_OC",
]);

function devOnly() {
  return process.env.NODE_ENV === "development";
}

export async function GET() {
  if (!devOnly()) {
    return NextResponse.json(
      { error: "이 기능은 로컬 개발 환경에서만 사용할 수 있습니다." },
      { status: 403 }
    );
  }

  const stored = await readEnvLocal();
  const values: Record<string, { set: boolean; masked?: string }> = {};
  for (const key of ALL_ENV_SETUP_KEYS) {
    const v = stored[key] ?? "";
    values[key] = {
      set: Boolean(v.trim()),
      masked: SECRET_KEYS.has(key) && v ? maskSecret(v) : v || undefined,
    };
  }
  return NextResponse.json({ ok: true, values });
}

export async function POST(request: NextRequest) {
  if (!devOnly()) {
    return NextResponse.json(
      { error: "이 기능은 로컬 개발 환경에서만 사용할 수 있습니다." },
      { status: 403 }
    );
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  for (const key of ALL_ENV_SETUP_KEYS) {
    const v = (body[key] ?? "").trim();
    if (v) updates[key] = v;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "저장할 값을 하나 이상 입력하세요." }, { status: 400 });
  }

  try {
    await mergeEnvLocal(updates);
    return NextResponse.json({ ok: true, saved: Object.keys(updates) });
  } catch (e) {
    console.error("[setup-env]", e);
    return NextResponse.json(
      { error: ".env.local 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
