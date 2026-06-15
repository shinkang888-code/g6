"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rect" | "circle";
  style?: React.CSSProperties;
}

export function Skeleton({ className, variant = "rect", style }: SkeletonProps) {
  return (
    <div
      style={style}
      className={cn(
        "skeleton-shimmer",
        variant === "circle" && "rounded-full",
        variant === "text" && "rounded h-4",
        variant === "rect" && "rounded-md",
        className
      )}
    />
  );
}

export function CaseRowSkeleton() {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-full" style={{ width: `${60 + Math.random() * 40}%` } as React.CSSProperties} />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="col-span-4">
          <CardSkeleton lines={5} />
        </div>
      </div>
    </div>
  );
}
