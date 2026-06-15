/**
 * 로이고법률백과 레이아웃 설정 검증
 * node scripts/test-encyclopedia-layout.mjs
 */

function formatLawJoCode() {
  return "ok";
}

// inline layout helpers (mirror layoutConfig.ts)
const DEFAULT_PANELS = [
  { id: "category", label: "종류·목차", visible: true, widthPercent: 14, mobileOrder: 0, scrollMode: "scroll" },
  { id: "main", label: "본문", visible: true, widthPercent: 42, mobileOrder: 1, scrollMode: "scroll" },
  { id: "ai", label: "AI·모범답안", visible: true, widthPercent: 22, mobileOrder: 2, scrollMode: "scroll" },
  { id: "fit", label: "요약·고정", visible: true, widthPercent: 12, mobileOrder: 3, scrollMode: "none" },
  { id: "ad", label: "보조", visible: true, widthPercent: 10, mobileOrder: 4, scrollMode: "none" },
];

function visiblePanelsOrdered(panels) {
  return [...panels].filter((p) => p.visible).sort((a, b) => a.mobileOrder - b.mobileOrder);
}

function reorderPanels(panels, from, to) {
  const sorted = [...panels].sort((a, b) => a.mobileOrder - b.mobileOrder);
  const [moved] = sorted.splice(from, 1);
  sorted.splice(to, 0, moved);
  const orderMap = new Map(sorted.map((p, i) => [p.id, i]));
  return panels.map((p) => ({ ...p, mobileOrder: orderMap.get(p.id) ?? p.mobileOrder }));
}

function resizePanelPair(panels, leftId, delta) {
  const visible = visiblePanelsOrdered(panels);
  const vIdx = visible.findIndex((p) => p.id === leftId);
  if (vIdx < 0 || vIdx >= visible.length - 1) return panels;
  const left = visible[vIdx];
  const right = visible[vIdx + 1];
  const newLeft = Math.max(8, Math.min(70, left.widthPercent + delta));
  const newRight = Math.max(8, Math.min(70, right.widthPercent - delta));
  return panels.map((p) => {
    if (p.id === left.id) return { ...p, widthPercent: newLeft };
    if (p.id === right.id) return { ...p, widthPercent: newRight };
    return p;
  });
}

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

assert(DEFAULT_PANELS.some((p) => p.scrollMode === "none"), "no-scroll fit/ad panels exist");
const visible = visiblePanelsOrdered(DEFAULT_PANELS);
assert(visible.length === 5, "5 visible panels");
assert(
  Math.abs(visible.reduce((a, p) => a + p.widthPercent, 0) - 100) < 0.1,
  "width sum ~100"
);

const reordered = reorderPanels(DEFAULT_PANELS, 0, 2);
assert(reordered.find((p) => p.id === "category")?.mobileOrder === 2, "reorder category");

const resized = resizePanelPair(DEFAULT_PANELS, "main", 5);
const main = resized.find((p) => p.id === "main");
const ai = resized.find((p) => p.id === "ai");
assert(main && ai && main.widthPercent === 47 && ai.widthPercent === 17, "resize pair");

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ws = readFileSync(resolve(root, "src/components/board/ai/LegalEncyclopediaWorkspace.tsx"), "utf8");
const canvas = readFileSync(resolve(root, "src/components/board/ai/encyclopedia/PatentMultiFaceCanvas.tsx"), "utf8");
const toolbar = readFileSync(resolve(root, "src/components/board/ai/encyclopedia/EncyclopediaLayoutToolbar.tsx"), "utf8");

assert(ws.includes("EncyclopediaLayoutToolbar"), "workspace has layout toolbar");
assert(ws.includes("메뉴편집") || toolbar.includes("메뉴편집"), "menu edit button");
assert(canvas.includes("overflow-hidden"), "canvas removes outer scroll");
assert(canvas.includes("PanelResizeHandle"), "resize handles");
assert(toolbar.includes("DragDropContext"), "dnd reorder");

// window manager helpers (mirror windowManager.ts)
function clampWindow(w) {
  return {
    ...w,
    x: Math.max(0, Math.min(95, w.x)),
    y: Math.max(0, Math.min(90, w.y)),
    width: Math.max(8, Math.min(100, w.width)),
    height: Math.max(12, Math.min(100, w.height)),
  };
}

