"use client";

import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "light" | "dark";
  className?: string;
};

export function LandingNav({ variant = "light", className }: Props) {
  const isDark = variant === "dark";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-md",
        isDark
          ? "border-white/10 bg-[#0A1628]/80 text-white"
          : "border-slate-100/80 bg-white/90 text-slate-900",
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/landing" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              isDark ? "bg-white/10 text-sky-300" : "bg-primary-900 text-white"
            )}
          >
            <Scale size={16} />
          </span>
          <span className="text-lg">LawyGo</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#features" className={cn("transition-colors", isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900")}>
            기능
          </a>
          <a href="#product" className={cn("transition-colors", isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900")}>
            제품 미리보기
          </a>
          <a href="#trust" className={cn("transition-colors", isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900")}>
            도입 사례
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className={cn(
              "hidden text-sm font-medium sm:inline",
              isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
            )}
          >
            로그인
          </Link>
          <Link
            href="/login/signup"
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              isDark
                ? "bg-white text-[#0A1628] hover:bg-sky-50"
                : "bg-[#0A1628] text-white hover:bg-[#152238]"
            )}
          >
            무료로 시작하기
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", isDark ? "bg-[#0A1628] text-white" : "bg-white/15")}>
              <ArrowRight size={12} />
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
