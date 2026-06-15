"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  List,
  LayoutGrid,
  RefreshCw,
  Plus,
  MoreVertical,
  SlidersHorizontal,
  Pencil,
  Trash2,
  History,
  X,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterTray } from "@/components/cases/FilterTray";
import { CourtSyncBulkButton } from "@/components/cases/CourtSyncPanel";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { MobileBottomSheet } from "@/components/ui/MobileBottomSheet";
import { cn } from "@/lib/utils";
import type { FilterConfig } from "@/lib/types";

type Props = {
  totalCount: number;
  selectedCount: number;
  search: string;
  staffSearch: string;
  onSearchChange: (v: string) => void;
  onStaffSearchChange: (v: string) => void;
  onRunSearch: () => void;
  onClearSearch: () => void;
  viewMode: "table" | "card";
  onViewModeChange: (m: "table" | "card") => void;
  filters: FilterConfig[];
  onFilterAdd: (f: FilterConfig) => void;
  onFilterRemove: (field: string) => void;
  onFilterClear: () => void;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
  onBulkSyncDone: (syncedIds: string[]) => void;
  excelExportLoading: boolean;
  onExcelExport: () => void;
  excelImportLoading?: boolean;
  onExcelImport?: (file: File) => void | Promise<void>;
  caseListError: string | null;
  toolbarExpanded: boolean;
  onToolbarExpandedChange: (v: boolean) => void;
};

export function CasesMobileToolbar({
  totalCount,
  selectedCount,
  search,
  staffSearch,
  onSearchChange,
  onStaffSearchChange,
  onRunSearch,
  onClearSearch,
  viewMode,
  onViewModeChange,
  filters,
  onFilterAdd,
  onFilterRemove,
  onFilterClear,
  onRefresh,
  onEdit,
  onDelete,
  onHistory,
  onBulkSyncDone,
  excelExportLoading,
  onExcelExport,
  excelImportLoading = false,
  onExcelImport,
  caseListError,
  toolbarExpanded,
  onToolbarExpandedChange,
}: Props) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const appliedLabel =
    search.trim() || filters.length
      ? `검색·필터 ${totalCount}건`
      : `전체 ${totalCount}건`;

  return (
    <div className="lg:hidden bg-white border-b border-slate-200 shrink-0 sticky top-0 z-20">
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 leading-tight">사건 관리</h1>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {appliedLabel}
              {selectedCount > 0 && (
                <span className="text-primary-600 font-semibold ml-1">· {selectedCount}건 선택</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => onViewModeChange("card")}
                className={cn(
                  "p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center",
                  viewMode === "card" ? "bg-primary-600 text-white" : "bg-white text-slate-500"
                )}
                aria-label="카드 보기"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                className={cn(
                  "p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center",
                  viewMode === "table" ? "bg-primary-600 text-white" : "bg-white text-slate-500"
                )}
                aria-label="목록 보기"
              >
                <List size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActionSheetOpen(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-600"
              aria-label="더보기"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {caseListError && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {caseListError}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {onExcelImport ? (
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={excelImportLoading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) await onExcelImport(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[44px]"
                size="sm"
                leftIcon={
                  excelImportLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )
                }
                disabled={excelImportLoading}
                asChild
              >
                <span>{excelImportLoading ? "분석 중…" : "엑셀등록"}</span>
              </Button>
            </label>
          ) : null}
          <Link href="/cases/new" className={onExcelImport ? "flex-1" : "block w-full"}>
            <Button className="w-full min-h-[44px]" size="sm" leftIcon={<Plus size={16} />}>
              신건등록
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onRunSearch()}
            placeholder="의뢰인·담당·사건번호 검색"
            className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-600/15"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button type="button" className="flex-1 min-h-[40px]" size="sm" onClick={onRunSearch} leftIcon={<Search size={15} />}>
            검색
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[40px] min-w-[40px] px-2.5"
            onClick={() => setFilterSheetOpen(true)}
            aria-label="필터"
          >
            <SlidersHorizontal size={17} />
            {filters.length > 0 && (
              <span className="ml-0.5 text-xs font-bold text-primary-600">{filters.length}</span>
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" className="min-h-[40px] px-2.5 text-xs" onClick={onClearSearch}>
            초기화
          </Button>
        </div>

        {toolbarExpanded && filters.length > 0 && (
          <div className="space-y-2 pt-0.5">
            <FilterTray
              layout="chips"
              filters={filters}
              onFilterAdd={onFilterAdd}
              onFilterRemove={onFilterRemove}
              onFilterClear={onFilterClear}
            />
          </div>
        )}

        {filters.length > 0 && (
          <button
            type="button"
            onClick={() => onToolbarExpandedChange(!toolbarExpanded)}
            className="text-xs text-primary-600 font-medium"
          >
            {toolbarExpanded ? "적용 필터 접기 ▲" : `적용 필터 ${filters.length}개 ▼`}
          </button>
        )}
      </div>

      <MobileBottomSheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="필터">
        <FilterTray
          layout="sheet"
          filters={filters}
          onFilterAdd={onFilterAdd}
          onFilterRemove={onFilterRemove}
          onFilterClear={onFilterClear}
          onClose={() => setFilterSheetOpen(false)}
        />
      </MobileBottomSheet>

      <MobileBottomSheet open={actionSheetOpen} onClose={() => setActionSheetOpen(false)} title="작업">
        <div className="grid grid-cols-2 gap-2 pb-4">
          <Button variant="outline" className="w-full min-h-[48px]" onClick={() => { onRefresh(); setActionSheetOpen(false); }} leftIcon={<RefreshCw size={16} />}>
            새로고침
          </Button>
          <Button
            variant="outline"
            className="w-full min-h-[48px]"
            onClick={() => { onEdit(); setActionSheetOpen(false); }}
            disabled={selectedCount !== 1}
            leftIcon={<Pencil size={16} />}
          >
            사건 편집
          </Button>
          <Button
            variant="outline"
            className="w-full min-h-[48px]"
            onClick={() => { onDelete(); setActionSheetOpen(false); }}
            disabled={selectedCount === 0}
            leftIcon={<Trash2 size={16} />}
          >
            사건 삭제
          </Button>
          <Button variant="outline" className="w-full min-h-[48px] col-span-2" onClick={() => { onHistory(); setActionSheetOpen(false); }} leftIcon={<History size={16} />}>
            이력관리
          </Button>
          <div className="col-span-2 flex flex-col gap-2">
            {onExcelImport ? (
              <label className="w-full cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={excelImportLoading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) {
                      await onExcelImport(file);
                      setActionSheetOpen(false);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full min-h-[48px]"
                  leftIcon={
                    excelImportLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <FileSpreadsheet size={16} />
                    )
                  }
                  disabled={excelImportLoading}
                  asChild
                >
                  <span>{excelImportLoading ? "분석 중…" : "엑셀등록"}</span>
                </Button>
              </label>
            ) : null}
            <CourtSyncBulkButton onComplete={(ids) => { onBulkSyncDone(ids); setActionSheetOpen(false); }} />
            <div className="w-full [&_button]:w-full [&_button]:min-h-[48px] [&_button]:justify-center">
              <SearchResultExcelButton
                count={selectedCount}
                loading={excelExportLoading}
                size="sm"
                label="선택결과 엑셀다운"
                emptyMessage="엑셀로보낼 사건을 선택하세요."
                title="선택한 사건을 엑셀로 다운로드합니다"
                onExport={() => { onExcelExport(); setActionSheetOpen(false); }}
              />
            </div>
          </div>
        </div>
      </MobileBottomSheet>
    </div>
  );
}
