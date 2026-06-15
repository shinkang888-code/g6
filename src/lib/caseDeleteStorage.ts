/**
 * 사건 소프트 삭제 / 영구 삭제 상태 (localStorage)
 */

const KEY_SOFT = "lawygo_case_soft_deleted";
const KEY_PERMANENT = "lawygo_case_permanent_deleted";

function loadSoft(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY_SOFT);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSoft(data: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_SOFT, JSON.stringify(data));
  } catch {}
}

function loadPermanent(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY_PERMANENT);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function savePermanent(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_PERMANENT, JSON.stringify([...ids]));
  } catch {}
}

export function isSoftDeleted(caseId: string): boolean {
  return !!loadSoft()[caseId];
}

export function isPermanentDeleted(caseId: string): boolean {
  return loadPermanent().has(caseId);
}

export function getSoftDeletedAt(caseId: string): string | null {
  return loadSoft()[caseId] ?? null;
}

export function softDeleteCases(caseIds: string[]): void {
  const soft = loadSoft();
  const now = new Date().toISOString();
  caseIds.forEach((id) => (soft[id] = now));
  saveSoft(soft);
}

export function restoreCases(caseIds: string[]): void {
  const soft = loadSoft();
  caseIds.forEach((id) => delete soft[id]);
  saveSoft(soft);
}

export function permanentDeleteCases(caseIds: string[]): void {
  const soft = loadSoft();
  const perm = loadPermanent();
  caseIds.forEach((id) => {
    delete soft[id];
    perm.add(id);
  });
  saveSoft(soft);
  savePermanent(perm);
}

export function getSoftDeletedIds(): string[] {
  return Object.keys(loadSoft());
}

export function getPermanentDeletedIds(): Set<string> {
  return loadPermanent();
}