function focusWindow(windows, id) {
  const maxZ = Math.max(...windows.map((w) => w.zIndex), 0) + 1;
  return windows.map((w) => (w.id === id ? clampWindow({ ...w, zIndex: maxZ, minimized: false, closed: false }) : w));
}

function toggleMaximizeWindow(windows, id) {
  const win = windows.find((w) => w.id === id);
  if (!win) return windows;
  if (win.maximized) {
    const r = win.restoreRect ?? { x: win.x, y: win.y, width: win.width, height: win.height };
    return windows.map((w) => (w.id === id ? clampWindow({ ...w, ...r, maximized: false, restoreRect: undefined }) : w));
  }
  return windows.map((w) =>
    w.id === id
      ? clampWindow({
          ...w,
          restoreRect: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          maximized: true,
        })
      : w
  );
}

const defaultWindows = [
  { id: "category", x: 0.5, y: 2, width: 13.5, height: 90, zIndex: 1, minimized: false, closed: false, maximized: false },
  { id: "main", x: 14.5, y: 2, width: 39, height: 90, zIndex: 2, minimized: false, closed: false, maximized: false },
];

let wins = defaultWindows.map((w) => ({ ...w }));
wins = focusWindow(wins, "main");
assert(wins.find((w) => w.id === "main")?.zIndex === 3, "focus raises z-index");

wins = toggleMaximizeWindow(wins, "main");
const maxed = wins.find((w) => w.id === "main");
assert(maxed?.maximized && maxed.width === 100, "maximize fills area");

wins = toggleMaximizeWindow(wins, "main");
assert(!wins.find((w) => w.id === "main")?.maximized, "restore from maximize");

function getFluidDisplayWindows(windows, panelVisible, uiEditMode) {
  if (uiEditMode) return windows;
  const visible = windows.filter((w) => panelVisible(w.id) && !w.closed && !w.minimized);
  if (visible.length === 0) return windows;
  const sorted = [...visible].sort((a, b) => a.x - b.x);
  const totalW = sorted.reduce((sum, w) => sum + w.width, 0);
  const scale = 100 / totalW;
  let cursorX = 0;
  const rectMap = new Map();
  for (const w of sorted) {
    const width = w.width * scale;
    rectMap.set(w.id, { x: cursorX, y: 0, width, height: 100 });
    cursorX += width;
  }
  return windows.map((w) => (rectMap.has(w.id) ? { ...w, ...rectMap.get(w.id) } : w));
}

const fluid = getFluidDisplayWindows(defaultWindows.map((w) => ({ ...w })), () => true, false);
const fluidVisible = fluid.filter((w) => !w.closed && !w.minimized);
const fluidEnd = fluidVisible.reduce((max, w) => Math.max(max, w.x + w.width), 0);
assert(Math.abs(fluidEnd - 100) < 0.01, "fluid windows fill 100% width");
assert(fluidVisible.every((w) => w.height === 100), "fluid windows fill 100% height");

const desktop = readFileSync(resolve(root, "src/components/board/ai/encyclopedia/EncyclopediaWindowDesktop.tsx"), "utf8");
const winFrame = readFileSync(resolve(root, "src/components/board/ai/encyclopedia/EncyclopediaWindowFrame.tsx"), "utf8");

assert(toolbar.includes("UI편집"), "UI edit button");
assert(ws.includes("loadWindowConfig"), "workspace loads window config");
assert(canvas.includes("EncyclopediaWindowDesktop"), "desktop window layout");
assert(desktop.includes("바탕화면"), "desktop icons sidebar");
assert(winFrame.includes("onOpenPopup"), "new window button in frame chrome");
assert(canvas.includes("EncyclopediaPanelPopup"), "panel popup support");
assert(!desktop.includes("980px"), "no fixed 980px desktop height");
assert(desktop.includes("getFluidDisplayWindows"), "fluid window fill");
assert(ws.includes("w-full min-w-0"), "workspace full width");

if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("로이고법률백과 레이아웃 검증 통과");
void formatLawJoCode;
