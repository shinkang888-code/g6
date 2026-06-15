"use client";

import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/lib/types";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "danger" | "warning" | "success" | "primary" | "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "default", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        {
          "bg-slate-100 text-slate-700 border-slate-200": variant === "default",
          "bg-danger-50 text-danger-700 border-danger-200": variant === "danger",
          "bg-warning-50 text-warning-700 border-warning-200": variant === "warning",
          "bg-success-50 text-success-700 border-success-200": variant === "success",
          "bg-primary-50 text-primary-700 border-primary-200": variant === "primary",
          "bg-transparent text-slate-600 border-slate-200": variant === "ghost",
          "bg-transparent text-slate-700 border-slate-300": variant === "outline",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

const statusVariantMap: Record<CaseStatus, BadgeProps["variant"]> = {
  진행중: "primary",
  종결: "default",
  사임: "ghost",
};

const statusLabelMap: Record<CaseStatus, string> = {
  진행중: "진행중",
  종결: "종결",
  사임: "사임",
};

export function StatusBadge({ status }: { status: CaseStatus | string }) {
  const s = status as CaseStatus;
  const variant = statusVariantMap[s] ?? "default";
  const label = statusLabelMap[s] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}

export function DDayBadge({ dday }: { dday: number }) {
  const label = dday < 0 ? `D+${Math.abs(dday)}` : dday === 0 ? "D-Day" : `D-${dday}`;
  const variant =
    dday <= 0 ? "danger" : dday <= 3 ? "warning" : dday <= 7 ? "primary" : "default";
  return (
    <Badge variant={variant} className={dday <= 0 ? "animate-pulse" : undefined}>
      {label}
    </Badge>
  );
}

export function ElectronicBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-1.5 py-0.5 max-lg:px-1 max-lg:py-0 shrink-0"
      title="전자사건"
    >
      <svg className="w-3 h-3 max-lg:w-2.5 max-lg:h-2.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
      </svg>
      <span className="max-lg:hidden">전자</span>
    </span>
  );
}

export function ImmutableBadge() {
  return (
    <span className="inline-flex items-center text-xs font-bold text-danger-600 bg-danger-50 border border-danger-300 rounded-full px-1.5 py-0.5">
      불변
    </span>
  );
}
