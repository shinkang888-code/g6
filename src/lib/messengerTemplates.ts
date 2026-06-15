/**
 * 메신저 사전 발송 양식 (localStorage)
 */

const STORAGE_KEY = "lawygo_messenger_templates";

export interface MessengerTemplate {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

function loadRaw(): MessengerTemplate[] {
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

function saveRaw(items: MessengerTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function loadTemplates(): MessengerTemplate[] {
  return loadRaw().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function searchTemplates(query: string): MessengerTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return loadTemplates();
  return loadTemplates().filter(
    (t) =>
      t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)
  );
}

export function saveTemplate(template: Omit<MessengerTemplate, "id" | "createdAt">): MessengerTemplate {
  const raw = loadRaw();
  const now = new Date().toISOString();
  const newItem: MessengerTemplate = {
    ...template,
    id: "tpl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
    createdAt: now,
  };
  saveRaw([newItem, ...raw]);
  return newItem;
}

export function deleteTemplate(id: string): void {
  saveRaw(loadRaw().filter((t) => t.id !== id));
}
