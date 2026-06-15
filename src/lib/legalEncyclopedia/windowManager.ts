/**
 * 로이고법률백과 — 윈도우형 프레임 데스크톱 (localStorage)
 */

import type { EncyclopediaPanelId } from "@/lib/legalEncyclopedia/layoutConfig";

export type PanelWindowState = {
  id: EncyclopediaPanelId;
  /** windows 영역 기준 % (0–100) */
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  closed: boolean;
  maximized: boolean;
  /** maximize 전 복원용 */
  restoreRect?: { x: number; y: number; width: number; height: number };
};

export type EncyclopediaWindowConfig = {
  version: 1;
  useDesktopMode: boolean;
  windows: PanelWindowState[];
};

export const WINDOW_STORAGE_KEY = "lawygo_encyclopedia_windows_v1";

const DEFAULT_WINDOWS: PanelWindowState[] = [
  { id: "category", x: 0, y: 0, width: 14, height: 100, zIndex: 1, minimized: false, closed: false, maximized: false },
  { id: "main", x: 14, y: 0, width: 42, height: 100, zIndex: 2, minimized: false, closed: false, maximized: false },
  { id: "ai", x: 56, y: 0, width: 22, height: 100, zIndex: 3, minimized: false, closed: false, maximized: false },
  { id: "fit", x: 78, y: 0, width: 11, height: 100, zIndex: 4, minimized: false, closed: false, maximized: false },
  { id: "ad", x: 89, y: 0, width: 11, height: 100, zIndex: 5, minimized: false, closed: false, maximized: false },
];

export function defaultWindowConfig(): EncyclopediaWindowConfig {
  return {
    version: 1,
    useDesktopMode: true,
    windows: DEFAULT_WINDOWS.map((w) => ({ ...w })),
  };
}

function clampWindow(w: PanelWindowState): PanelWindowState {
  return {
    ...w,
    x: Math.max(0, Math.min(95, w.x)),
    y: Math.max(0, Math.min(90, w.y)),
    width: Math.max(8, Math.min(100, w.width)),
    height: Math.max(12, Math.min(100, w.height)),
  };
}

export function loadWindowConfig(): EncyclopediaWindowConfig {
  if (typeof window === "undefined") return defaultWindowConfig();
  try {
    const raw = localStorage.getItem(WINDOW_STORAGE_KEY);
    if (!raw) return defaultWindowConfig();
    const parsed = JSON.parse(raw) as EncyclopediaWindowConfig;
    if (!parsed?.windows?.length) return defaultWindowConfig();
    const byId = new Map(parsed.windows.map((w) => [w.id, w]));
    const windows = DEFAULT_WINDOWS.map((d) => clampWindow({ ...d, ...byId.get(d.id), id: d.id }));
    return { version: 1, useDesktopMode: parsed.useDesktopMode !== false, windows };
  } catch {
    return defaultWindowConfig();
  }
}

export function saveWindowConfig(config: EncyclopediaWindowConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    WINDOW_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      useDesktopMode: config.useDesktopMode,
      windows: config.windows.map(clampWindow),
    })
  );
}

export function resetWindowConfig(): EncyclopediaWindowConfig {
  const d = defaultWindowConfig();
  saveWindowConfig(d);
  return d;
}

export function updateWindow(
  windows: PanelWindowState[],
  id: EncyclopediaPanelId,
  patch: Partial<PanelWindowState>
): PanelWindowState[] {
  return windows.map((w) => (w.id === id ? clampWindow({ ...w, ...patch }) : w));
}

export function focusWindow(windows: PanelWindowState[], id: EncyclopediaPanelId): PanelWindowState[] {
  const maxZ = Math.max(...windows.map((w) => w.zIndex), 0) + 1;
  return updateWindow(windows, id, { zIndex: maxZ, minimized: false, closed: false });
}

export function minimizeWindow(windows: PanelWindowState[], id: EncyclopediaPanelId): PanelWindowState[] {
  return updateWindow(windows, id, { minimized: true, maximized: false });
}

export function closeWindow(windows: PanelWindowState[], id: EncyclopediaPanelId): PanelWindowState[] {
  return updateWindow(windows, id, { closed: true, minimized: false, maximized: false });
}

export function toggleMaximizeWindow(windows: PanelWindowState[], id: EncyclopediaPanelId): PanelWindowState[] {
  const win = windows.find((w) => w.id === id);
  if (!win) return windows;
  if (win.maximized) {
    const r = win.restoreRect ?? { x: win.x, y: win.y, width: win.width, height: win.height };
    return updateWindow(windows, id, { ...r, maximized: false, restoreRect: undefined, minimized: false });
  }
  return updateWindow(windows, id, {
    restoreRect: { x: win.x, y: win.y, width: win.width, height: win.height },
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    maximized: true,
    minimized: false,
  });
}

export function openWindowFromDesktop(windows: PanelWindowState[], id: EncyclopediaPanelId): PanelWindowState[] {
  return focusWindow(
    windows.map((w) => (w.id === id ? { ...w, closed: false, minimized: false } : w)),
    id
  );
}

/**
 * UI편집이 아닐 때 보이는 창을 작업 영역 가로·세로 100%에 맞게 비율 유지하며 채움
 */
export function getFluidDisplayWindows(
  windows: PanelWindowState[],
  panelVisible: (id: EncyclopediaPanelId) => boolean,
  uiEditMode: boolean
): PanelWindowState[] {
  if (uiEditMode) return windows;

  const visible = windows.filter((w) => panelVisible(w.id) && !w.closed && !w.minimized);
  if (visible.length === 0) return windows;

  const maximized = visible.find((w) => w.maximized);
  if (maximized) {
    return windows.map((w) =>
      w.id === maximized.id ? { ...w, x: 0, y: 0, width: 100, height: 100 } : w
    );
  }

  const sorted = [...visible].sort((a, b) => a.x - b.x);
  const totalW = sorted.reduce((sum, w) => sum + w.width, 0);
  if (totalW <= 0) return windows;

  const scale = 100 / totalW;
  let cursorX = 0;
  const rectMap = new Map<
    EncyclopediaPanelId,
    Pick<PanelWindowState, "x" | "y" | "width" | "height">
  >();

  for (const w of sorted) {
    const width = w.width * scale;
    rectMap.set(w.id, { x: cursorX, y: 0, width, height: 100 });
    cursorX += width;
  }

  return windows.map((w) => {
    const rect = rectMap.get(w.id);
    return rect ? { ...w, ...rect } : w;
  });
}

export const PANEL_LABELS: Record<EncyclopediaPanelId, string> = {
  category: "종류·목차",
  main: "본문",
  ai: "AI·모범답안",
  fit: "요약·고정",
  ad: "보조",
};
