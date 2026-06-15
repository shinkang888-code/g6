/**
 * 기일 목록 표시용 중복 제거
 * 동일 날짜 + 사건 + 기일종류는 1건만 표시
 */

export type DeadlineDedupInput = {
  id: string;
  date: string;
  caseNumber?: string;
  caseId?: string;
  type?: string;
  memo?: string;
  createdAt?: string;
};

export function normalizeDeadlineCaseNumber(value?: string): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function normalizeDeadlineType(value?: string): string {
  const t = String(value ?? "기일").trim();
  return t || "기일";
}

/** 표시 중복 판별 키: 날짜|사건|기일종류 */
export function deadlineDisplayDedupKey(item: DeadlineDedupInput): string {
  const caseKey =
    normalizeDeadlineCaseNumber(item.caseNumber) ||
    String(item.caseId ?? "").trim() ||
    item.id;
  return `${item.date}|${caseKey}|${normalizeDeadlineType(item.type)}`;
}

function isCourtSyncMemo(memo?: string): boolean {
  return Boolean(memo?.includes("[court_sync]"));
}

function deadlineKeepScore(item: DeadlineDedupInput): number {
  let score = 0;
  if (isCourtSyncMemo(item.memo)) score += 200;
  if (item.caseId) score += 50;
  if (item.createdAt) {
    const ts = Date.parse(item.createdAt);
    if (!Number.isNaN(ts)) score += ts / 1_000_000_000;
  }
  return score;
}

/**
 * 동일 키(날짜·사건·종류) 중 우선순위가 높은 1건만 유지
 * - 법원연동(court_sync) > caseId 있음 > 최신 createdAt
 */
export function dedupeDeadlinesForDisplay<T extends DeadlineDedupInput>(items: T[]): T[] {
  const bestByKey = new Map<string, T>();

  for (const item of items) {
    const key = deadlineDisplayDedupKey(item);
    const prev = bestByKey.get(key);
    if (!prev || deadlineKeepScore(item) >= deadlineKeepScore(prev)) {
      bestByKey.set(key, item);
    }
  }

  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = deadlineDisplayDedupKey(item);
    const winner = bestByKey.get(key);
    if (!winner || winner.id !== item.id) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}
