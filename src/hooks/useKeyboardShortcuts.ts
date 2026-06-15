"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey ? (e.ctrlKey || e.metaKey) : true;
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey || true;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && !isInput) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

/** 전역 앱 단축키 */
export function useGlobalShortcuts(opts: {
  onSearchFocus: () => void;
  onToggleSidebar?: () => void;
  onNewCase?: () => void;
}) {
  const router = useRouter();

  useKeyboardShortcuts([
    { key: "/", action: opts.onSearchFocus, description: "검색 포커스" },
    { key: "g", action: () => router.push("/"), description: "대시보드로 이동" },
    { key: "c", action: () => router.push("/cases"), description: "사건 목록으로 이동" },
    { key: "a", action: () => router.push("/approval"), description: "결재함으로 이동" },
    { key: "f", action: () => router.push("/finance"), description: "회계로 이동" },
    {
      key: "n",
      action: () => opts.onNewCase?.() ?? router.push("/cases/new"),
      description: "새 사건 등록",
    },
  ]);
}
