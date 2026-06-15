"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Palette, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getThemeSettings, setThemeSettings, type ThemeMode, type FontSize } from "@/lib/themeSettings";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템 따라가기" },
];

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "small", label: "작게" },
  { value: "medium", label: "보통" },
  { value: "large", label: "크게" },
];

export default function AdminSettingsThemePage() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const s = getThemeSettings();
    setMode(s.mode);
    setFontSize(s.fontSize);
    setMounted(true);
  }, []);

  const handleSave = () => {
    setThemeSettings({ mode, fontSize });
    toast.success("테마 설정이 적용되었습니다.");
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/settings"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          aria-label="설정 목록으로"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Palette size={26} className="text-primary-600" />
            테마 및 표시
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            다크모드, 폰트 크기, 색상 테마를 설정합니다. (브라우저에 저장됩니다)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">색상 테마</label>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={cn(
                  "px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
                  mode === opt.value
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">폰트 크기</label>
          <div className="flex flex-wrap gap-2">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFontSize(opt.value)}
                className={cn(
                  "px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
                  fontSize === opt.value
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-2">
          <Button onClick={handleSave} leftIcon={<Save size={16} />}>
            적용
          </Button>
        </div>
      </div>
    </div>
  );
}
