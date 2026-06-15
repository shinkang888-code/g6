/**
 * 국가법령정보 공동활용 Open API OC 설정 (관리자)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, requirePlatformSecretsAdmin } from "@/lib/adminSession";
import {
  filterSettingsForSession,
  isSensitiveSettingsKey,
} from "@/lib/platformSecretsAdmin";
import { readEnvLocal } from "@/lib/envLocalFile";
import { getAppSetting, setAppSetting } from "@/lib/appSettingsServer";
import {
  LAW_GO_KR_OC_ENV_KEY,
  LAW_OPEN_API_SETTINGS_KEY,
  getLawGoKrOc,
  getLawOpenApiConfigSource,
  maskLawGoKrOc,
  normalizeLawGoKrOc,
  type LawOpenApiSettings,
} from "@/lib/lawOpenApiSettings";

export async function GET() {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const fromEnv = Boolean(process.env[LAW_GO_KR_OC_ENV_KEY]?.trim());
  const local = await readEnvLocal();
  const fromLocalFile = Boolean(local[LAW_GO_KR_OC_ENV_KEY]?.trim());
  const stored = (await getAppSetting<LawOpenApiSettings>(LAW_OPEN_API_SETTINGS_KEY)) ?? {};
  const source = await getLawOpenApiConfigSource();
  const effective = await getLawGoKrOc();

  return NextResponse.json({
    configured: Boolean(effective),
    credentialsFromEnv: fromEnv && !stored.preferDbOverEnv,
    preferDbOverEnv: Boolean(stored.preferDbOverEnv),
    canOverrideEnv: fromEnv,
    credentialsFromLocalFile: fromLocalFile,
    localEnvSupported: process.env.NODE_ENV === "development",
    source,
    enabled: stored.enabled !== false,
    oc: fromEnv
      ? maskLawGoKrOc(process.env[LAW_GO_KR_OC_ENV_KEY] ?? "")
      : fromLocalFile
        ? maskLawGoKrOc(local[LAW_GO_KR_OC_ENV_KEY] ?? "")
        : stored.oc
          ? maskLawGoKrOc(stored.oc)
          : "",
    hasStoredOc: Boolean(stored.oc?.trim()),
    envKey: LAW_GO_KR_OC_ENV_KEY,
    hint: effective
      ? "법률 검색 우측 패널에서 Open API 조문 원문을 불러올 수 있습니다."
      : "open.law.go.kr에서 API를 신청한 뒤 OC 값(이메일 @ 앞 ID)을 입력하세요.",
    registerUrl: "https://open.law.go.kr/LSO/main.do",
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  let body: { oc?: string; enabled?: boolean; clearOc?: boolean; overrideEnv?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (process.env[LAW_GO_KR_OC_ENV_KEY]?.trim() && !body.overrideEnv) {
    return NextResponse.json(
      {
        error: `환경 변수 ${LAW_GO_KR_OC_ENV_KEY}가 설정되어 있습니다. 「환경 변수 키 교체」 후 저장하세요.`,
        code: "ENV_LOCKED",
      },
      { status: 400 }
    );
  }

  const existing = (await getAppSetting<LawOpenApiSettings>(LAW_OPEN_API_SETTINGS_KEY)) ?? {};
  let oc = existing.oc?.trim() ?? "";

  if (body.clearOc) {
    oc = "";
  } else if (body.oc !== undefined) {
    const normalized = normalizeLawGoKrOc(body.oc);
    if (!normalized) {
      return NextResponse.json({ error: "OC 값을 입력하세요. (이메일 @ 앞 ID)" }, { status: 400 });
    }
    if (normalized.length > 64) {
      return NextResponse.json({ error: "OC 값이 너무 깁니다." }, { status: 400 });
    }
    oc = normalized;
  }

  const next: LawOpenApiSettings = {
    oc: oc || undefined,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled !== false,
    updatedAt: new Date().toISOString(),
    preferDbOverEnv:
      body.overrideEnv === true || existing.preferDbOverEnv === true || Boolean(body.oc !== undefined),
  };

  const ok = await setAppSetting(LAW_OPEN_API_SETTINGS_KEY, next);
  if (!ok) {
    return NextResponse.json({ error: "DB에 설정을 저장하지 못했습니다." }, { status: 503 });
  }

  const effective = await getLawGoKrOc();
  return NextResponse.json({
    success: true,
    configured: Boolean(effective),
    oc: oc ? maskLawGoKrOc(oc) : "",
    hasStoredOc: Boolean(oc),
  });
}
