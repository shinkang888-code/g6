/**
 * Enterprise_Log_Monitoring DashboardService.analyzeAndSaveLog 이식
 * HTTP Header 기반 Agent-less 위협 등급 산정
 * @see https://github.com/Yoogimin/Enterprise_Log_Monitoring
 */

import type { LogSecurityEventInput, SecurityEventStatus, SecuritySeverity } from "./securityEventTypes";

export type ThreatAnalysis = Pick<
  LogSecurityEventInput,
  "attackType" | "severityLevel" | "status"
>;

/** Enterprise 원본: Chrome UA 아님 → MEDIUM. LawyGo: 법무 SaaS에 맞게 규칙 확장 */
export function analyzeHttpThreat(userAgent: string | null | undefined): ThreatAnalysis {
  let attackType = "Safe Access";
  let severityLevel: SecuritySeverity = "LOW";
  let status: SecurityEventStatus = "MONITORED";

  const ua = userAgent?.trim() ?? "";

  if (!ua) {
    return {
      attackType: "Missing User-Agent",
      severityLevel: "HIGH",
      status: "WARNING",
    };
  }

  const lower = ua.toLowerCase();
  if (/sqlmap|nikto|nmap|masscan|dirbuster|gobuster|curl\/|wget\//i.test(ua)) {
    return {
      attackType: "Scanner Bot Detected",
      severityLevel: "HIGH",
      status: "WARNING",
    };
  }

  if (lower.includes("python-requests") || lower.includes("scrapy")) {
    return {
      attackType: "Automated Client",
      severityLevel: "MEDIUM",
      status: "WARNING",
    };
  }

  // Enterprise_Log_Monitoring 기본 규칙
  if (!ua.includes("Chrome") && !ua.includes("Firefox") && !ua.includes("Safari") && !ua.includes("Edg")) {
    attackType = "Unknown User-Agent (Suspicious)";
    severityLevel = "MEDIUM";
    status = "WARNING";
  }

  return { attackType, severityLevel, status };
}

export function analyzeRateLimitExceeded(routePath?: string): ThreatAnalysis {
  return {
    attackType: routePath ? `Rate Limit Exceeded (${routePath})` : "Rate Limit Exceeded",
    severityLevel: "HIGH",
    status: "BLOCKED",
  };
}

export function analyzeAuthFailure(reason: "invalid_credentials" | "locked" | "unapproved"): ThreatAnalysis {
  const map = {
    invalid_credentials: {
      attackType: "Auth Failed — Invalid Credentials",
      severityLevel: "MEDIUM" as SecuritySeverity,
      status: "WARNING" as SecurityEventStatus,
    },
    locked: {
      attackType: "Auth Failed — Account Locked",
      severityLevel: "HIGH" as SecuritySeverity,
      status: "WARNING" as SecurityEventStatus,
    },
    unapproved: {
      attackType: "Auth Failed — Unapproved Account",
      severityLevel: "LOW" as SecuritySeverity,
      status: "MONITORED" as SecurityEventStatus,
    },
  };
  return map[reason];
}

export function analyzeUnauthorizedAdmin(routePath?: string): ThreatAnalysis {
  return {
    attackType: routePath ? `Unauthorized Admin Access (${routePath})` : "Unauthorized Admin Access",
    severityLevel: "CRITICAL",
    status: "BLOCKED",
  };
}
