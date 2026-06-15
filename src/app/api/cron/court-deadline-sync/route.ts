/**
 * 법원기일 자동연동 Cron
 * Vercel Cron 또는 수동 호출: Authorization: Bearer {CRON_SECRET}
 *
 * 큐에 우선순위 대상만 등록(비동기). 로컬 bot `npm run queue` 가 처리.
 */
import { NextRequest, NextResponse } from "next/server";
import { enqueueAutoSyncBatch } from "@/lib/courtDeadlineAutoSync";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const q = request.nextUrl.searchParams.get("secret");
  return q === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 30) : 12;

  try {
    const result = await enqueueAutoSyncBatch(limit);
    return NextResponse.json({
      ok: true,
      mode: "auto_enqueue",
      limit,
      enqueued: result.enqueued.length,
      skipped: result.skipped,
      cases: result.enqueued,
      hint: "로컬 bot 큐 워커(npm run queue)가 작업을 처리합니다.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "자동연동 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
