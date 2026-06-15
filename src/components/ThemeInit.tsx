"use client";

import { useEffect } from "react";
import { initTheme } from "@/lib/themeSettings";

export function ThemeInit() {
  useEffect(() => {
    initTheme();
  }, []);
  return null;
}
