"use client";

import { cn, formatAmount } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  unit?: string;
  change?: number;
  icon: React.ReactNode;
  color: "blue" | "red" | "green" | "yellow" | "purple";
  isAmount?: boolean;
  onClick?: () => void;
}

const colorMap = {
  blue: {
    bg: "bg-primary-50",
    text: "text-primary-600",
    icon: "bg-primary-100 text-primary-600",
  },
  red: {
    bg: "bg-danger-50",
    text: "text-danger-600",
    icon: "bg-danger-100 text-danger-600",
  },
  green: {
    bg: "bg-success-50",
    text: "text-success-600",
    icon: "bg-success-100 text-success-600",
  },
  yellow: {
    bg: "bg-warning-50",
    text: "text-warning-600",
    icon: "bg-warning-100 text-warning-600",
  },
  purple: {
    bg: "bg-violet-50",
    text: "text-violet-600",
    icon: "bg-violet-100 text-violet-600",
  },
};

export function StatCard({
  title,
  value,
  unit,
  change,
  icon,
  color,
  isAmount,
  onClick,
}: StatCardProps) {
  const colors = colorMap[color];
  const displayValue = isAmount && typeof value === "number" ? formatAmount(value) : value;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border border-slate-100 p-4 shadow-card",
        "transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", colors.icon)}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            change >= 0 ? "text-success-600" : "text-danger-600"
          )}>
            {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className={cn("text-2xl font-bold tabular-nums mb-0.5", colors.text)}>
        {displayValue}
        {unit && <span className="text-sm font-normal text-text-muted ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-text-muted font-medium">{title}</div>
    </div>
  );
}
