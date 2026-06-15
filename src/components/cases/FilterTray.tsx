"use client";

import { useState, useEffect, useMemo } from "react";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterConfig } from "@/lib/types";
import { CASE_STATUS_FILTER_OPTIONS } from "@/lib/caseStatusFilter";

interface FilterTrayProps {
  filters: FilterConfig[];
  onFilterAdd: (filter: FilterConfig) => void;
  onFilterRemove: (field: string) => void;
  onFilterClear: () => void;
  layout?: "inline" | "chips" | "sheet";
  onClose?: () => void;
}

const LAWYER_ROLES = new Set(["변호사", "임원", "국장"]);
const EXCLUDED_ROLES = new Set(["인턴", "사무원"]);

const staticFilterOptions = [
  {
    field: "status" as const,
    label: "진행상태",
    options: [...CASE_STATUS_FILTER_OPTIONS],
  },
  {
    field: "caseType" as const,
    label: "사건종류",
    options: ["형사", "민사", "헌법", "행정", "가사"],
  },
  {
    field: "court" as const,
    label: "기관",
    options: [
      "서울고등법원",
      "서울중앙지방법원",
      "서울동부지방법원",
      "인천지방법원",
      "수원지방법원",
      "헌법재판소",
      "검찰청",
      "경찰서",
    ],
  },
] as const;

export function FilterTray({
  filters,
  onFilterAdd,
  onFilterRemove,
  onFilterClear,
  layout = "inline",
  onClose,
}: FilterTrayProps) {
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [lawyerNames, setLawyerNames] = useState<string[]>([]);
  const [lawyersLoading, setLawyersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLawyersLoading(true);
    fetch("/api/staff", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: { staff?: { name: string; role?: string }[] }) => {
        if (cancelled) return;
        const all = (d.staff ?? []).filter((s) => s.name?.trim() && !EXCLUDED_ROLES.has(s.role ?? ""));
        const lawyers = all.filter((s) => LAWYER_ROLES.has(s.role ?? ""));
        const source = lawyers.length > 0 ? lawyers : all;
        const unique = [...new Set(source.map((s) => s.name.trim()))].sort((a, b) =>
          a.localeCompare(b, "ko")
        );
        setLawyerNames(unique);
      })
      .catch(() => {
        if (!cancelled) setLawyerNames([]);
      })
      .finally(() => {
        if (!cancelled) setLawyersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(
    () => [
      ...staticFilterOptions,
      {
        field: "assignedStaff" as const,
        label: "담당 변호사",
        options: lawyerNames,
        loading: lawyersLoading,
      },
    ],
    [lawyerNames, lawyersLoading]
  );

  const pickOption = (opt: (typeof filterOptions)[number], value: string) => {
    const isActive = String(filters.find((f) => f.field === opt.field)?.value) === value;
    if (isActive) {
      onFilterRemove(opt.field);
    } else {
      onFilterAdd({
        field: opt.field,
        operator: "equals",
        value,
        label: `${opt.label}: ${value}`,
      });
    }
    setOpenPopover(null);
    onClose?.();
  };

  if (layout === "sheet") {
    return (
      <div className="space-y-4 pb-2">
        {filterOptions.map((opt) => (
          <div key={opt.field}>
            <div className="text-sm font-semibold text-slate-800 mb-2">{opt.label}</div>
            <div className="flex flex-wrap gap-2">
              {"loading" in opt && opt.loading ? (
                <span className="text-sm text-text-muted">불러오는 중…</span>
              ) : opt.options.length === 0 ? (
                <span className="text-sm text-text-muted">항목 없음</span>
              ) : (
                opt.options.map((o) => {
                  const isActive = String(filters.find((f) => f.field === opt.field)?.value) === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => pickOption(opt, o)}
                      className={cn(
                        "min-h-[44px] px-4 rounded-xl text-sm font-medium border transition-colors",
                        isActive
                          ? "bg-primary-600 text-white border-primary-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {o}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
        {filters.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onFilterClear();
              onClose?.();
            }}
            className="w-full min-h-[44px] text-sm text-danger-600 font-semibold border border-danger-200 rounded-xl"
          >
            필터 전체 초기화
          </button>
        )}
      </div>
    );
  }

  if (layout === "chips") {
    return (
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <span
            key={f.field}
            className="inline-flex items-center gap-1.5 text-sm bg-primary-100 text-primary-800 rounded-full px-3 py-1.5 font-medium"
          >
            {f.label}
            <button
              type="button"
              onClick={() => onFilterRemove(f.field)}
              className="min-w-[28px] min-h-[28px] flex items-center justify-center text-primary-500"
              aria-label="필터 제거"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        {filters.length > 0 && (
          <button
            type="button"
            onClick={onFilterClear}
            className="text-sm text-danger-600 font-medium px-2 min-h-[36px]"
          >
            전체 초기화
          </button>
        )}
      </div>
    );
  }

  const textSize = "text-[11px] lg:text-[11px]";
  const btnPad = "px-2 py-1 lg:px-2 lg:py-1 min-h-[44px] lg:min-h-0";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className={cn("flex items-center gap-0.5 text-text-muted", textSize)}>
        <SlidersHorizontal size={12} />
        <span>필터:</span>
      </div>

      {filterOptions.map((opt) => {
        const activeFilter = filters.find((f) => f.field === opt.field);
        return (
          <div key={opt.field} className="relative">
            <button
              type="button"
              onClick={() => setOpenPopover(openPopover === opt.field ? null : opt.field)}
              className={cn(
                "flex items-center gap-0.5 rounded-md border transition-all",
                textSize,
                btnPad,
                activeFilter
                  ? "bg-primary-600 text-white border-primary-600 font-medium"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {opt.label}
              {activeFilter && (
                <span className="bg-white/25 rounded px-1 text-xs">
                  {String(activeFilter.value)}
                </span>
              )}
              <ChevronDown size={10} className={cn("transition-transform", openPopover === opt.field && "rotate-180")} />
            </button>

            {openPopover === opt.field && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-40 min-w-[160px] overflow-hidden animate-fade-up">
                <div className="py-0.5 max-h-[280px] overflow-y-auto flex flex-col">
                  {"loading" in opt && opt.loading ? (
                    <div className="px-2.5 py-2 text-xs text-text-muted">불러오는 중…</div>
                  ) : opt.options.length === 0 ? (
                    <div className="px-2.5 py-2 text-xs text-text-muted">
                      {opt.field === "assignedStaff"
                        ? "등록된 변호사가 없습니다."
                        : "항목이 없습니다."}
                    </div>
                  ) : (
                    opt.options.map((o) => {
                      const isActive = String(activeFilter?.value) === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => pickOption(opt, o)}
                          className={cn(
                            "w-full text-left px-2.5 py-2.5 text-sm transition-colors shrink-0 min-h-[44px] lg:min-h-0 lg:text-xs lg:py-2",
                            isActive
                              ? "bg-primary-50 text-primary-700 font-medium"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {o}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filters.map((f) => (
        <span
          key={f.field}
          className={cn(
            "inline-flex items-center gap-0.5 bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 font-medium",
            textSize
          )}
        >
          {f.label}
          <button
            type="button"
            onClick={() => onFilterRemove(f.field)}
            className="text-primary-400 hover:text-primary-700 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
          >
            <X size={10} />
          </button>
        </span>
      ))}

      {filters.length > 0 && (
        <button
          type="button"
          onClick={onFilterClear}
          className={cn("text-danger-600 hover:text-danger-700 font-medium underline", textSize, "min-h-[44px] lg:min-h-0")}
        >
          전체 초기화
        </button>
      )}
    </div>
  );
}
