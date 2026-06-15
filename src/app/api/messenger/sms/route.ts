/**
 * 문자 발송 (알리고 API)
 * POST body: { receivers: string[], message: string }
 * env 우선, 없으면 시스템 설정 > 메신저 연동관리(DB)에서 읽음
 */

import { NextRequest, NextResponse } from "next/server";
import { getAppSetting } from "@/lib/appSettingsServer";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { getClientIdentifier, LIMIT_MESSENGER_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

const ALIGO_SEND_URL = "https://apis.aligo.in/send/";

async function getAligoConfig(): Promise<{ key: string; userId: string; sender: string }> {
  const key = process.env.ALIGO_KEY ?? process.env.ALIGO_API_KEY ?? "";
  const userId = process.env.ALIGO_USER_ID ?? "";
  const sender = process.env.ALIGO_SENDER ?? "";
  if (key && userId && sender) return { key, userId, sender };
  const stored = await getAppSetting<{ aligoKey?: string; aligoUserId?: string; aligoSender?: string }>("messenger_settings");
  return {
    key: stored?.aligoKey ?? key,
    userId: stored?.aligoUserId ?? userId,
    sender: stored?.aligoSender ?? sender,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const limited = enforceRateLimit(request, `messenger:sms:${getClientIdentifier(request)}`, LIMIT_MESSENGER_PER_MIN, {
    routePath: "/api/messenger/sms",
    source: "api",
  });
  if (limited) return limited;

  const { key, userId, sender } = await getAligoConfig();

  if (!key || !userId || !sender) {
    return NextResponse.json(
      { error: "알리고 연동이 설정되지 않았습니다. 시스템 설정 > 메신저 연동관리에서 알리고 API 키·User ID·발신번호를 입력하세요." },
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
    return NextResponse.json({ error: "수신 번호를 1개 이상 입력하세요." }, { status: 400 });
  }
  if (receivers.length > 5) {
    return NextResponse.json({ error: "수신 번호는 최대 5개까지 가능합니다." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "발송 내용을 입력하세요." }, { status: 400 });
  }

  const receiver = receivers
    .map((r) => String(r).replace(/\D/g, "").trim())
    .filter((r) => r.length >= 10);
  if (receiver.length === 0) {
    return NextResponse.json({ error: "유효한 수신 번호가 없습니다." }, { status: 400 });
  }

  const form = new URLSearchParams({
    key,
    user_id: userId,
    sender,
    receiver: receiver.join(","),
    msg: message,
  });
  const msgBytes = new TextEncoder().encode(message).length;
  if (msgBytes > 90) {
    form.set("msg_type", "LMS");
    form.set("title", message.slice(0, 30));
  }

  try {
    const res = await fetch(ALIGO_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: form.toString(),
    });
    const rawText = await res.text();
    let data: { result_code?: number; message?: string; msg_id?: number; success_cnt?: number; error_cnt?: number } = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[SMS] 알리고 응답이 JSON이 아님:", rawText?.slice(0, 500));
      return NextResponse.json(
        { error: "알리고 서버 응답 오류", detail: rawText?.slice(0, 300) },
        { status: 502 }
      );
    }
    const resultCode = Number(data.result_code);
    if (resultCode < 1) {
      const errMsg = data.message || "알리고 발송 실패";
      console.error("[SMS] 알리고 실패:", resultCode, errMsg, data);
      const hint =
        resultCode === -101
          ? " (API 키·발신번호 확인 및 알리고 관리자 > 연동형 API > 발송 IP 등록 필요)"
          : "";
      return NextResponse.json(
        { error: errMsg + hint, result_code: resultCode, detail: data },
        { status: 502 }
      );
    }
    return NextResponse.json({
      message: `${data.success_cnt ?? receiver.length}건 발송 요청되었습니다.`,
      msg_id: data.msg_id,
      success_cnt: data.success_cnt,
      error_cnt: data.error_cnt,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "알리고 API 요청 실패";
    console.error("[SMS] fetch 예외:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }
}
