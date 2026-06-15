/**
 * LAW_GO_KR_OC → Vercel 프로젝트 환경 변수 반영
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { getAppSetting } from "@/lib/appSettingsServer";
import {
  LAW_GO_KR_OC_ENV_KEY,
  LAW_OPEN_API_SETTINGS_KEY,
  normalizeLawGoKrOc,
  type LawOpenApiSettings,
} from "@/lib/lawOpenApiSettings";
import { getVercelEnvSyncStatus, syncEnvVarsToVercel } from "@/lib/vercelEnvSync";

export async function GET() {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const status = await getVercelEnvSyncStatus();
  return NextResponse.json({
    ok: true,
    ready: status.ready,
    hasToken: status.hasToken,
    project: status.project,
    hint: status.hint,
    envKey: LAW_GO_KR_OC_ENV_KEY,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  let body: { oc?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* optional body */
  }

  const fromBody = body.oc ? normalizeLawGoKrOc(body.oc) : "";
  const stored = (await getAppSetting<LawOpenApiSettings>(LAW_OPEN_API_SETTINGS_KEY)) ?? {};
  const oc = fromBody || normalizeLawGoKrOc(stored.oc ?? "");

  if (!oc) {
    return NextResponse.json(
      { error: "Vercel에 반영할 OC 값이 없습니다. 먼저 저장하거나 요청 본문에 oc를 넣으세요." },
      { status: 400 }
    );
  }

  try {
    const result = await syncEnvVarsToVercel({ [LAW_GO_KR_OC_ENV_KEY]: oc });
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      projectId: result.projectId,
      projectName: result.projectName,
      message: `Vercel에 ${LAW_GO_KR_OC_ENV_KEY}를 반영했습니다. 프로덕션 재배포 후 런타임 env가 적용됩니다.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Vercel 동기화 실패";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
