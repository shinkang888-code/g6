/**
 * 사건 편집/등록/삭제 이력 (localStorage) — 관리번호(테넌트)별 격리
 */

import { getSessionManagementNumber } from "@/lib/caseSessionClient";

export interface CaseHistoryEntry {
  id: string;
  caseId: string;
  caseNumber: string;
  clientName: string;
  action: "등록" | "수정" | "삭제" | "소프트삭제" | "영구삭제";
  accountName: string;
  managementNumber: string;
  timestamp: string;
  details?: string;
}

const KEY_PREFIX = "lawygo_case_history";
const LEGACY_KEY = "lawygo_case_history";
const MAX_ENTRIES = 500;

function resolveManagementNumber(explicit?: string): string {
  const mn = (explicit ?? getSessionManagementNumber()).trim();
  return mn || "unknown";
}

function storageKey(managementNumber: string): string {
  return `${KEY_PREFIX}_${managementNumber}`;
}

function load(managementNumber: string): CaseHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const key = storageKey(managementNumber);
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr) && arr.length > 0) {
      return arr as CaseHistoryEntry[];
    }
    if (managementNumber !== "unknown") {
      return migrateLegacyHistory(managementNumber);
    }
    return [];
  } catch {
    return [];
  }
}

function migrateLegacyHistory(managementNumber: string): CaseHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const migrated = arr.map((e: CaseHistoryEntry) => ({
      ...e,
      managementNumber: e.managementNumber ?? managementNumber,
    }));
    save(managementNumber, migrated);
    return migrated;
  } catch {
    return [];
  }
}

function save(managementNumber: string, entries: CaseHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    const slice = entries.slice(-MAX_ENTRIES);
    localStorage.setItem(storageKey(managementNumber), JSON.stringify(slice));
  } catch {
    /* ignore */
  }
}

export function appendCaseHistory(
  entry: Omit<CaseHistoryEntry, "id" | "managementNumber">,
  managementNumber?: string
): void {
  const mn = resolveManagementNumber(managementNumber);
  const list = load(mn);
  const newEntry: CaseHistoryEntry = {
    ...entry,
    managementNumber: mn,
    id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
  save(mn, [...list, newEntry]);
}

export function getCaseHistory(managementNumber?: string): CaseHistoryEntry[] {
  const mn = resolveManagementNumber(managementNumber);
  return load(mn).reverse();
}

export function searchCaseHistory(opts: {
  caseNumber?: string;
  clientName?: string;
  managementNumber?: string;
}): CaseHistoryEntry[] {
  const mn = resolveManagementNumber(opts.managementNumber);
  const list = getCaseHistory(mn);
  if (!opts.caseNumber?.trim() && !opts.clientName?.trim()) return list;
  const num = (opts.caseNumber ?? "").trim().toLowerCase();
  const client = (opts.clientName ?? "").trim().toLowerCase();
  return list.filter((e) => {
    if (e.managementNumber && e.managementNumber !== mn) return false;
    if (num && !e.caseNumber.toLowerCase().includes(num)) return false;
    if (client && !e.clientName.toLowerCase().includes(client)) return false;
    return true;
  });
}
