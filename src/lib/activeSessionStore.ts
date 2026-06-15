/**
 * 활성 세션 추적 (인메모리)
 * — 체험판 사내관리자: 세션 Set에 누적 (중복 로그인)
 * — 그 외: 단일 세션 (신규 로그인 시 이전 세션 무효화)
 */

const MAX_CONCURRENT_SESSIONS = 64;

/** userId → active sessionId(s) */
const store = new Map<string, Set<string>>();

export function registerActiveSession(
  userId: string,
  sessionId: string,
  concurrent: boolean
): void {
  if (!userId || !sessionId) return;

  if (concurrent) {
    const set = store.get(userId) ?? new Set<string>();
    set.add(sessionId);
    while (set.size > MAX_CONCURRENT_SESSIONS) {
      const first = set.values().next().value;
      if (first) set.delete(first);
      else break;
    }
    store.set(userId, set);
    return;
  }

  store.set(userId, new Set([sessionId]));
}

export function isActiveSession(userId: string, sessionId: string | undefined): boolean {
  if (!sessionId) return true;
  const set = store.get(userId);
  if (!set) return true;
  return set.has(sessionId);
}

export function revokeActiveSession(userId: string, sessionId: string | undefined): void {
  if (!userId || !sessionId) return;
  store.get(userId)?.delete(sessionId);
}

/** 테스트·디버그용 */
export function activeSessionCount(userId: string): number {
  return store.get(userId)?.size ?? 0;
}
