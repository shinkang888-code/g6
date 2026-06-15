/**
 * 기일(Deadline) 로컬 저장소
 * - localStorage 키: lawygo_deadlines, lawygo_deadline_form_schema
 */

import type { DeadlineItem, DeadlineFormFieldConfig } from "@/lib/types";

const STORAGE_KEY = "lawygo_deadlines";
const SCHEMA_KEY = "lawygo_deadline_form_schema";

export const DEFAULT_FORM_SCHEMA: DeadlineFormFieldConfig[] = [
  { key: "date", label: "기일일자", type: "date", required: true },
  { key: "caseNumber", label: "사건번호", type: "text", placeholder: "예: 2026노107" },
  { key: "type", label: "기일종류", type: "select", required: true, options: [
    { value: "변론기일", label: "변론기일" },
    { value: "선고기일", label: "선고기일" },
    { value: "심문기일", label: "심문기일" },
    { value: "공판기일", label: "공판기일" },
    { value: "준비기일", label: "준비기일" },
    { value: "서면제출", label: "서면제출" },
    { value: "상담", label: "상담" },
    { value: "기타", label: "기타" },
  ]},
  { key: "court", label: "법원", type: "text", placeholder: "예: 서울중앙지방법원" },
  { key: "assignedStaff", label: "담당자", type: "text" },
  { key: "memo", label: "메모", type: "textarea", placeholder: "비고" },
];

function loadRaw(): DeadlineItem[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRaw(items: DeadlineItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function loadDeadlines(): DeadlineItem[] {
  return loadRaw().filter((d) => d.status !== "deleted");
}

export function loadAllDeadlinesIncludingDeleted(): DeadlineItem[] {
  return loadRaw();
}

export function getDeadlinesForDate(date: string): DeadlineItem[] {
  return loadDeadlines().filter((d) => d.date === date);
}

export function saveDeadline(item: Omit<DeadlineItem, "createdAt" | "updatedAt" | "status">): DeadlineItem {
  const raw = loadRaw();
  const now = new Date().toISOString();
  const existing = raw.find((d) => d.id === item.id);
  if (existing) {
    const updated: DeadlineItem = {
      ...existing,
      ...item,
      updatedAt: now,
      status: "active",
      deletedAt: undefined,
    };
    const next = raw.map((d) => (d.id === item.id ? updated : d));
    saveRaw(next);
    return updated;
  }
  const newItem: DeadlineItem = {
    ...item,
    id: item.id || "dl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  saveRaw([...raw, newItem]);
  return newItem;
}

export function softDeleteDeadline(id: string): void {
  const raw = loadRaw();
  const now = new Date().toISOString();
  saveRaw(
    raw.map((d) =>
      d.id === id ? { ...d, status: "deleted" as const, deletedAt: now, updatedAt: now } : d
    )
  );
}

export function loadFormSchema(): DeadlineFormFieldConfig[] {
  if (typeof window === "undefined") return DEFAULT_FORM_SCHEMA;
  try {
    const s = localStorage.getItem(SCHEMA_KEY);
    if (!s) return DEFAULT_FORM_SCHEMA;
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FORM_SCHEMA;
  } catch {
    return DEFAULT_FORM_SCHEMA;
  }
}

export function saveFormSchema(schema: DeadlineFormFieldConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SCHEMA_KEY, JSON.stringify(schema));
}
