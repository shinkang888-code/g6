/**
 * G6 API JWT 토큰 발급·캐시 (서버 전용)
 * - GNUBOARD_API_USERNAME / GNUBOARD_API_PASSWORD 로 자동 발급
 * - 또는 NEXT_PUBLIC_GNUBOARD_API_KEY 정적 토큰 사용
 */

import { getG6ApiV1Base } from "./gnuboardConfig";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

async function fetchNewToken(): Promise<string> {
  const apiBase = getG6ApiV1Base();
  const username = process.env.GNUBOARD_API_USERNAME ?? "";
  const password = process.env.GNUBOARD_API_PASSWORD ?? "";
  if (!apiBase || !username || !password) return "";

  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${apiBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`G6 토큰 발급 실패 (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    access_token_expire_at?: string;
  };

  if (!json.access_token) {
    throw new Error("G6 토큰 응답에 access_token이 없습니다.");
  }

  const expiresAt = json.access_token_expire_at
    ? new Date(json.access_token_expire_at).getTime()
    : Date.now() + 25 * 60 * 1000;

  cache = { token: json.access_token, expiresAt };
  return json.access_token;
}

/** G6 API Bearer 토큰 (만료 1분 전 갱신) */
export async function getG6AccessToken(): Promise<string> {
  const staticKey = (process.env.NEXT_PUBLIC_GNUBOARD_API_KEY ?? "").trim();
  if (staticKey && staticKey !== "your-api-key-here") {
    return staticKey;
  }

  if (cache && Date.now() < cache.expiresAt - 60_000) {
    return cache.token;
  }

  return fetchNewToken();
}

export function clearG6TokenCache(): void {
  cache = null;
}
