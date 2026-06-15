"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Download,
  LayoutGrid,
  List,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MessageSquare,
  FileIcon,
  Trash2,
  FolderPlus,
  Upload,
  FileSpreadsheet,
  Pencil,
  ExternalLink,
  GripVertical,
} from "lucide-react";
import { copyAndOpenScourtSearch } from "@/lib/scourtLinks";
import { openCaseDetailPopup } from "@/lib/caseDetailPopup";
import { openCaseMemoViewPopup } from "@/lib/caseMemoViewPopup";
import { CASE_EDITED_MESSAGE_TYPE, openCaseEditInNewTab, openCaseEditPopup } from "@/lib/caseEditPopup";
import { applyCourtSyncDeadlineMemo } from "@/lib/caseDeadlineMemo";
import { mockTimeline } from "@/lib/mockData";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportCasesSearchResult, fetchCasesByIds } from "@/lib/listExcelExports";
import { useCaseExcelImport } from "@/lib/useCaseExcelImport";
import { CaseImportPreviewModal } from "@/components/cases/CaseImportPreviewModal";
import { CaseExcelImportButton } from "@/components/cases/CaseExcelImportButton";
import { CasesMobileToolbar } from "@/components/cases/CasesMobileToolbar";
import { CasesListPagination } from "@/components/cases/CasesListPagination";
import { CasesMobileTableScroll } from "@/components/cases/CasesMobileTableScroll";
import { CasesMobileListShell } from "@/components/cases/CasesMobileListShell";
import { CasesMobileCardList } from "@/components/cases/CasesMobileCardList";
import {
  CASE_TABLE_COLUMN_KEYS,
  columnMinWidthClass,
  DESKTOP_COL_WIDTHS,
  isMobileHiddenColumn,
  isMobileHiddenColWidth,
  mobileColWidth,
  mobileColumnLabel,
  mobileVisibleCellClass,
  MOBILE_TABLE_MIN_WIDTH,
  MOBILE_TD_CLASS,
  MOBILE_TH_CLASS,
} from "@/components/cases/casesMobileTable";
import { CaseMobileDetailSheet } from "@/components/cases/CaseMobileDetailSheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useScourtSyncListener } from "@/hooks/useScourtSyncListener";
import { cn, formatDate, getDDay } from "@/lib/utils";
import type { CaseItem, FilterConfig, SortConfig, Timeline } from "@/lib/types";
import {
  getInitialMemosFromMock,
  getInitialFilesFromMock,
  courtSyncMemoId,
  getStoredCaseMemos,
  loadCaseMemos,
  loadCaseFiles,
  loadCaseFolders,
  persistCaseMemos,
  readCaseMemosForCase,
  subscribeCaseMemoChanges,
  saveCaseFiles,
  saveCaseFolders,
  type CaseFile,
  type CaseFolder,
} from "@/lib/caseScopedStorage";
import {
  fetchCaseDocuments,
  uploadCaseFile,
  createCaseFolder,
  updateCaseFileMeta,
  updateCaseFolderMeta,
  deleteCaseFileRecord,
  deleteCaseFolderRecord,
  fetchDriveStatus,
} from "@/lib/caseFileStorage";
import { StatusBadge, DDayBadge, ElectronicBadge, ImmutableBadge } from "@/components/ui/badge";
import { StaffChips } from "@/components/cases/StaffChips";
import { FilterTray } from "@/components/cases/FilterTray";
import { Button } from "@/components/ui/button";
import { CaseRowSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { PreviewButton } from "@/components/pdf/PreviewButton";
import { DocumentPreviewPanel } from "@/components/pdf/DocumentPreviewPanel";
import { openCaseFilePreview } from "@/lib/pdfPreview";

import { applyOverrides } from "@/lib/caseOverridesStorage";
import {
  getPermanentDeletedIds,
  getSoftDeletedIds,
  getSoftDeletedAt,
  softDeleteCases,
  permanentDeleteCases,
} from "@/lib/caseDeleteStorage";
import { appendCaseHistory } from "@/lib/caseHistoryStorage";
import { getSessionAccountLabel } from "@/lib/caseSessionClient";
import { History } from "lucide-react";
import { CourtSyncBulkButton, CourtSyncRowButton } from "@/components/cases/CourtSyncPanel";
import { caseStatusFilterToApiParam } from "@/lib/caseStatusFilter";

const DESKTOP_PAGE_SIZE = 20;
const MOBILE_PAGE_SIZE = 30;

type CaseListColumnKey = keyof CaseItem | "sync";

const columns: { key: CaseListColumnKey; label: string; width?: string; sortable?: boolean }[] = [
  { key: "caseNumber", label: "사건번호", width: "128px", sortable: true },
  { key: "caseType", label: "종류", width: "52px" },
  { key: "caseName", label: "사건명", sortable: true },
  { key: "court", label: "기관", width: "120px" },
  { key: "clientName", label: "의뢰인", width: "80px", sortable: true },
  { key: "clientPosition", label: "지위", width: "56px" },
  { key: "assignedStaff", label: "담당", width: "64px" },
  { key: "assistants", label: "보조", width: "88px" },
  { key: "registeredDate", label: "등록일", width: "84px" },
  { key: "createdByName", label: "등록인", width: "64px" },
  { key: "receivedDate", label: "수임일", width: "84px", sortable: true },
  { key: "nextDate", label: "다음 기일", width: "96px", sortable: true },
  { key: "status", label: "상태", width: "64px" },
];

function caseRegisteredDate(c: CaseItem): string {
  return c.registeredDate ?? c.createdAt?.slice(0, 10) ?? "";
}

function formatTableDate(iso: string | null | undefined, compact = false): string {
  if (!iso) return "-";
  const d = formatDate(iso);
  if (!compact || d.length < 10) return d;
  return d.slice(5);
}

const syncColumn = { key: "sync" as const, label: "기일연동", width: "72px" };

if (process.env.NODE_ENV === "development") {
  const order = columns.map((c) => c.key);
  const mismatch = CASE_TABLE_COLUMN_KEYS.filter((k, i) => order[i] !== k);
  if (mismatch.length > 0) {
    console.warn("[cases] columns 순서가 casesMobileTable.ts 와 다릅니다:", mismatch);
  }
}

export default function CasesPage() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(initialQ);
  const [staffSearch, setStaffSearch] = useState("");
  /** 적용된 검색어(버튼/Enter 시 반영) - 이 값으로 목록 필터링 */
  const [appliedSearch, setAppliedSearch] = useState(initialQ);
  const [appliedStaffSearch, setAppliedStaffSearch] = useState("");

  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null) {
      setSearch(q);
      setAppliedSearch(q);
    }
  }, [searchParams]);
  // 기본 필터: 처음에는 진행중 사건만 보이도록 설정
  const [filters, setFilters] = useState<FilterConfig[]>([
    {
      field: "status",
      operator: "equals",
      value: "진행중",
      label: "진행상태: 진행중",
    },
  ]);
  const [sort, setSort] = useState<SortConfig>({ field: "nextDate", direction: "asc" });
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [mobileToolbarExpanded, setMobileToolbarExpanded] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const isMobile = useIsMobile();
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const [caseList, setCaseList] = useState<CaseItem[]>([]);
  const [caseListLoading, setCaseListLoading] = useState(true);
  const [caseListError, setCaseListError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [excelExportLoading, setExcelExportLoading] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const caseImport = useCaseExcelImport(() => {
    setCurrentPage(1);
    setListRefreshKey((k) => k + 1);
  });

  const resolveSearchTerm = useCallback(
    () => search.trim() || staffSearch.trim(),
    [search, staffSearch]
  );

  const fetchCaseList = useCallback(() => {
    setCaseListLoading(true);
    setCaseListError(null);
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    params.set("page_size", String(pageSize));
    const searchTerm = appliedSearch.trim();
    if (searchTerm) params.set("q", searchTerm);
    if (appliedStaffSearch.trim()) params.set("staff_q", appliedStaffSearch.trim());
    if (sort.field === "nextDate") {
      params.set("sort_by", "next_deadline");
    }
    for (const f of filters) {
      if (f.operator !== "equals") continue;
      if (f.field === "status") {
        const statusParam = caseStatusFilterToApiParam(String(f.value));
        if (statusParam) params.set("status", statusParam);
      } else if (f.field === "caseType") {
        params.set("case_type", String(f.value));
      } else if (f.field === "court") {
        params.set("court", String(f.value));
      } else if (f.field === "assignedStaff") {
        params.set("assigned_staff", String(f.value));
      }
    }
    fetch(`/api/admin/cases?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: { data?: CaseItem[]; total?: number; error?: string }) => {
        if (json.error) {
          setCaseListError(json.error);
          setCaseList([]);
          setTotalCount(0);
        } else {
          setCaseList(Array.isArray(json.data) ? json.data : []);
          setTotalCount(typeof json.total === "number" ? json.total : (json.data?.length ?? 0));
        }
      })
      .catch(() => {
        setCaseListError("사건 목록을 불러올 수 없습니다.");
        setCaseList([]);
        setTotalCount(0);
      })
      .finally(() => setCaseListLoading(false));
  }, [currentPage, appliedSearch, appliedStaffSearch, filters, sort.field, pageSize]);

  useEffect(() => {
    fetchCaseList();
  }, [listRefreshKey, fetchCaseList]);

  useEffect(() => {
    if (isMobile) setViewMode("card");
  }, [isMobile]);

  useEffect(() => {
    const onEdited = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type !== CASE_EDITED_MESSAGE_TYPE) return;
      setListRefreshKey((k) => k + 1);
    };
    window.addEventListener("message", onEdited);
    return () => window.removeEventListener("message", onEdited);
  }, []);

  /** 사건 선택·기일연동 후 저장된 자동 기일 메모를 좌하단 메모장에 반영 */
  useEffect(() => {
    if (!selectedCase) return;
    const stored = getStoredCaseMemos(selectedCase.id);
    const autoMemo = stored.find((m) => m.id === courtSyncMemoId(selectedCase.id));
    if (!autoMemo) return;
    setCaseMemos((prev) => {
      const current = prev[selectedCase.id] ?? [];
      const idx = current.findIndex((m) => m.id === autoMemo.id);
      const next =
        idx >= 0
          ? current.map((m, i) => (i === idx ? autoMemo : m))
          : [autoMemo, ...current];
      if (idx >= 0 && current[idx].content === autoMemo.content) return prev;
      return { ...prev, [selectedCase.id]: next };
    });
  }, [selectedCase?.id, listRefreshKey]);

  // 사건별 메모/자료실 데이터 (localStorage 연동)
  const [caseMemos, setCaseMemos] = useState<Record<string, Timeline[]>>(() =>
    loadCaseMemos(getInitialMemosFromMock(mockTimeline))
  );
  const [caseFiles, setCaseFiles] = useState<Record<string, CaseFile[]>>(() =>
    loadCaseFiles(getInitialFilesFromMock(mockTimeline))
  );
  const [caseFolders, setCaseFolders] = useState<Record<string, CaseFolder[]>>(loadCaseFolders);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    if (!selectedCase?.id) return;
    let cancelled = false;
    setDocsLoading(true);
    fetchCaseDocuments(selectedCase.id)
      .then(({ files, folders }) => {
        if (cancelled) return;
        setCaseFiles((prev) => ({ ...prev, [selectedCase.id]: files }));
        setCaseFolders((prev) => ({ ...prev, [selectedCase.id]: folders }));
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("자료실을 불러오지 못했습니다. 로컬 캐시를 표시합니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCase?.id]);

  const mockMemoSeed = useMemo(() => getInitialMemosFromMock(mockTimeline), []);

  const updateMemos = useCallback(
    (caseId: string, memos: Timeline[]) => {
      persistCaseMemos(caseId, memos, mockMemoSeed);
      setCaseMemos((prev) => ({ ...prev, [caseId]: memos }));
    },
    [mockMemoSeed]
  );
  const updateFiles = (caseId: string, files: CaseFile[]) => {
    setCaseFiles((prev) => {
      const next = { ...prev, [caseId]: files };
      saveCaseFiles(next);
      return next;
    });
  };
  const updateFolders = (caseId: string, folders: CaseFolder[]) => {
    setCaseFolders((prev) => {
      const next = { ...prev, [caseId]: folders };
      saveCaseFolders(next);
      return next;
    });
  };

  const handleCourtSyncDone = useCallback(
    (caseId: string, memos?: Timeline[]) => {
      if (memos?.length) {
        updateMemos(caseId, memos);
      } else {
        const stored = readCaseMemosForCase(caseId, mockMemoSeed);
        if (stored.length) updateMemos(caseId, stored);
      }
      setListRefreshKey((k) => k + 1);
    },
    [mockMemoSeed, updateMemos]
  );

  const onScourtAssistSync = useCallback(
    (payload: { caseId?: string; ok?: boolean; error?: string; result?: { caseNumber?: string; eventsAdded?: number; eventsUpdated?: number } }) => {
      if (!payload.ok || !payload.caseId) {
        if (payload.error) toast.error(payload.error);
        return;
      }
      handleCourtSyncDone(payload.caseId);
      const cn = payload.result?.caseNumber ?? "";
      const parts = [
        payload.result?.eventsAdded ? `추가 ${payload.result.eventsAdded}` : "",
        payload.result?.eventsUpdated ? `수정 ${payload.result.eventsUpdated}` : "",
      ].filter(Boolean);
      toast.success(cn ? `${cn} — ${parts.length ? parts.join(", ") : "기일 연동 완료"}` : "기일 연동이 완료되었습니다.");
      if (selectedCase?.id === payload.caseId) {
        setMobileDetailOpen(true);
      }
    },
    [handleCourtSyncDone, selectedCase?.id]
  );

  useScourtSyncListener(onScourtAssistSync);

  const handleBulkCourtSyncDone = useCallback((syncedIds: string[]) => {
    for (const caseId of syncedIds) {
      const stored = readCaseMemosForCase(caseId, mockMemoSeed);
      if (stored.length) updateMemos(caseId, stored);
    }
    setListRefreshKey((k) => k + 1);
  }, [mockMemoSeed, updateMemos]);

  /** 상세보기 팝업 등 다른 창에서 메모 저장 시 좌하단 목록 동기화 */
  useEffect(() => {
    return subscribeCaseMemoChanges((changedCaseId) => {
      setCaseMemos((prev) => {
        const targets = changedCaseId
          ? [changedCaseId]
          : Object.keys(prev);
        let next = prev;
        for (const caseId of targets) {
          const fresh = readCaseMemosForCase(caseId, mockMemoSeed);
          if (JSON.stringify(prev[caseId]) === JSON.stringify(fresh)) continue;
          next = { ...next, [caseId]: fresh };
        }
        return next === prev ? prev : next;
      });
    });
  }, [mockMemoSeed]);

  const openMobileCaseDetail = useCallback(
    (c: CaseItem) => {
      setSelectedCase(c);
      if (isMobile) setMobileDetailOpen(true);
    },
    [isMobile]
  );

  /** 사건 선택 시 하단 메모에 최신 기일(장소 포함) 반영 */
  useEffect(() => {
    if (!selectedCase) return;
    let cancelled = false;
    applyCourtSyncDeadlineMemo(selectedCase.id, {
      caseNumber: selectedCase.caseNumber,
      clientName: selectedCase.clientName,
      court: selectedCase.court,
      nextDate: selectedCase.nextDate ?? undefined,
      nextDateType: selectedCase.nextDateType ?? undefined,
    }).then((result) => {
      if (!cancelled && result?.memos?.length) updateMemos(selectedCase.id, result.memos);
    });
    return () => {
      cancelled = true;
    };
  }, [
    selectedCase?.id,
    selectedCase?.caseNumber,
    selectedCase?.clientName,
    selectedCase?.court,
    selectedCase?.nextDate,
    selectedCase?.nextDateType,
  ]);

  const runSearch = () => {
    const term = resolveSearchTerm();
    setAppliedSearch(term);
    setAppliedStaffSearch("");
  };

  useEffect(() => {
    const term = resolveSearchTerm();
    if (term === appliedSearch.trim() && !appliedStaffSearch.trim()) return;
    const timer = window.setTimeout(() => {
      setAppliedSearch(term);
      setAppliedStaffSearch("");
      if (!term) {
        setFilters((prev) => {
          if (prev.some((f) => f.field === "status")) return prev;
          return [
            {
              field: "status",
              operator: "equals",
              value: "진행중",
              label: "진행상태: 진행중",
            },
            ...prev,
          ];
        });
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [search, staffSearch, appliedSearch, appliedStaffSearch, resolveSearchTerm]);

  const clearSearch = () => {
    setSearch("");
    setStaffSearch("");
    setAppliedSearch("");
    setAppliedStaffSearch("");
    setFilters([
      {
        field: "status",
        operator: "equals",
        value: "진행중",
        label: "진행상태: 진행중",
      },
    ]);
  };

  const filtered = useMemo(() => {
    const permDeleted = getPermanentDeletedIds();
    const withOverrides = caseList
      .filter((c) => !permDeleted.has(c.id))
      .map((c) => applyOverrides(c));
    const result = [...withOverrides];
    void listRefreshKey;

    if (sort.field !== "nextDate") {
      result.sort((a, b) => {
        const av = a[sort.field] ?? "";
        const bv = b[sort.field] ?? "";
        const cmp = String(av).localeCompare(String(bv), "ko");
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [caseList, sort, listRefreshKey]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "case-edited") setListRefreshKey((k) => k + 1);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const openEditPopup = () => {
    const ids = [...selectedRows];
    if (ids.length !== 1) {
      toast.error("편집할 사건을 1건 선택하세요.");
      return;
    }
    const w = 640;
    const h = 720;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(`/cases/${ids[0]}/edit`, "case-edit", `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
  };

  const handleCaseDelete = () => {
    const ids = [...selectedRows];
    if (ids.length === 0) {
      toast.error("삭제할 사건을 선택하세요.");
      return;
    }
    const softIds = getSoftDeletedIds();
    const selectedSoft = ids.filter((id) => softIds.includes(id));
    if (selectedSoft.length > 0) {
      if (!confirm("선택한 사건 중 이미 삭제 대기 상태인 건을 영구 삭제하시겠습니까?")) return;
      permanentDeleteCases(selectedSoft);
      selectedSoft.forEach((caseId) => {
        const c = filtered.find((x) => x.id === caseId);
        if (c) {
          appendCaseHistory({
            caseId,
            caseNumber: c.caseNumber,
            clientName: c.clientName,
            action: "영구삭제",
            accountName: getSessionAccountLabel(),
            timestamp: new Date().toISOString(),
          });
        }
      });
      toast.success("영구 삭제되었습니다.");
    } else {
      softDeleteCases(ids);
      ids.forEach((caseId) => {
        const c = filtered.find((x) => x.id === caseId);
        if (c) {
          appendCaseHistory({
            caseId,
            caseNumber: c.caseNumber,
            clientName: c.clientName,
            action: "소프트삭제",
            accountName: getSessionAccountLabel(),
            timestamp: new Date().toISOString(),
          });
        }
      });
      toast.success("삭제 대기 상태로 변경되었습니다. 다시 선택 후 삭제 버튼을 누르면 영구 삭제됩니다.");
    }
    setSelectedRows(new Set());
    setListRefreshKey((k) => k + 1);
  };

  const openHistoryPopup = () => {
    const w = 720;
    const h = 560;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open("/cases/history", "case-history", `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearch, appliedStaffSearch, filters, sort]);

  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  const toggleSort = (field: keyof CaseItem) => {
    if (field === "nextDate") {
      setSort({ field: "nextDate", direction: "asc" });
      return;
    }
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "asc" }
    );
  };

  const toggleRow = (id: string) => {
    const key = id?.trim();
    if (!key) return;
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllRows = () => {
    const pageIds = paginatedList.map((c) => c.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedRows.has(id));
    if (allSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const SortIcon = ({ field }: { field: keyof CaseItem }) => {
    if (sort.field !== field) return <ChevronsUpDown size={12} className="text-slate-300" />;
    return sort.direction === "asc"
      ? <ChevronUp size={12} className="text-primary-600" />
      : <ChevronDown size={12} className="text-primary-600" />;
  };

  const handleExport = async () => {
    const ids = [...selectedRows];
    if (ids.length === 0) {
      toast.error("엑셀로보낼 사건을 선택하세요.");
      return;
    }
    setExcelExportLoading(true);
    try {
      const fromCurrentPage = filtered.filter((c) => selectedRows.has(c.id));
      const missingIds = ids.filter((id) => !fromCurrentPage.some((c) => c.id === id));
      const fetched =
        missingIds.length > 0 ? await fetchCasesByIds(missingIds) : [];
      const byId = new Map(
        [...fromCurrentPage, ...fetched].map((c) => [c.id, c])
      );
      const rows = ids.map((id) => byId.get(id)).filter((c): c is CaseItem => Boolean(c));
      if (rows.length === 0) {
        toast.error("선택한 사건을 불러오지 못했습니다.");
        return;
      }
      exportCasesSearchResult(rows, "사건목록_선택결과");
      toast.success(`${rows.length}건을 엑셀로보냈습니다. (등록 양식과 호환)`);
    } finally {
      setExcelExportLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <CasesMobileToolbar
        totalCount={totalCount}
        selectedCount={selectedRows.size}
        search={search}
        staffSearch={staffSearch}
        onSearchChange={setSearch}
        onStaffSearchChange={setStaffSearch}
        onRunSearch={runSearch}
        onClearSearch={clearSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filters={filters}
        onFilterAdd={(f) => setFilters((prev) => [...prev.filter((p) => p.field !== f.field), f])}
        onFilterRemove={(field) => setFilters((prev) => prev.filter((f) => f.field !== field))}
        onFilterClear={() => setFilters([])}
        onRefresh={() => setListRefreshKey((k) => k + 1)}
        onEdit={openEditPopup}
        onDelete={handleCaseDelete}
        onHistory={openHistoryPopup}
        onBulkSyncDone={handleBulkCourtSyncDone}
        excelExportLoading={excelExportLoading}
        onExcelExport={handleExport}
        excelImportLoading={caseImport.previewLoading || caseImport.confirming}
        onExcelImport={caseImport.handleExcelFile}
        caseListError={caseListError}
        toolbarExpanded={mobileToolbarExpanded}
        onToolbarExpandedChange={setMobileToolbarExpanded}
      />

      {/* Desktop toolbar */}
      <div className="hidden lg:block bg-white border-b border-slate-200 px-4 py-2 shrink-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* 제목 + 건수 */}
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-base font-bold text-slate-900">사건 관리</h1>
            <span className="text-xs text-text-muted">
              {appliedSearch.trim() ? "검색 " : filters.length ? "필터 " : "전체 "}
              <span className="text-primary-600 font-semibold">{totalCount}</span>
              건
              {selectedRows.size > 0 && (
                <span className="ml-1 text-primary-600 font-semibold">· {selectedRows.size}건 선택</span>
              )}
            </span>
          </div>
          {caseListError && (
            <div className="w-full text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {caseListError}
            </div>
          )}

          {/* 검색: 의뢰인·담당·보조 이름 또는 사건번호 */}
          <div className="relative flex-1 min-w-[180px] max-w-[320px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="의뢰인, 담당, 보조 이름 또는 사건번호"
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-600/20 focus:bg-white"
            />
          </div>
          {/* 검색 / 초기화 */}
          <Button type="button" size="xs" onClick={runSearch} leftIcon={<Search size={12} />}>
            검색
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={clearSearch}>
            초기화
          </Button>
          {/* 보기 전환: 테이블/카드 */}
          <div className="flex items-center border border-slate-200 rounded-md overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "px-2 py-1.5 transition-colors",
                viewMode === "table" ? "bg-primary-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
              )}
              title="목록 보기"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={cn(
                "px-2 py-1.5 transition-colors",
                viewMode === "card" ? "bg-primary-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
              )}
              title="카드 보기"
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* 필터: 진행상태, 사건종류, 담당 변호사, 법원 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterTray
              filters={filters}
              onFilterAdd={(f) => setFilters((prev) => [...prev.filter((p) => p.field !== f.field), f])}
              onFilterRemove={(field) => setFilters((prev) => prev.filter((f) => f.field !== field))}
              onFilterClear={() => setFilters([])}
            />
          </div>

          {/* 우측: 다운로드, 새로고침, 사건 편집/삭제/이력, 사건 등록 */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {selectedRows.size > 0 && (
              <Button variant="secondary" size="xs">
                일괄 처리 ({selectedRows.size})
              </Button>
            )}
            <CourtSyncBulkButton onComplete={handleBulkCourtSyncDone} />
            <SearchResultExcelButton
              size="xs"
              count={selectedRows.size}
              loading={excelExportLoading}
              onExport={handleExport}
              label="선택결과 엑셀다운"
              emptyMessage="엑셀로보낼 사건을 선택하세요."
              title="좌측 체크박스로 선택한 사건을 엑셀로 다운로드합니다"
            />
            <Button variant="outline" size="xs" leftIcon={<RefreshCw size={12} />} onClick={() => setListRefreshKey((k) => k + 1)}>
              새로고침
            </Button>
            <Button
              variant="outline"
              size="xs"
              leftIcon={<Pencil size={12} />}
              onClick={openEditPopup}
              disabled={selectedRows.size !== 1}
            >
              사건 편집
            </Button>
            <Button
              variant="outline"
              size="xs"
              leftIcon={<Trash2 size={12} />}
              onClick={handleCaseDelete}
              disabled={selectedRows.size === 0}
            >
              사건 삭제
            </Button>
            <Button variant="outline" size="xs" leftIcon={<History size={12} />} onClick={openHistoryPopup}>
              이력관리
            </Button>
            <CaseExcelImportButton
              onFileSelect={caseImport.handleExcelFile}
              loading={caseImport.previewLoading || caseImport.confirming}
            />
            <Link href="/cases/new">
              <Button size="xs" leftIcon={<Plus size={12} />}>
                사건 등록
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content: 사건 목록 — 모바일 세로 스크롤 극대화, 페이지네이션 하단 고정 */}
      <CasesMobileListShell
        listScrollRef={listScrollRef}
        footer={
          <CasesListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            isMobile={isMobile}
            onPageChange={setCurrentPage}
          />
        }
      >
        {viewMode === "table" ? (
          <CasesMobileTableScroll className="max-lg:h-full">
          <table
            className={cn(
              "cases-table-mobile w-full border-collapse",
              "lg:table-fixed lg:min-w-[1360px]",
              "max-lg:w-max max-lg:text-[11px]"
            )}
            style={
              {
                "--cases-mobile-table-min-width": `${MOBILE_TABLE_MIN_WIDTH}px`,
              } as Record<string, string>
            }
          >
            {/* 데스크톱: 열 고정폭 → 좁은 화면에서 횡스크롤 */}
            <colgroup className="max-lg:hidden">
              <col style={{ width: DESKTOP_COL_WIDTHS.checkbox }} />
              {columns.map((col) => (
                <col
                  key={col.key}
                  style={{
                    width: col.width ?? DESKTOP_COL_WIDTHS[col.key] ?? DESKTOP_COL_WIDTHS.caseName,
                  }}
                />
              ))}
              <col style={{ width: DESKTOP_COL_WIDTHS.sync }} />
            </colgroup>
            {/* 모바일: 전체 열 수와 1:1 매칭 (숨김 열 width 0) */}
            <colgroup className="lg:hidden">
              <col
                style={{ width: mobileColWidth("checkbox") }}
                data-mobile-hide={isMobileHiddenColWidth("checkbox") ? "1" : "0"}
              />
              {columns.map((col) => (
                <col
                  key={col.key}
                  style={{ width: mobileColWidth(col.key) }}
                  data-mobile-hide={isMobileHiddenColWidth(col.key) ? "1" : "0"}
                />
              ))}
              <col
                style={{ width: mobileColWidth("sync") }}
                data-mobile-hide={isMobileHiddenColWidth("sync") ? "1" : "0"}
              />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th
                  className={cn(
                    "w-10 px-3 py-3 text-left",
                    MOBILE_TH_CLASS,
                    mobileVisibleCellClass("checkbox")
                  )}
                >
                  <input
                    type="checkbox"
                    checked={
                      paginatedList.length > 0 &&
                      paginatedList.every((c) => selectedRows.has(c.id))
                    }
                    onChange={toggleAllRows}
                    className="rounded border-slate-300 text-primary-600 max-lg:scale-90"
                  />
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide",
                      MOBILE_TH_CLASS,
                      columnMinWidthClass(col.key),
                      mobileVisibleCellClass(col.key),
                      isMobileHiddenColumn(col.key) && "max-lg:hidden",
                      col.key === "caseName" && "max-lg:normal-case",
                      col.sortable && "cursor-pointer hover:text-slate-800 select-none"
                    )}
                    onClick={
                      col.sortable && col.key !== "sync"
                        ? () => toggleSort(col.key as keyof CaseItem)
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-1 max-lg:leading-tight max-lg:truncate">
                      <span className="lg:hidden">{mobileColumnLabel(col.key, col.label)}</span>
                      <span className="hidden lg:inline">{col.label}</span>
                      {col.sortable && col.key !== "sync" && (
                        <SortIcon field={col.key as keyof CaseItem} />
                      )}
                    </div>
                  </th>
                ))}
                <th
                  className={cn(
                    "text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide",
                    MOBILE_TH_CLASS,
                    columnMinWidthClass("sync"),
                    isMobileHiddenColumn("sync") && "max-lg:hidden"
                  )}
                >
                  {syncColumn.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {caseListLoading
                ? Array.from({ length: 8 }).map((_, i) => <CaseRowSkeleton key={i} />)
                : paginatedList.map((c) => {
                    const dday = c.nextDate ? getDDay(c.nextDate) : null;
                    const isSelected = selectedRows.has(c.id);
                    const isUrgent = dday !== null && dday <= 0;
                    const isSoftDeleted = !!getSoftDeletedAt(c.id);

                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "border-b border-slate-100 text-sm transition-all duration-150 group",
                          isSelected ? "bg-primary-50" : isUrgent ? "bg-danger-50/40 hover:bg-danger-50/70" : "hover:bg-primary-50/40",
                          isSoftDeleted && "opacity-70 bg-slate-50",
                          "cursor-pointer"
                        )}
                        onClick={() => openMobileCaseDetail(c)}
                      >
                        <td
                          className={cn(
                            "px-3 py-2.5 cursor-pointer",
                            MOBILE_TD_CLASS,
                            mobileVisibleCellClass("checkbox")
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(c.id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            tabIndex={-1}
                            aria-hidden
                            className="rounded border-slate-300 text-primary-600 max-lg:scale-90 pointer-events-none"
                          />
                        </td>

                        {/* 사건번호 (모바일: 종류 뱃지 포함) */}
                        <td className={cn("px-3 py-2.5", MOBILE_TD_CLASS, mobileVisibleCellClass("caseNumber"))}>
                          <div className="flex items-center gap-1 min-w-0 max-lg:gap-0.5">
                            <div className="flex items-center gap-0.5 min-w-0 flex-1">
                              {isSoftDeleted && (
                                <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-1 py-0 max-lg:hidden">
                                  삭제대기
                                </span>
                              )}
                              {c.isElectronic && <ElectronicBadge />}
                              {c.isImmutable && <span className="max-lg:hidden"><ImmutableBadge /></span>}
                              <button
                                type="button"
                                className="text-primary-600 font-semibold hover:underline text-left max-lg:text-[10px] max-lg:leading-tight max-lg:truncate max-lg:max-w-full"
                                title={c.caseNumber}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCaseDetailPopup(c.id, c.caseNumber);
                                }}
                              >
                                {c.caseNumber}
                              </button>
                            </div>
                            <span className="hidden max-lg:inline text-[9px] leading-none text-slate-500 bg-slate-100 rounded px-1 py-0.5 shrink-0">
                              {c.caseType}
                            </span>
                          </div>
                        </td>

                        {/* 종류 (데스크톱만) */}
                        <td className={cn("px-3 py-2.5", MOBILE_TD_CLASS, "max-lg:hidden")}>
                          <span className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                            {c.caseType}
                          </span>
                        </td>

                        {/* 사건명: 행 선택 시 하단 메모·자료실 표시 */}
                        <td
                          className={cn(
                            "px-3 py-2.5 lg:max-w-0",
                            MOBILE_TD_CLASS,
                            mobileVisibleCellClass("caseName"),
                            "max-lg:whitespace-normal"
                          )}
                        >
                          {c.caseName ? (
                            <span
                              className="cases-mobile-case-name font-medium text-slate-800 block lg:truncate max-lg:text-[11px]"
                              title={c.caseName}
                            >
                              {c.caseName}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* 기관 */}
                        <td
                          className={cn(
                            "px-3 py-2.5 text-xs text-slate-700 truncate lg:max-w-0",
                            MOBILE_TD_CLASS,
                            mobileVisibleCellClass("court")
                          )}
                          title={c.court || undefined}
                        >
                          <span className="max-lg:block max-lg:truncate max-lg:text-[10px]">
                            {c.court || "-"}
                          </span>
                        </td>

                        {/* 의뢰인: 클릭 시 사건 등록(수정) 새 탭 */}
                        <td
                          className={cn("px-3 py-2.5", MOBILE_TD_CLASS, mobileVisibleCellClass("clientName"))}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.clientName ? (
                            <button
                              type="button"
                              className="font-medium text-primary-600 hover:underline text-left max-lg:block max-lg:w-full max-lg:truncate max-lg:text-[11px]"
                              title={c.clientName}
                              onClick={() => openCaseEditInNewTab(c.id, { clientName: c.clientName })}
                            >
                              {c.clientName}
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* 지위 (데스크톱만) */}
                        <td className={cn("px-3 py-2.5", MOBILE_TD_CLASS, "max-lg:hidden")}>
                          <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 max-lg:px-1 max-lg:py-0 max-lg:text-[10px] max-lg:leading-tight inline-block max-lg:truncate max-lg:max-w-full">
                            {c.clientPosition}
                          </span>
                        </td>

                        {/* 담당 */}
                        <td
                          className={cn(
                            "px-3 py-2.5 text-sm text-slate-700",
                            MOBILE_TD_CLASS,
                            mobileVisibleCellClass("assignedStaff")
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.assignedStaff ? (
                            <button
                              type="button"
                              className="text-primary-600 hover:underline text-left max-lg:block max-lg:w-full max-lg:truncate max-lg:text-[10px]"
                              title={c.assignedStaff}
                              onClick={() => openCaseEditPopup(c.id, c.caseNumber)}
                            >
                              {c.assignedStaff}
                            </button>
                          ) : (
                            <span className="text-slate-400 max-lg:text-[10px]">-</span>
                          )}
                        </td>

                        {/* 보조 (데스크톱만) */}
                        <td className={cn("px-3 py-2.5", MOBILE_TD_CLASS, "max-lg:hidden")}>
                          <StaffChips staffStr={c.assistants} max={2} />
                        </td>

                        {/* 등록일 */}
                        <td
                          className={cn(
                            "px-3 py-2.5 text-xs text-slate-600 tabular-nums whitespace-nowrap",
                            MOBILE_TD_CLASS,
                            "max-lg:hidden"
                          )}
                          title={caseRegisteredDate(c)}
                        >
                          {formatTableDate(caseRegisteredDate(c))}
                        </td>

                        {/* 등록인 */}
                        <td
                          className={cn(
                            "px-3 py-2.5 text-xs text-slate-700 truncate lg:max-w-0",
                            MOBILE_TD_CLASS,
                            "max-lg:hidden"
                          )}
                          title={c.createdByName || undefined}
                        >
                          {c.createdByName?.trim() ? c.createdByName : "-"}
                        </td>

                        {/* 수임일 */}
                        <td
                          className={cn(
                            "px-3 py-2.5 text-xs text-slate-600 tabular-nums whitespace-nowrap",
                            MOBILE_TD_CLASS,
                            mobileVisibleCellClass("receivedDate")
                          )}
                          title={c.receivedDate || undefined}
                        >
                          {formatTableDate(c.receivedDate, true)}
                        </td>

                        {/* 기일 */}
                        <td
                          className={cn("px-3 py-2.5", MOBILE_TD_CLASS, mobileVisibleCellClass("nextDate"))}
                        >
                          {c.nextDate ? (
                            <div className="max-lg:truncate" title={`${formatTableDate(c.nextDate, true)} ${c.nextDateType ?? ""}`.trim()}>
                              <div
                                className={cn(
                                  "font-medium tabular-nums max-lg:text-[10px]",
                                  dday !== null && dday <= 0 ? "text-danger-600" : "text-slate-800"
                                )}
                              >
                                {formatTableDate(c.nextDate, true)}
                              </div>
                              <div className="text-xs text-text-muted max-lg:hidden">{c.nextDateType}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 max-lg:text-[10px]">미정</span>
                          )}
                        </td>

                        {/* 상태 */}
                        <td className={cn("px-3 py-2.5", MOBILE_TD_CLASS, mobileVisibleCellClass("status"))}>
                          <StatusBadge status={c.status} />
                        </td>

                        {/* 기일연동 */}
                        <td
                          className={cn("px-3 py-2.5", MOBILE_TD_CLASS, "max-lg:hidden")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CourtSyncRowButton
                            caseItem={c}
                            onDone={handleCourtSyncDone}
                          />
                        </td>
                      </motion.tr>
                    );
                  })}
            </tbody>
          </table>
          </CasesMobileTableScroll>
        ) : (
          <>
            {caseListLoading ? (
              <div className="lg:hidden px-3 py-2 space-y-2" aria-busy="true" aria-label="사건 목록 불러오는 중">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-[72px] rounded-lg skeleton-shimmer" />
                ))}
              </div>
            ) : (
              <CasesMobileCardList
                cases={paginatedList}
                selectedCaseId={selectedCase?.id}
                formatTableDate={formatTableDate}
                onSelect={openMobileCaseDetail}
              />
            )}
            <div className="hidden lg:block p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {paginatedList.map((c) => {
              const dday = c.nextDate ? getDDay(c.nextDate) : null;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => openMobileCaseDetail(c)}
                  className={cn(
                    "bg-white rounded-xl border p-4 cursor-pointer shadow-card",
                    "transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5",
                    "max-lg:p-4 max-lg:min-h-[88px]",
                    selectedCase?.id === c.id && "ring-2 ring-primary-400 border-primary-300",
                    dday !== null && dday <= 0 ? "border-danger-200" : "border-slate-100"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {c.isElectronic && <ElectronicBadge />}
                        <button
                          type="button"
                          className="text-primary-600 font-bold text-sm hover:underline text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCaseDetailPopup(c.id, c.caseNumber);
                          }}
                        >
                          {c.caseNumber}
                        </button>
                      </div>
                      {c.caseName ? (
                        <div className="font-semibold text-slate-800">{c.caseName}</div>
                      ) : (
                        <div className="font-semibold text-slate-400">-</div>
                      )}
                      <div className="text-xs text-text-muted mt-0.5">
                        {c.clientName ? (
                          <button
                            type="button"
                            className="text-primary-600 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCaseEditInNewTab(c.id, { clientName: c.clientName });
                            }}
                          >
                            {c.clientName}
                          </button>
                        ) : (
                          "-"
                        )}
                        {" · "}
                        {c.court}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 tabular-nums flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>등록 {formatTableDate(caseRegisteredDate(c))}</span>
                        {c.createdByName?.trim() ? <span>{c.createdByName}</span> : null}
                        <span>수임 {formatTableDate(c.receivedDate)}</span>
                      </div>
                    </div>
                    {dday !== null && <DDayBadge dday={dday} />}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <StatusBadge status={c.status} />
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <CourtSyncRowButton caseItem={c} onDone={handleCourtSyncDone} />
                      <div className="text-xs text-text-muted">
                        {c.assignedStaff ? (
                          <button
                            type="button"
                            className="text-primary-600 hover:underline text-left"
                            onClick={() => openCaseEditPopup(c.id, c.caseNumber)}
                          >
                            {c.assignedStaff}
                          </button>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          </>
        )}

        {filtered.length === 0 && !caseListLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {caseList.length === 0 ? (
              <>
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4">
                  <FileSpreadsheet size={28} className="text-primary-600" />
                </div>
                <div className="text-lg font-semibold text-slate-700">등록된 사건이 없습니다</div>
                <p className="text-sm text-text-muted mt-1 max-w-sm">엑셀 파일(.xlsx, .xls)을 등록하면 사건 목록에 반영됩니다.</p>
                <div className="mt-4">
                  <CaseExcelImportButton
                    onFileSelect={caseImport.handleExcelFile}
                    loading={caseImport.previewLoading || caseImport.confirming}
                    size="sm"
                    variant="primary"
                    label="엑셀으로 사건 등록"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Search size={24} className="text-slate-400" />
                </div>
                <div className="text-lg font-semibold text-slate-600">검색 결과가 없습니다</div>
                <div className="text-sm text-text-muted mt-1">다른 검색어나 필터를 시도해보세요</div>
              </>
            )}
          </div>
        )}
      </CasesMobileListShell>

      <CaseMobileDetailSheet
        open={mobileDetailOpen}
        onClose={() => setMobileDetailOpen(false)}
        caseItem={selectedCase}
        onCourtSyncDone={handleCourtSyncDone}
        deadlinesRefreshKey={listRefreshKey}
        memoPanel={
          <CaseMemoPanel
            variant="mobile"
            caseItem={selectedCase}
            memos={selectedCase ? caseMemos[selectedCase.id] ?? [] : []}
            onMemosChange={selectedCase ? (memos) => updateMemos(selectedCase.id, memos) : undefined}
          />
        }
        docsPanel={
          <CaseDocumentsPanel
            variant="mobile"
            caseItem={selectedCase}
            files={selectedCase ? caseFiles[selectedCase.id] ?? [] : []}
            folders={selectedCase ? caseFolders[selectedCase.id] ?? [] : []}
            loading={docsLoading}
            onFilesChange={selectedCase ? (files) => updateFiles(selectedCase.id, files) : undefined}
            onFoldersChange={selectedCase ? (folders) => updateFolders(selectedCase.id, folders) : undefined}
          />
        }
      />

      {/* 데스크톱: 좌하단 메모장, 우하단 자료실 */}
      <div className="hidden lg:grid border-t border-slate-200 bg-slate-50 px-4 py-3 grid-cols-2 gap-3 min-h-[140px] max-h-[320px] shrink overflow-hidden">
        <CaseMemoPanel
          caseItem={selectedCase}
          memos={selectedCase ? caseMemos[selectedCase.id] ?? [] : []}
          onMemosChange={selectedCase ? (memos) => updateMemos(selectedCase.id, memos) : undefined}
        />
        <CaseDocumentsPanel
          caseItem={selectedCase}
          files={selectedCase ? caseFiles[selectedCase.id] ?? [] : []}
          folders={selectedCase ? caseFolders[selectedCase.id] ?? [] : []}
          loading={docsLoading}
          onFilesChange={selectedCase ? (files) => updateFiles(selectedCase.id, files) : undefined}
          onFoldersChange={selectedCase ? (folders) => updateFolders(selectedCase.id, folders) : undefined}
        />
      </div>

      <CaseImportPreviewModal
        open={caseImport.previewOpen}
        loading={caseImport.previewLoading}
        confirming={caseImport.confirming}
        data={caseImport.previewData}
        fileName={caseImport.fileName}
        onClose={caseImport.closePreview}
        onConfirm={caseImport.confirmImport}
      />
    </div>
  );
}

function CaseMemoPanel({
  caseItem,
  memos,
  onMemosChange,
  variant = "default",
}: {
  caseItem: CaseItem | null;
  memos: Timeline[];
  onMemosChange?: (memos: Timeline[]) => void;
  variant?: "default" | "mobile";
}) {
  const isMobileLayout = variant === "mobile";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [text, setText] = useState("");

  useEffect(() => {
    setSelectedId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setTime("10:00");
    setText("");
  }, [caseItem?.id]);

  const handleSelect = (item: Timeline) => {
    setSelectedId(item.id);
    setDate(item.date.slice(0, 10));
    setTime(new Date(item.date).toISOString().slice(11, 16));
    setText(item.content);
  };

  const handleReset = () => {
    setSelectedId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setTime("10:00");
    setText("");
  };

  const handleSave = () => {
    if (!text.trim() || !caseItem || !onMemosChange) return;
    const iso = `${date}T${time}:00Z`;
    if (selectedId) {
      const next = memos.map((m) =>
        m.id === selectedId ? { ...m, content: text, date: iso } : m
      );
      onMemosChange(next);
      toast.success("메모가 수정되었습니다.");
    } else {
      const newItem: Timeline = {
        id: `memo-${Date.now()}`,
        caseId: caseItem.id,
        type: "memo",
        title: "상담/업무 메모",
        content: text,
        authorId: "me",
        authorName: "담당자",
        date: iso,
      };
      onMemosChange([newItem, ...memos]);
      toast.success("메모가 등록되었습니다.");
    }
    handleReset();
  };

  const handleDelete = () => {
    if (!selectedId || !onMemosChange) return;
    if (!confirm("선택한 메모를 삭제하시겠습니까?")) return;
    onMemosChange(memos.filter((m) => m.id !== selectedId));
    toast.success("메모가 삭제되었습니다.");
    handleReset();
  };

  if (!caseItem) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card flex flex-col min-h-0 flex-1 items-center justify-center text-slate-500 overflow-auto">
        <MessageSquare size={32} className="mb-2 text-slate-300" />
        <p className="text-sm font-medium">좌하단 메모장</p>
        <p className="text-xs text-text-muted mt-0.5">사건을 선택하면 해당 사건의 메모가 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200 shadow-card flex flex-col overflow-hidden",
        isMobileLayout ? "min-h-[220px]" : "min-h-0 flex-1"
      )}
    >
      {!isMobileLayout && (
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 flex-wrap">
            <MessageSquare size={16} className="text-primary-600" />
            사건 메모 · {caseItem.caseNumber}
            <button
              type="button"
              onClick={() => openCaseDetailPopup(caseItem.id, caseItem.caseNumber)}
              className="text-xs font-normal text-primary-600 hover:underline"
            >
              상세 보기
            </button>
            <button
              type="button"
              onClick={async () => {
                const { copied } = await copyAndOpenScourtSearch(
                  caseItem.caseNumber,
                  caseItem.clientName,
                  caseItem.court,
                  caseItem.id
                );
                toast.success(
                  "조회 보조창이 열렸습니다. [나의 사건검색에서 연동] 후 [기일 연동]을 눌러주세요."
                );
              }}
              className="text-xs font-normal text-slate-500 hover:text-primary-600 inline-flex items-center gap-1"
              title="법원·사건번호·의뢰인을 조회 보조창에 채우고 대법원 나의사건검색을 엽니다"
            >
              <ExternalLink size={11} />
              법원에서 조회
            </button>
          </div>
        </div>
      )}
      <div className={cn("flex min-h-0", isMobileLayout ? "flex-col flex-1" : "flex-1")}>
        <div
          className={cn(
            "border-slate-100 overflow-y-auto",
            isMobileLayout ? "max-h-[140px] border-b" : "w-1/2 border-r flex-1"
          )}
        >
          <p className="text-[10px] text-text-muted px-3 py-1.5 border-b border-slate-100 bg-slate-50/80">
            행 클릭: 전체 보기 · 연필: 우측 편집
          </p>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left w-28">일시</th>
                <th className="px-3 py-2 text-left">내용</th>
              </tr>
            </thead>
            <tbody>
              {memos.map((m) => (
                <tr
                  key={m.id}
                  className={cn(
                    "border-b border-slate-50 hover:bg-slate-50 cursor-pointer",
                    selectedId === m.id && "bg-primary-50"
                  )}
                  onClick={() => openCaseMemoViewPopup(caseItem.id, m.id, caseItem.caseNumber)}
                >
                  <td className="px-3 py-1.5 tabular-nums align-top">
                    {formatDate(m.date)}{" "}
                    <span className="text-[10px] text-text-muted">
                      {formatDate(m.date, "time")}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-700 whitespace-pre-line line-clamp-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1">{m.content}</span>
                      <button
                        type="button"
                        title="우측에서 편집"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(m);
                        }}
                        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {memos.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-3 py-6 text-center text-xs text-text-muted"
                  >
                    등록된 메모가 없습니다. 아래 입력창에서 새 메모를 추가하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={cn("flex flex-col p-3 space-y-2", isMobileLayout ? "flex-1" : "flex-1")}>
          <div className="grid grid-cols-[auto,1fr] gap-2 items-center text-xs">
            <span className="text-slate-500">날짜</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-xs flex-1 min-w-0"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-xs w-24 shrink-0"
              />
            </div>
          </div>
          <div className={cn("flex-1", isMobileLayout ? "min-h-[72px]" : "min-h-[80px]")}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={cn(
                "w-full h-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 resize-none",
                isMobileLayout ? "min-h-[72px] max-h-[120px]" : "min-h-[80px] max-h-[150px]"
              )}
              placeholder="사건 진행 메모를 입력하세요."
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="xs" variant="outline" onClick={handleReset}>
              리셋
            </Button>
            {selectedId && (
              <Button
                size="xs"
                variant="danger"
                leftIcon={<Trash2 size={12} />}
                onClick={handleDelete}
              >
                삭제
              </Button>
            )}
            <Button size="xs" onClick={handleSave} disabled={!text.trim()}>
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseDocumentsPanel({
  caseItem,
  files,
  folders,
  loading,
  onFilesChange,
  onFoldersChange,
  variant = "default",
}: {
  caseItem: CaseItem | null;
  files: CaseFile[];
  folders: CaseFolder[];
  loading?: boolean;
  onFilesChange?: (files: CaseFile[]) => void;
  onFoldersChange?: (folders: CaseFolder[]) => void;
  variant?: "default" | "mobile";
}) {
  const isMobileLayout = variant === "mobile";
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState<CaseFile | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [driveHint, setDriveHint] = useState<string | null>(null);

  useEffect(() => {
    fetchDriveStatus()
      .then((s) => {
        if (!s.available) setDriveHint(s.hint);
        else setDriveHint(null);
      })
      .catch(() => setDriveHint(null));
  }, []);

  const FILE_DRAG_TYPE = "application/x-lawygo-file-id";

  useEffect(() => {
    setPreview(null);
    setCurrentFolderId(null);
    setEditingFolderId(null);
    setEditingFileId(null);
    setEditingFileName("");
  }, [caseItem?.id]);

  if (!caseItem) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card flex flex-col min-h-0 flex-1 items-center justify-center text-slate-500 overflow-auto">
        <FileIcon size={32} className="mb-2 text-slate-300" />
        <p className="text-sm font-medium">우하단 자료실</p>
        <p className="text-xs text-text-muted mt-0.5">사건을 선택하면 해당 사건의 파일·폴더가 여기에 표시됩니다.</p>
        <p className="text-[10px] text-text-muted mt-1">드래그 앤 드롭, 폴더 생성/수정/삭제, 미리보기 지원</p>
      </div>
    );
  }

  const canEdit = Boolean(onFilesChange && onFoldersChange);
  const rootFiles = files.filter((f) => !f.folderId);
  const folderFiles = currentFolderId ? files.filter((f) => f.folderId === currentFolderId) : rootFiles;

  const addFilesViaDrive = async (fileList: File[]) => {
    if (!onFilesChange || !caseItem) return;
    setIsUploading(true);
    const added: CaseFile[] = [];
    let localCount = 0;
    let failed = 0;
    for (const f of fileList) {
      try {
        const { data, storageMode } = await uploadCaseFile(caseItem.id, f, currentFolderId);
        if (storageMode === "local") localCount++;
        added.push({
          ...data,
          folderId: currentFolderId ?? data.folderId,
        });
      } catch {
        failed++;
      }
    }
    if (added.length > 0) {
      onFilesChange([...added, ...files]);
      if (localCount > 0) {
        toast.warning(
          `${added.length}개 추가 (${localCount}개 로컬 저장). Drive 연동은 관리자 > Google Drive 설정을 확인하세요.`
        );
      } else {
        toast.success(`${added.length}개 파일이 Drive에 추가되었습니다.`);
      }
    }
    if (failed > 0 && added.length === 0) {
      toast.error("파일 추가에 실패했습니다. 로그인 및 Drive 연동을 확인하세요.");
    } else if (failed > 0 && added.length > 0) {
      toast.warning(`${added.length}개 추가, ${failed}개 실패`);
    }
    setIsUploading(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const fileId = e.dataTransfer.getData(FILE_DRAG_TYPE);
    if (fileId && onFilesChange) {
      moveFileToFolder(fileId, currentFolderId);
      return;
    }
    if (!onFilesChange) return;
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;
    await addFilesViaDrive(dropped);
  };

  const handleBrowse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onFilesChange) return;
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    await addFilesViaDrive(selected);
    e.target.value = "";
  };

  const handleDeleteFile = async (file: CaseFile) => {
    if (!onFilesChange) return;
    if (!confirm("선택한 파일을 삭제하시겠습니까?")) return;
    try {
      await deleteCaseFileRecord(file.id);
      onFilesChange(files.filter((f) => f.id !== file.id));
      if (file.local && file.url?.startsWith("blob:")) URL.revokeObjectURL(file.url);
      if (preview?.id === file.id) setPreview(null);
      toast.success("파일이 삭제되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const handleRenameFile = (file: CaseFile) => {
    setEditingFileId(file.id);
    setEditingFileName(file.fileName);
  };

  const handleSaveRenameFile = async () => {
    if (!onFilesChange || !editingFileId || !editingFileName.trim()) return;
    try {
      const updated = await updateCaseFileMeta(editingFileId, { fileName: editingFileName.trim() });
      onFilesChange(files.map((f) => (f.id === editingFileId ? { ...f, ...updated } : f)));
      setEditingFileId(null);
      setEditingFileName("");
      toast.success("파일명이 변경되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이름 변경 실패");
    }
  };

  const moveFileToFolder = async (fileId: string, targetFolderId: string | null) => {
    if (!onFilesChange) return;
    try {
      const updated = await updateCaseFileMeta(fileId, { folderId: targetFolderId });
      onFilesChange(
        files.map((f) => (f.id === fileId ? { ...f, folderId: updated.folderId ?? undefined } : f))
      );
      toast.success("파일을 이동했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이동 실패");
    }
  };

  const openViewerInNewWindow = async (file: CaseFile) => {
    try {
      await openCaseFilePreview(file, { caseId: caseItem.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "미리보기를 열 수 없습니다.");
      setPreview(file);
    }
  };

  const handleCreateFolder = async () => {
    if (!onFoldersChange || !newFolderName.trim() || !caseItem) return;
    try {
      const newFolder = await createCaseFolder(caseItem.id, newFolderName.trim());
      onFoldersChange([...folders, newFolder]);
      setNewFolderName("");
      toast.success("폴더가 생성되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "폴더 생성 실패");
    }
  };

  const handleRenameFolder = (folder: CaseFolder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleSaveRenameFolder = async () => {
    if (!onFoldersChange || !editingFolderId || !editingFolderName.trim()) return;
    try {
      const updated = await updateCaseFolderMeta(editingFolderId, editingFolderName.trim());
      onFoldersChange(
        folders.map((f) => (f.id === editingFolderId ? { ...f, ...updated } : f))
      );
      setEditingFolderId(null);
      setEditingFolderName("");
      toast.success("폴더명이 수정되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "폴더명 변경 실패");
    }
  };

  const handleDeleteFolder = async (folder: CaseFolder) => {
    if (!onFoldersChange || !onFilesChange) return;
    if (!confirm(`폴더 "${folder.name}"을(를) 삭제하시겠습니까? 안의 파일은 루트로 이동됩니다.`)) return;
    try {
      await deleteCaseFolderRecord(folder.id);
      onFoldersChange(folders.filter((f) => f.id !== folder.id));
      onFilesChange(
        files.map((f) => (f.folderId === folder.id ? { ...f, folderId: undefined } : f))
      );
      if (currentFolderId === folder.id) setCurrentFolderId(null);
      toast.success("폴더가 삭제되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "폴더 삭제 실패");
    }
  };

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200 shadow-card flex flex-col overflow-hidden",
        isMobileLayout ? "min-h-[260px]" : "min-h-0 flex-1"
      )}
    >
      {!isMobileLayout && (
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 flex-wrap">
            <FileIcon size={16} className="text-primary-600" />
            자료실 · {caseItem.caseNumber}
            <button
              type="button"
              onClick={() => openCaseDetailPopup(caseItem.id, caseItem.caseNumber)}
              className="text-xs font-normal text-primary-600 hover:underline"
            >
              상세 보기
            </button>
            <button
              type="button"
              onClick={async () => {
                const { copied } = await copyAndOpenScourtSearch(
                  caseItem.caseNumber,
                  caseItem.clientName,
                  caseItem.court,
                  caseItem.id
                );
                toast.success(
                  "조회 보조창이 열렸습니다. [나의 사건검색에서 연동] 후 [기일 연동]을 눌러주세요."
                );
              }}
              className="text-xs font-normal text-slate-500 hover:text-primary-600 inline-flex items-center gap-1"
              title="법원·사건번호·의뢰인을 조회 보조창에 채우고 대법원 나의사건검색을 엽니다"
            >
              <ExternalLink size={11} />
              법원에서 조회
            </button>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="새 폴더명"
                  className="w-28 px-2 py-1 text-xs border border-slate-200 rounded-lg"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-50"
                  title="폴더 추가"
                >
                  <FolderPlus size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {isMobileLayout && canEdit && (
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="새 폴더명"
            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim()}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50"
            title="폴더 추가"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      )}
      {isMobileLayout && (
        <div className="px-3 py-2 border-b border-slate-100 flex gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setCurrentFolderId(null)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-xs border",
              !currentFolderId
                ? "bg-primary-50 text-primary-700 border-primary-200 font-medium"
                : "bg-white text-slate-600 border-slate-200"
            )}
          >
            전체
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setCurrentFolderId(folder.id)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-xs border max-w-[120px] truncate",
                currentFolderId === folder.id
                  ? "bg-primary-50 text-primary-700 border-primary-200 font-medium"
                  : "bg-white text-slate-600 border-slate-200"
              )}
            >
              {folder.name}
            </button>
          ))}
        </div>
      )}
      <div className={cn("flex min-h-0", isMobileLayout ? "flex-col flex-1" : "flex-1")}>
        {/* 폴더 목록 (데스크톱) */}
        <div className={cn("border-r border-slate-100 flex flex-col overflow-hidden", isMobileLayout ? "hidden" : "w-36")}>
          <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase">폴더</div>
          <div className="flex-1 overflow-y-auto text-xs">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => {
                e.preventDefault();
                const fileId = e.dataTransfer.getData(FILE_DRAG_TYPE);
                if (fileId) moveFileToFolder(fileId, null);
              }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-r",
                !currentFolderId ? "bg-primary-50 text-primary-700 font-medium" : "hover:bg-slate-50 text-slate-700"
              )}
            >
              전체 / 루트
            </button>
            {folders.map((folder) => (
              <div
                key={folder.id}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fileId = e.dataTransfer.getData(FILE_DRAG_TYPE);
                  if (fileId) moveFileToFolder(fileId, folder.id);
                }}
                className={cn(
                  "group flex items-center gap-1 w-full text-left px-2 py-1.5 rounded-r",
                  currentFolderId === folder.id ? "bg-primary-50 text-primary-700 font-medium" : "hover:bg-slate-50 text-slate-700"
                )}
              >
                {editingFolderId === folder.id ? (
                  <input
                    type="text"
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onBlur={handleSaveRenameFolder}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRenameFolder();
                      if (e.key === "Escape") setEditingFolderId(null);
                    }}
                    className="flex-1 min-w-0 px-1 py-0.5 text-xs border rounded"
                    autoFocus
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="flex-1 min-w-0 truncate text-left"
                    >
                      {folder.name}
                    </button>
                    {canEdit && (
                      <span className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }}
                          className="p-0.5 rounded hover:bg-slate-200 text-slate-500"
                          title="이름 변경"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                          className="p-0.5 rounded hover:bg-danger-50 text-danger-500"
                          title="삭제"
                        >
                          <Trash2 size={10} />
                        </button>
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className={cn("flex-1 flex flex-col min-w-0", !isMobileLayout && "border-r border-slate-100")}>
          <div
            className={cn(
              "px-4 py-2 text-xs border-b border-slate-100 flex items-center justify-between flex-wrap gap-2",
              isDragOver ? "bg-primary-50 border-primary-200" : "bg-slate-50"
            )}
          >
            <span className="text-slate-600">
              {loading
                ? "자료실 불러오는 중..."
                : isUploading
                  ? "업로드 중..."
                  : "파일을 끌어다 놓거나 버튼으로 추가하세요."}{" "}
              {!loading && !isUploading && (
                <span className="text-primary-600 font-medium">파일 행을 좌측 폴더로 드래그하면 이동됩니다.</span>
              )}
              {driveHint && !loading && (
                <span className="block text-amber-600 mt-0.5">{driveHint}</span>
              )}
            </span>
            {canEdit && (
              <label className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer hover:bg-slate-50",
                isUploading && "pointer-events-none opacity-60"
              )}>
                <Upload size={13} className="text-slate-500" />
                파일 선택
                <input type="file" multiple className="hidden" onChange={handleBrowse} />
              </label>
            )}
          </div>
          <div
            className={cn("flex-1 overflow-y-auto text-xs", isDragOver && "bg-primary-50")}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left w-6" />
                  <th className="px-3 py-2 text-left">문서명</th>
                  <th className="px-3 py-2 text-left w-24">크기</th>
                  <th className="px-3 py-2 text-right w-28">작업</th>
                </tr>
              </thead>
              <tbody>
                {(currentFolderId ? folderFiles : rootFiles).map((file) => (
                  <tr
                    key={file.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(FILE_DRAG_TYPE, file.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                    onDoubleClick={() => openViewerInNewWindow(file)}
                  >
                    <td className="px-3 py-1.5 align-top text-slate-400" title="드래그하여 폴더로 이동">
                      <GripVertical size={14} className="cursor-grab active:cursor-grabbing" />
                    </td>
                    <td className="px-3 py-1.5 text-slate-800">
                      {editingFileId === file.id ? (
                        <input
                          type="text"
                          value={editingFileName}
                          onChange={(e) => setEditingFileName(e.target.value)}
                          onBlur={handleSaveRenameFile}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRenameFile();
                            if (e.key === "Escape") { setEditingFileId(null); setEditingFileName(""); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                          autoFocus
                        />
                      ) : (
                        <span className="truncate block">{file.fileName}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-text-muted tabular-nums">
                      {Math.round(file.fileSize / 1024)} KB
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <PreviewButton
                        file={file}
                        caseId={caseItem.id}
                        size="sm"
                        variant="ghost"
                        showLabel={!isMobileLayout}
                        className="mr-1 h-7"
                        onPreview={
                          isMobileLayout
                            ? undefined
                            : () => setPreview(file)
                        }
                      />
                      {canEdit && editingFileId !== file.id && (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 text-slate-500 mr-1"
                          onClick={(e) => { e.stopPropagation(); handleRenameFile(file); }}
                          title="이름 변경"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-danger-50 text-danger-500"
                          onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(currentFolderId ? folderFiles : rootFiles).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-xs text-text-muted">
                      {currentFolderId ? "이 폴더에 파일이 없습니다." : "등록된 문서가 없습니다. 드래그하거나 파일 선택으로 추가하세요."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className={cn("w-64 flex-col shrink-0", isMobileLayout ? "hidden" : "hidden md:flex")}>
          <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
            미리보기
          </div>
          <DocumentPreviewPanel file={preview} caseId={caseItem.id} className="flex-1 min-h-[160px]" />
        </div>
      </div>
    </div>
  );
}
