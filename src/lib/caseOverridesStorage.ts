/**
 * 사건 편집 시 덮어쓴 필드 (localStorage) - mockCases + courtOverrides 보강
 */

import type { CaseItem } from "@/lib/types";
import { loadCourtOverrides, saveCourtOverrides } from "@/lib/caseCourtOverrides";

const KEY = "lawygo_case_overrides";

export type CaseOverride = Partial<
  Pick<
    CaseItem,
    | "caseNumber"
    | "caseType"
    | "caseName"
    | "court"
    | "clientName"
    | "clientPosition"
    | "assignedStaff"
    | "assistants"
    | "nextDate"
    | "nextDateType"
    | "status"
    | "notes"
  >
>;

function loadOverrides(): Record<string, CaseOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(data: Record<string, CaseOverride>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function getCaseOverride(caseId: string): CaseOverride | undefined {
  return loadOverrides()[caseId];
}

export function saveCaseOverride(caseId: string, override: CaseOverride): void {
  const all = loadOverrides();
  const merged = { ...all[caseId], ...override };
  if (Object.keys(merged).length === 0) {
    delete all[caseId];
  } else {
    all[caseId] = merged;
  }
  saveOverrides(all);
  if (override.court !== undefined) {
    const courts = loadCourtOverrides();
    if (override.court.trim()) {
      saveCourtOverrides({ ...courts, [caseId]: override.court.trim() });
    } else {
      const next = { ...courts };
      delete next[caseId];
      saveCourtOverrides(next);
    }
  }
}

export function applyOverrides<T extends CaseItem>(caseItem: T): T {
  const overrides = getCaseOverride(caseItem.id);
  const courts = loadCourtOverrides();
  const court = courts[caseItem.id] ?? overrides?.court ?? caseItem.court;
  // 상태(status)는 항상 DB 값을 신뢰하고, 로컬 override가 있더라도 덮어쓰지 않는다.
  const { status: _ignoredStatus, ...restOverrides } = overrides ?? {};
  return { ...caseItem, ...restOverrides, court } as T;
}
