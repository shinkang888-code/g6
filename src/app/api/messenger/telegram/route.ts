/**
 * 텔레그램 발송 (Telegram Bot API)
 * POST body: { receivers: string[], message: string }
 * receivers = Telegram chat_id 목록 (숫자 또는 @username)
 * 관리자 콘솔 > 메신저 연동관리 > 텔레그램 봇 토큰에서 설정한 값 사용 (env TELEGRAM_BOT_TOKEN 없으면 DB 설정 우선)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAppSetting } from "@/lib/appSettingsServer";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { getClientIdentifier, LIMIT_MESSENGER_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

async function getTelegramBotToken(): Promise<string> {
  const envToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_TOKEN ?? "";
  if (envToken) return envToken;
  const stored = await getAppSetting<{ telegramBotToken?: string }>("messenger_settings");
  return stored?.telegramBotToken ?? "";
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const limited = enforceRateLimit(request, `messenger:telegram:${getClientIdentifier(request)}`, LIMIT_MESSENGER_PER_MIN, {
    routePath: "/api/messenger/telegram",
    source: "api",
  });
  if (limited) return limited;

  const token = await getTelegramBotToken();

  if (!token.trim()) {
    return NextResponse.json(
      {
        error:
          "텔레그램 연동이 설정되지 않았습니다. 관리자 콘솔 > 메신저 연동관리에서 텔레그램 봇 토큰을 입력하세요.",
      },
      { status: 503 }
    );
  }

  let body: { receivers?: string[]; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const receivers = body.receivers;
  const message = (body.message ?? "").trim();

  if (!Array.isArray(receivers) || receivers.length === 0) {
    return NextResponse.json(
      { error: "수신자(Telegram Chat ID)를 1개 이상 입력하세요." },
      { status: 400 }
    );
  }
  if (receivers.length > 5) {
    return NextResponse.json(
      { error: "수신자는 최대 5개까지 가능합니다." },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json({ error: "발송 내용을 입력하세요." }, { status: 400 });
  }

  const chatIds = receivers.map((r) => String(r).trim()).filter(Boolean);
  if (chatIds.length === 0) {
    return NextResponse.json({ error: "유효한 수신자가 없습니다." }, { status: 400 });
  }

  const url = `${TELEGRAM_API_BASE}${token}/sendMessage`;
  let successCount = 0;
  const errors: string[] = [];

  for (const chatId of chatIds) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok === true) {
        successCount += 1;
      } else {
        errors.push(`${chatId}: ${data.description ?? res.statusText ?? "실패"}`);
      }
    } catch (e) {
      errors.push(`${chatId}: ${e instanceof Error ? e.message : "요청 실패"}`);
    }
  }

  if (successCount === 0) {
    return NextResponse.json(
      {
        error: "텔레그램 발송에 실패했습니다.",
        details: errors,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    message: `${successCount}건 발송되었습니다.${errors.length > 0 ? ` (실패: ${errors.length}건)` : ""}`,
    success_cnt: successCount,
    error_cnt: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
