/**
 * 로이고법률백과 — 사용자 레이아웃 저장 (localStorage)
 */

export type EncyclopediaPanelId = "category" | "main" | "ai" | "ad" | "fit";

export type EncyclopediaPanelConfig = {
  id: EncyclopediaPanelId;
  label: string;
  visible: boolean;
  /** 데스크탑 가로 비율 (합계 100) */
  widthPercent: number;
  /** 모바일 탭 순서 (0 = 첫 번째) */
  mobileOrder: number;
  /** scroll | none — none이면 세로·가로 스크롤 없음 */
  scrollMode: "scroll" | "none";
};

export type EncyclopediaLayoutConfig = {
  version: 1;
  panels: EncyclopediaPanelConfig[];
};

export const LAYOUT_STORAGE_KEY = "lawygo_encyclopedia_layout_v1";

export const DEFAULT_PANELS: EncyclopediaPanelConfig[] = [
  { id: "category", label: "종류·목차", visible: true, widthPercent: 14, mobileOrder: 0, scrollMode: "scroll" },
  { id: "main", label: "본문", visible: true, widthPercent: 42, mobileOrder: 1, scrollMode: "scroll" },
  { id: "ai", label: "AI·모범답안", visible: true, widthPercent: 22, mobileOrder: 2, scrollMode: "scroll" },
  { id: "fit", label: "요약·고정", visible: true, widthPercent: 12, mobileOrder: 3, scrollMode: "none" },
  { id: "ad", label: "보조", visible: true, widthPercent: 10, mobileOrder: 4, scrollMode: "none" },
];

export function defaultLayoutConfig(): EncyclopediaLayoutConfig {
  return { version: 1, panels: DEFAULT_PANELS.map((p) => ({ ...p })) };
}

function normalizePanels(raw: EncyclopediaPanelConfig[]): EncyclopediaPanelConfig[] {
  const byId = new Map(raw.map((p) => [p.id, p]));
  const merged = DEFAULT_PANELS.map((d) => {
    const saved = byId.get(d.id);
    return saved ? { ...d, ...saved, id: d.id, label: d.label } : { ...d };
  });
  const visible = merged.filter((p) => p.visible);
  if (!visible.length) return defaultLayoutConfig().panels;
  const sum = visible.reduce((a, p) => a + p.widthPercent, 0) || 100;
  return merged.map((p) =>
    p.visible ? { ...p, widthPercent: Math.round((p.widthPercent / sum) * 1000) / 10 } : p
  );
}

export function loadLayoutConfig(): EncyclopediaLayoutConfig {
  if (typeof window === "undefined") return defaultLayoutConfig();
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return defaultLayoutConfig();
    const parsed = JSON.parse(raw) as EncyclopediaLayoutConfig;
    if (!parsed?.panels?.length) return defaultLayoutConfig();
    return { version: 1, panels: normalizePanels(parsed.panels) };
  } catch {
    return defaultLayoutConfig();
  }
}

export function saveLayoutConfig(config: EncyclopediaLayoutConfig): void {
  if (typeof window === "undefined") return;
  const normalized = { version: 1 as const, panels: normalizePanels(config.panels) };
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(normalized));
}

export function resetLayoutConfig(): EncyclopediaLayoutConfig {
  const d = defaultLayoutConfig();
  saveLayoutConfig(d);
  return d;
}

export function reorderPanels(
  panels: EncyclopediaPanelConfig[],
  fromIndex: number,
  toIndex: number
): EncyclopediaPanelConfig[] {
  const sorted = [...panels].sort((a, b) => a.mobileOrder - b.mobileOrder);
  const [moved] = sorted.splice(fromIndex, 1);
  sorted.splice(toIndex, 0, moved);
  const orderMap = new Map(sorted.map((p, i) => [p.id, i]));
  return panels.map((p) => ({ ...p, mobileOrder: orderMap.get(p.id) ?? p.mobileOrder }));
}

export function resizePanelPair(
  panels: EncyclopediaPanelConfig[],
  leftId: EncyclopediaPanelId,
  deltaPercent: number
): EncyclopediaPanelConfig[] {
  const visible = visiblePanelsOrdered(panels);
  const vIdx = visible.findIndex((p) => p.id === leftId);
  if (vIdx < 0 || vIdx >= visible.length - 1) return panels;
  const left = visible[vIdx];
  const right = visible[vIdx + 1];
  const newLeft = Math.max(8, Math.min(70, left.widthPercent + deltaPercent));
  const newRight = Math.max(8, Math.min(70, right.widthPercent - deltaPercent));
  return panels.map((p) => {
    if (p.id === left.id) return { ...p, widthPercent: newLeft };
    if (p.id === right.id) return { ...p, widthPercent: newRight };
    return p;
  });
}

export function visiblePanelsOrdered(panels: EncyclopediaPanelConfig[]): EncyclopediaPanelConfig[] {
  return [...panels].filter((p) => p.visible).sort((a, b) => a.mobileOrder - b.mobileOrder);
}

export function mobilePanelsOrdered(panels: EncyclopediaPanelConfig[]): EncyclopediaPanelConfig[] {
  return [...panels]
    .filter((p) => p.visible && p.id !== "ad")
    .sort((a, b) => a.mobileOrder - b.mobileOrder);
}
