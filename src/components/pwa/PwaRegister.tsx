"use client";

import { useEffect } from "react";

/**
 * PWA Service Worker 등록 (설치 가능 조건)
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // 등록 실패는 앱 동작에 치명적이지 않음
      });
  }, []);

  return null;
}
