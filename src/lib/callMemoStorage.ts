/**
 * 콜센터 전화 메모 (회계/상담관리용)
 * localStorage: lawygo_call_memos, lawygo_call_memo_templates
 */

export interface CallMemoItem {
  id: string;
  title: string;
  callerName: string;
  phone: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CallMemoTemplate {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const MEMOS_KEY = "lawygo_call_memos";
const TEMPLATES_KEY = "lawygo_call_memo_templates";

const DEFAULT_TEMPLATES: CallMemoTemplate[] = [
  { id: "t1", title: "일반 문의", content: "전화 문의 접수\n\n발신: \n연락처: \n내용: \n\n후속 조치: ", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "t2", title: "사건 관련 연락", content: "사건 관련 전화 접수\n\n사건번호: \n발신: \n연락처: \n내용: \n\n담당자 전달 여부: ", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "t3", title: "상담 예약 요청", content: "상담 예약 요청 접수\n\n발신: \n연락처: \n희망 일시: \n용건: \n\n예약 완료 후 회신: ", createdAt: "2026-01-01T00:00:00.000Z" },
];

function loadMemosRaw(): CallMemoItem[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(MEMOS_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMemosRaw(items: CallMemoItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MEMOS_KEY, JSON.stringify(items));
}

export function loadCallMemos(): CallMemoItem[] {
  return loadMemosRaw()
    .filter((m) => !m.deletedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** 제목·발신자·연락처·내용에서 검색 (대소문자 무시) */
export function searchCallMemos(query: string): CallMemoItem[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) return loadCallMemos();
  return loadCallMemos().filter((m) => {
    const title = (m.title ?? "").toLowerCase();
    const caller = (m.callerName ?? "").toLowerCase();
    const phone = (m.phone ?? "").toLowerCase();
    const content = (m.content ?? "").toLowerCase();
    return title.includes(q) || caller.includes(q) || phone.includes(q) || content.includes(q);
  });
}

export function getCallMemoById(id: string): CallMemoItem | undefined {
  return loadMemosRaw().find((m) => m.id === id);
}

export function saveCallMemo(item: Omit<CallMemoItem, "createdAt" | "updatedAt" | "id"> & { id?: string; createdAt?: string; updatedAt?: string }): CallMemoItem {
  const raw = loadMemosRaw();
  const now = new Date().toISOString();
  const existing = item.id ? raw.find((m) => m.id === item.id) : undefined;
  if (existing) {
    const updated: CallMemoItem = {
      ...existing,
      title: item.title,
      callerName: item.callerName,
      phone: item.phone,
      content: item.content,
      updatedAt: now,
    };
    saveMemosRaw(raw.map((m) => (m.id === item.id ? updated : m)));
    return updated;
  }
  const newItem: CallMemoItem = {
    ...item,
    id: item.id || "call-" + Date.now(),
    createdAt: item.createdAt ?? now,
    updatedAt: now,
  };
  saveMemosRaw([...raw, newItem]);
  return newItem;
}

export function softDeleteCallMemo(id: string): void {
  const raw = loadMemosRaw();
  const now = new Date().toISOString();
  saveMemosRaw(raw.map((m) => (m.id === id ? { ...m, deletedAt: now, updatedAt: now } : m)));
}

function loadTemplatesRaw(): CallMemoTemplate[] {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES;
  try {
    const s = localStorage.getItem(TEMPLATES_KEY);
    if (!s) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function saveTemplatesRaw(items: CallMemoTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(items));
}

export function loadCallMemoTemplates(): CallMemoTemplate[] {
  return loadTemplatesRaw().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveCallMemoTemplate(template: Omit<CallMemoTemplate, "id" | "createdAt">): CallMemoTemplate {
  const raw = loadTemplatesRaw();
  const now = new Date().toISOString();
  const newItem: CallMemoTemplate = {
    ...template,
    id: "ctpl-" + Date.now(),
    createdAt: now,
  };
  saveTemplatesRaw([newItem, ...raw]);
  return newItem;
}

export function updateCallMemoTemplate(
  id: string,
  patch: { title: string; content: string }
): CallMemoTemplate | null {
  const raw = loadTemplatesRaw();
  const existing = raw.find((t) => t.id === id);
  if (!existing) return null;
  const updated: CallMemoTemplate = {
    ...existing,
    title: patch.title.trim(),
    content: patch.content,
  };
  saveTemplatesRaw(raw.map((t) => (t.id === id ? updated : t)));
  return updated;
}

export function deleteCallMemoTemplate(id: string): void {
  saveTemplatesRaw(loadTemplatesRaw().filter((t) => t.id !== id));
}
