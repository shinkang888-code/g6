/**
 * Rate limit + Enterprise_Log_Monitoring 이벤트 기록
 */

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";
import { logSecurityEvent } from "./securityEventCollector";
import { analyzeRateLimitExceeded } from "./threatAnalyzer";

export function enforceRateLimit(
  request: Request,
  key: string,
  limit: number,
  options?: { routePath?: string; source?: "api" | "auth" | "ai" | "upload" | "admin" | "scan" }
): NextResponse | null {
  if (checkRateLimit(key, limit)) return null;

  const clientId = getClientIdentifier(request);
  const routePath = options?.routePath ?? new URL(request.url).pathname;
  const threat = analyzeRateLimitExceeded(routePath);

  void logSecurityEvent({
    ipAddress: clientId,
    userAgent: request.headers.get("user-agent"),
    attackType: threat.attackType,
    severityLevel: threat.severityLevel,
    status: threat.status,
    source: options?.source ?? "api",
    routePath,
    metadata: { rateLimitKey: key, limit },
  });

  return NextResponse.json(
    { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
    { status: 429 }
  );
}
