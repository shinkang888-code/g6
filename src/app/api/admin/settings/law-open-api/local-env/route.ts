/**
 * 로컬 개발 전용: .env.local에 Vercel 토큰·법령 OC 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { mergeEnvLocal, readEnvLocal, maskSecret } from "@/lib/envLocalFile";
import { LAW_GO_KR_OC_ENV_KEY, normalizeLawGoKrOc } from "@/lib/lawOpenApiSettings";
import { getVercelEnvSyncStatus } from "@/lib/vercelEnvSync";

const LOCAL_KEYS = ["VERCEL_ACCESS_TOKEN", "VERCEL_TOKEN", LAW_GO_KR_OC_ENV_KEY] as const;

function devOnly() {
  return process.env.NODE_ENV === "development";
}

export async function GET() {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  if (!devOnly()) {
    return NextResponse.json({
      supported: false,
      hint: "프로덕션에서는 Vercel 대시보드에서 환경 변수를 직접 설정하세요.",
    });
  }

  const local = await readEnvLocal();
  const vercel = await getVercelEnvSyncStatus();

  const values: Record<string, { set: boolean; masked?: string }> = {};
  for (const key of LOCAL_KEYS) {
    const v = local[key]?.trim() ?? "";
    values[key] = {
      set: Boolean(v),
      masked: v ? maskSecret(v) : undefined,
    };
  }

  return NextResponse.json({
    supported: true,
    values,
    vercelReady: vercel.ready,
    project: vercel.project,
    hint: vercel.ready
      ? ".env.local 토큰이 확인되었습니다. 「Vercel에 반영」으로 LAW_GO_KR_OC를 원격에 등록할 수 있습니다."
      : "Vercel Access Token을 .env.local에 저장하세요. (vercel link는 이미 되어 있으면 project.json만 있으면 됩니다)",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  if (!devOnly()) {
    return NextResponse.json(
      { error: ".env.local 저장은 로컬 개발 환경에서만 가능합니다." },
      { status: 403 }
    );
  }

  let body: { vercelAccessToken?: string; lawGoKrOc?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  const token = (body.vercelAccessToken ?? "").trim();
  const oc = body.lawGoKrOc ? normalizeLawGoKrOc(body.lawGoKrOc) : "";

  if (token) updates.VERCEL_ACCESS_TOKEN = token;
  if (oc) updates[LAW_GO_KR_OC_ENV_KEY] = oc;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "저장할 값을 하나 이상 입력하세요." }, { status: 400 });
  }

  try {
    await mergeEnvLocal(updates);
    const vercel = await getVercelEnvSyncStatus();
    return NextResponse.json({
      ok: true,
      saved: Object.keys(updates),
      vercelReady: vercel.ready,
      message: `.env.local에 ${Object.keys(updates).join(", ")}를 저장했습니다. Vercel 동기화는 바로 사용할 수 있습니다.`,
    });
  } catch (e) {
    console.error("[law-open-api/local-env]", e);
    return NextResponse.json({ error: ".env.local 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
