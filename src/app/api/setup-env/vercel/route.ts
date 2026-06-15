/**
 * 로컬 개발 전용: 입력/.env.local 값을 연결된 Vercel 프로젝트에 반영
 */

import { NextRequest, NextResponse } from "next/server";
import { ALL_ENV_SETUP_KEYS } from "@/lib/envSetupKeys";
import { readEnvLocal } from "@/lib/envLocalFile";
import {
  getVercelEnvSyncStatus,
  syncEnvVarsToVercel,
} from "@/lib/vercelEnvSync";

const VERCEL_ONLY_KEYS = new Set(["VERCEL_ACCESS_TOKEN", "VERCEL_TOKEN"]);

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

  const status = await getVercelEnvSyncStatus();
  return NextResponse.json({
    ok: true,
    ready: status.ready,
    hasToken: status.hasToken,
    project: status.project,
    hint: status.hint,
  });
}

export async function POST(request: NextRequest) {
  if (!devOnly()) {
    return NextResponse.json(
      { error: "이 기능은 로컬 개발 환경에서만 사용할 수 있습니다." },
      { status: 403 }
    );
  }

  let body: Record<string, string> = {};
  try {
    body = await request.json();
  } catch {
    // body 없으면 .env.local만 동기화
  }

  const local = await readEnvLocal();
  const merged: Record<string, string> = {};

  for (const key of ALL_ENV_SETUP_KEYS) {
    const fromForm = (body[key] ?? "").trim();
    const fromLocal = (local[key] ?? "").trim();
    const value = fromForm || fromLocal;
    if (value) merged[key] = value;
  }

  try {
    const result = await syncEnvVarsToVercel(merged, { excludeKeys: VERCEL_ONLY_KEYS });
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      projectId: result.projectId,
      projectName: result.projectName,
      message: `Vercel 프로젝트${result.projectName ? ` (${result.projectName})` : ""}에 ${result.synced.length}개 키를 반영했습니다. 재배포 후 적용됩니다.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Vercel 동기화 실패";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
