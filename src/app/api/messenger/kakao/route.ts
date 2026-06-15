/**
 * 카카오톡 발송
 * 1) 카카오 연동 서버(게이트웨이) IP + API Key가 있으면 해당 서버로 발송
 * 2) 없으면 카카오 비즈 메시지 알림톡 API 사용
 * POST body: { receivers: string[], message: string }
 * env 우선, 없으면 시스템 설정 > 메신저 연동관리(DB)에서 읽음
 */

import { NextRequest, NextResponse } from "next/server";
import { getAppSetting } from "@/lib/appSettingsServer";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { getClientIdentifier, LIMIT_MESSENGER_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

type GatewayConfig = { gatewayIp: string; gatewayApikey: string };
type BizConfig = { accessToken: string; senderKey: string; templateCode?: string };

async function getKakaoGatewayConfig(): Promise<GatewayConfig> {
  const ip = process.env.KAKAO_GATEWAY_IP ?? "";
  const apikey = process.env.KAKAO_GATEWAY_APIKEY ?? "";
  if (ip && apikey) return { gatewayIp: ip.trim(), gatewayApikey: apikey };
  const stored = await getAppSetting<{ kakaoGatewayIp?: string; kakaoGatewayApikey?: string }>("messenger_settings");
  return {
    gatewayIp: (stored?.kakaoGatewayIp ?? ip).trim(),
    gatewayApikey: stored?.kakaoGatewayApikey ?? apikey,
  };
}

async function getKakaoBizConfig(): Promise<BizConfig> {
  const accessToken = process.env.KAKAO_BIZ_ACCESS_TOKEN ?? "";
  const senderKey = process.env.KAKAO_BIZ_SENDER_KEY ?? "";
  const templateCode = process.env.KAKAO_BIZ_TEMPLATE_CODE;
  if (accessToken && senderKey) return { accessToken, senderKey, templateCode };
  const stored = await getAppSetting<{ kakaoBizAccessToken?: string; kakaoSenderKey?: string }>("messenger_settings");
  return {
    accessToken: stored?.kakaoBizAccessToken ?? accessToken,
    senderKey: stored?.kakaoSenderKey ?? senderKey,
    templateCode,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const limited = enforceRateLimit(request, `messenger:kakao:${getClientIdentifier(request)}`, LIMIT_MESSENGER_PER_MIN, {
    routePath: "/api/messenger/kakao",
    source: "api",
  });
  if (limited) return limited;

  const gateway = await getKakaoGatewayConfig();
  const useGateway = gateway.gatewayIp.length > 0 && gateway.gatewayApikey.length > 0;

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

  const phones = receivers
    .map((r) => String(r).replace(/\D/g, "").trim())
    .filter((r) => r.length >= 10)
    .map((r) => (r.startsWith("0") ? "82" + r : r.startsWith("82") ? r : "82" + r));

  if (phones.length === 0) {
    return NextResponse.json({ error: "유효한 수신 번호가 없습니다." }, { status: 400 });
  }

  const results: { phone: string; success: boolean; error?: string }[] = [];

  // 1) 카카오 연동 서버(게이트웨이) 사용
  if (useGateway) {
    const baseUrl = gateway.gatewayIp.includes("://")
      ? gateway.gatewayIp
      : `http://${gateway.gatewayIp}`;
    const sendPath = process.env.KAKAO_GATEWAY_PATH ?? "/send";
    const sendUrl = `${baseUrl.replace(/\/$/, "")}${sendPath.startsWith("/") ? sendPath : `/${sendPath}`}`;

    for (const phone of phones) {
      try {
        const res = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": gateway.gatewayApikey,
          },
          body: JSON.stringify({ receivers: [phone], message }),
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; code?: string };
        const ok = res.ok && (data.success === true || data.code === "200" || data.code === "100");
        if (ok) {
          results.push({ phone, success: true });
        } else {
          results.push({
            phone,
            success: false,
            error: (data as { error?: string }).error ?? data?.code ?? res.statusText,
          });
        }
      } catch (e) {
        results.push({
          phone,
          success: false,
          error: e instanceof Error ? e.message : "요청 실패",
        });
      }
    }

    const successCnt = results.filter((r) => r.success).length;
    if (successCnt === 0) {
      return NextResponse.json(
        { error: "카카오톡 발송에 실패했습니다.", details: results },
        { status: 502 }
      );
    }
    return NextResponse.json({
      message: `${successCnt}건 발송 요청되었습니다.`,
      success_cnt: successCnt,
      results,
    });
  }

  // 2) 카카오 비즈 메시지 API (알림톡)
  const { accessToken, senderKey, templateCode } = await getKakaoBizConfig();
  if (!accessToken || !senderKey) {
    return NextResponse.json(
      {
        error:
          "카카오톡 연동이 설정되지 않았습니다. 시스템 설정 > 메신저 연동관리에서 카카오 연동 서버(IP·API Key) 또는 카카오 비즈 액세스 토큰·발신 키를 입력하세요.",
      },
      { status: 503 }
    );
  }

  const senderNo = process.env.KAKAO_BIZ_SENDER_NO ?? "";
  if (!senderNo.trim()) {
    return NextResponse.json(
      { error: "발신 번호가 설정되지 않았습니다. KAKAO_BIZ_SENDER_NO 환경 변수 또는 카카오 비즈 계약 발신번호를 설정하세요." },
      { status: 503 }
    );
  }

  const baseUrl = process.env.KAKAO_BIZ_BASE_URL ?? "https://bizmsg-web.kakaoenterprise.com";
  const sendUrl = `${baseUrl}/v2/send/kakao`;

  for (const phone of phones) {
    try {
      const cid = process.env.KAKAO_BIZ_CID ?? `lawygo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const payload: Record<string, unknown> = {
        message_type: "AT",
        sender_key: senderKey,
        cid,
        phone_number: phone,
        sender_no: senderNo,
        message,
        fall_back_yn: false,
      };
      if (templateCode) payload.template_code = templateCode;

      const res = await fetch(sendUrl, {
        method: "POST",
        headers: {
          accept: "*/*",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string; result?: { detail_message?: string } };
      const code = data.code ?? String(res.status);

      if (!res.ok) {
        const err: string | undefined =
          typeof data.result === "string"
            ? data.result
            : (data.result as { detail_message?: string } | undefined)?.detail_message ?? res.statusText;
        results.push({ phone, success: false, error: err });
        continue;
      }
      if (code !== "200" && code !== "100") {
        results.push({ phone, success: false, error: data.result?.detail_message ?? `코드 ${code}` });
        continue;
      }
      results.push({ phone, success: true });
    } catch (e) {
      results.push({
        phone,
        success: false,
        error: e instanceof Error ? e.message : "요청 실패",
      });
    }
  }

  const successCnt = results.filter((r) => r.success).length;
  if (successCnt === 0) {
    return NextResponse.json(
      { error: "카카오톡 발송에 실패했습니다.", details: results },
      { status: 502 }
    );
  }

  return NextResponse.json({
    message: `${successCnt}건 발송 요청되었습니다.`,
    success_cnt: successCnt,
    results,
  });
}
