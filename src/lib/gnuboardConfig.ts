/**
 * G6(그누보드6) 연동 공통 설정
 * - NEXT_PUBLIC_GNUBOARD_API_URL: G6 서버 루트 (예: http://localhost:8000)
 */

export const GNUBOARD_PLACEHOLDER_URLS = new Set([
  "https://your-gnuboard.com/api",
  "https://your-gnuboard.com",
  "",
]);

/** LawyGo boardId → G6 bo_table 매핑 (기본 설치 보드와 맞춤) */
export const BOARD_G6_ID_MAP: Record<string, string> = {
  general: "free",
  notice: "notice",
};

export function getG6RootUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_GNUBOARD_API_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw || GNUBOARD_PLACEHOLDER_URLS.has(raw)) return "";
  return raw
    .replace(/\/api\/v1\/boards$/i, "")
    .replace(/\/api\/v1$/i, "")
    .replace(/\/api$/i, "");
}

export function getG6ApiV1Base(): string {
  const root = getG6RootUrl();
  return root ? `${root}/api/v1` : "";
}

export function resolveG6BoardId(boardId: string): string {
  return BOARD_G6_ID_MAP[boardId] ?? boardId;
}

export function isG6Configured(): boolean {
  return Boolean(getG6RootUrl());
}

/** 클라이언트용: G6 관리자 베이스 URL */
export function getG6AdminBaseUrl(apiUrl?: string): string | null {
  const raw = (apiUrl ?? process.env.NEXT_PUBLIC_GNUBOARD_API_URL ?? "").trim();
  if (!raw || GNUBOARD_PLACEHOLDER_URLS.has(raw)) return null;
  const base = raw
    .replace(/\/+$/, "")
    .replace(/\/api\/v1\/boards$/i, "")
    .replace(/\/api\/v1$/i, "")
    .replace(/\/api$/i, "");
  return base || null;
}
