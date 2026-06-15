import { NextRequest, NextResponse } from "next/server";
import { getAppLoginUrl } from "@/lib/appUrl";

const MARKETING = process.env.NEXT_PUBLIC_SITE_MODE === "marketing";

const MARKETING_ALLOW_PREFIXES = ["/www", "/api", "/_next"];

export function middleware(request: NextRequest) {
  if (!MARKETING) return NextResponse.next();

  const { pathname, search } = request.nextUrl;

  if (pathname.includes(".")) return NextResponse.next();

  // 홍보 사이트(lawygos)에는 DB가 없을 수 있음 → 앱 도메인으로 로그인 위임
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    const dest = getAppLoginUrl(`${pathname}${search}`);
    return NextResponse.redirect(dest);
  }

  if (MARKETING_ALLOW_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.rewrite(new URL("/www", request.url));
  }

  return NextResponse.redirect(new URL("/www", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
