/**
 * 테마/표시 설정 (localStorage, 클라이언트 전용)
 */

export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "small" | "medium" | "large";

const STORAGE_KEY = "lawygo_theme_settings";

export interface ThemeSettings {
  mode: ThemeMode;
  fontSize: FontSize;
}

const defaultSettings: ThemeSettings = {
  mode: "system",
  fontSize: "medium",
};

export function getThemeSettings(): ThemeSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
    return {
      mode: parsed.mode ?? defaultSettings.mode,
      fontSize: parsed.fontSize ?? defaultSettings.fontSize,
    };
  } catch {
    return defaultSettings;
  }
}

export function setThemeSettings(settings: Partial<ThemeSettings>) {
  if (typeof window === "undefined") return;
  const current = getThemeSettings();
  const next = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applyTheme(next);
}

function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  let effective: "light" | "dark" = "light";
  if (settings.mode === "dark") effective = "dark";
  else if (settings.mode === "light") effective = "light";
  else if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) effective = "dark";
  root.classList.add(effective);
  root.setAttribute("data-font-size", settings.fontSize);
}

export function initTheme() {
  if (typeof window === "undefined") return;
  applyTheme(getThemeSettings());
}
