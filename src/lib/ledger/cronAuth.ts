import type { NextRequest } from "next/server";

export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}
