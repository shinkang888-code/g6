/**
 * API Rate Limiting (보안 강화)
 * 식별자(IP 등)별 요청 횟수 제한. 인메모리 슬라이딩 윈도우.
 * 프로덕션 다중 인스턴스 시 Upstash Redis 연동 권장.
 */

const WINDOW_MS = 60 * 1000; // 1분
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5분마다 만료 엔트리 정리

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * 식별자별 제한 확인. 초과 시 false, 허용 시 true.
 * @param key 식별자 (예: ip, ip+path)
 * @param limit 윈도우 내 최대 허용 횟수
 */
export function checkRateLimit(key: string, limit: number): boolean {
  ensureCleanup();
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

/**
 * 요청에서 식별자 추출 (X-Forwarded-For, X-Real-IP, fallback 'unknown')
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") ?? "unknown";
  return ip;
}

/** AI(Gemini) 엔드포인트: 분당 30회 */
export const LIMIT_AI_PER_MIN = 30;
/** 로그인/가입/비밀번호 재설정: 분당 10회 (브루트포스 방지) */
export const LIMIT_AUTH_PER_MIN = 10;
/** 엑셀 import: 분당 5회 */
export const LIMIT_IMPORT_PER_MIN = 5;
/** 메신저(SMS/카카오/텔레그램): 분당 10회 */
export const LIMIT_MESSENGER_PER_MIN = 10;
/** 데모 로그인: 분당 60회 (체험판 다수 동시 접속) */
export const LIMIT_DEMO_PER_MIN = 60;
/** 세션·상태 조회 등 읽기 전용 auth: 분당 60회 */
export const LIMIT_AUTH_READ_PER_MIN = 60;
/** PDF 구조 분석: 분당 10회 */
export const LIMIT_PDF_PER_MIN = 10;
/** 대법원/기일 동기화: 분당 5회 */
export const LIMIT_COURT_PER_MIN = 5;
/** 법원기일 일괄 동기화: 분당 30회 */
export const LIMIT_COURT_SYNC_PER_MIN = 30;
