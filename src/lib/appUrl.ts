/**
 * 송무 앱(lawygo) 기준 URL — 홍보 사이트(lawygos)에서 로그인·데모 링크용
 */
export function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NEXT_PUBLIC_SITE_MODE === "marketing") {
    return "https://lawygo.vercel.app";
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function getAppLoginUrl(path = "/login"): string {
  return `${getAppBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
