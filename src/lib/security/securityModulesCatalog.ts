/** LSCC — 설치된 보안 모듈 카탈로그 */

export type SecurityModuleStatus = "active" | "standby" | "offline";

export type SecurityModuleInfo = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  source: string;
};

export const LAWYGO_SECURITY_MODULES: SecurityModuleInfo[] = [
  {
    id: "soc",
    name: "SOC 이벤트 관제",
    shortName: "SOC",
    description: "위협 탐지·로그인 실패·Rate limit 초과 등 security_events 테이블 자동 기록",
    source: "Enterprise_Log_Monitoring",
  },
  {
    id: "rate-limit",
    name: "Rate Limit Guard",
    shortName: "RLG",
    description: "로그인·AI·메신저·업로드 등 민감 API 25+ 엔드포인트 분당 요청 제한",
    source: "LawyGo rateLimitGuard",
  },
  {
    id: "threat-analyzer",
    name: "Threat Analyzer",
    shortName: "TA",
    description: "User-Agent·스캐너·자동화 클라이언트 Agent-less 위협 등급 산정",
    source: "Enterprise_Log_Monitoring",
  },
  {
    id: "security-headers",
    name: "Security Headers",
    shortName: "HDR",
    description: "CSP, HSTS, X-Frame-Options, Referrer-Policy 등 HTTP 보안 헤더",
    source: "next.config.ts",
  },
  {
    id: "fireauto-audit",
    name: "fireauto 8CAT 코드 감사",
    shortName: "8CAT",
    description: "시크릿·인증·Rate limit·업로드·Prompt injection 등 8카테고리 정적 점검",
    source: "fireauto security-guard",
  },
  {
    id: "session-auth",
    name: "세션·권한 분리",
    shortName: "AUTH",
    description: "HMAC 세션 쿠키, 관리자·테넌트 격리, RLS 기반 Supabase 데이터 보호",
    source: "LawyGo authSession",
  },
];

export const SECURITY_HTTP_HEADERS = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
] as const;

export function buildSecurityConsoleStatus(dbConnected: boolean) {
  return {
    active: true,
    label: dbConnected ? "보안 관제 활성" : "보안 관제 대기 (DB 미연결)",
    socLogging: dbConnected,
    modules: LAWYGO_SECURITY_MODULES.map((m) => ({
      ...m,
      status: (m.id === "soc" && !dbConnected ? "standby" : "active") as SecurityModuleStatus,
    })),
    headers: [...SECURITY_HTTP_HEADERS],
    protectedApiCount: 25,
  };
}

export function scanResultMessage(attackType: string, severity: string): string {
  if (attackType === "Safe Access" && severity === "LOW") {
    return "현재 브라우저 접속 환경이 정상으로 분류되었습니다.";
  }
  if (severity === "CRITICAL" || severity === "HIGH") {
    return "의심스러운 접속 환경이 감지되었습니다.";
  }
  return "접속 환경이 분석되었습니다.";
}
