"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FolderOpen,
  Upload,
  Search,
  CheckSquare,
  Square,
  Trash2,
  FileCheck,
  Plus,
  Loader2,
  SlidersHorizontal,
  FileDown,
  ChevronLeft,
  ChevronRight,
  ToggleRight,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { downloadCaseExcelTemplate } from "@/lib/caseExcel";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportCasesSearchResult, fetchAllAdminCasesForExport, mapApiCaseRow } from "@/lib/listExcelExports";
import { useCaseExcelImport } from "@/lib/useCaseExcelImport";
import { CaseImportPreviewModal } from "@/components/cases/CaseImportPreviewModal";

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "진행중", label: "진행중" },
  { value: "종결", label: "종결" },
  { value: "사임", label: "사임" },
];

const CASE_TYPE_OPTIONS = [
  { value: "", label: "사건종류" },
  { value: "형사", label: "형사" },
  { value: "민사", label: "민사" },
  { value: "헌법", label: "헌법" },
  { value: "행정", label: "행정" },
  { value: "가사", label: "가사" },
];

const COURT_OPTIONS = [
  { value: "", label: "법원" },
  { value: "서울고등법원", label: "서울고등법원" },
  { value: "서울중앙지방법원", label: "서울중앙지방법원" },
  { value: "서울동부지방법원", label: "서울동부지방법원" },
  { value: "인천지방법원", label: "인천지방법원" },
  { value: "수원지방법원", label: "수원지방법원" },
  { value: "헌법재판소", label: "헌법재판소" },
];

const STAFF_OPTIONS = [
  { value: "", label: "담당 변호사" },
  { value: "김민준", label: "김민준" },
  { value: "이서연", label: "이서연" },
  { value: "박지훈", label: "박지훈" },
  { value: "미배정", label: "미배정" },
];

const PAGE_SIZE = 15;

type CaseRow = Record<string, string | number>;

export default function AdminCasesPage() {
  const [list, setList] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("진행중");
  const [caseTypeFilter, setCaseTypeFilter] = useState("");
  const [courtFilter, setCourtFilter] = useState("");
  const [assignedStaffFilter, setAssignedStaffFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const caseImport = useCaseExcelImport(() => {
    fetchList();
    fetchFullTotal();
  });
  const [actioning, setActioning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [fullTotalCount, setFullTotalCount] = useState(0);
  const [statusSummary, setStatusSummary] = useState<{ 진행중: number; 종결: number; 사임: number }>({
    진행중: 0,
    종결: 0,
    사임: 0,
  });
  const [deleteAllStep, setDeleteAllStep] = useState<0 | 1>(0);
  const [excelExportLoading, setExcelExportLoading] = useState(false);

  const fetchFullTotal = useCallback(async () => {
    try {
      const [allRes, inRes, closedRes, resignedRes] = await Promise.all([
        fetch("/api/admin/cases?page=1&page_size=1"),
        fetch("/api/admin/cases?status=진행중&page=1&page_size=1"),
        fetch("/api/admin/cases?status=종결&page=1&page_size=1"),
        fetch("/api/admin/cases?status=사임&page=1&page_size=1"),
      ]);
      const [all, inData, closedData, resignedData] = await Promise.all([
        allRes.json(),
        inRes.json(),
        closedRes.json(),
        resignedRes.json(),
      ]);
      if (allRes.ok && typeof all.total === "number") setFullTotalCount(all.total);
      setStatusSummary({
        진행중: inRes.ok && typeof inData.total === "number" ? inData.total : 0,
        종결: closedRes.ok && typeof closedData.total === "number" ? closedData.total : 0,
        사임: resignedRes.ok && typeof resignedData.total === "number" ? resignedData.total : 0,
      });
    } catch {
      // 무시
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (caseTypeFilter) params.set("case_type", caseTypeFilter);
      if (courtFilter) params.set("court", courtFilter);
      if (assignedStaffFilter) params.set("assigned_staff", assignedStaffFilter);
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const res = await fetch(`/api/admin/cases?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "목록 조회 실패");
      const rows = Array.isArray(data.data) ? data.data : [];
      setList(rows);
      const total = typeof data.total === "number" ? data.total : rows.length;
      setTotalCount(total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "목록을 불러올 수 없습니다.";
      setLastError(msg);
      toast.error(msg);
      setList([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, caseTypeFilter, courtFilter, assignedStaffFilter, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchFullTotal();
  }, [fetchFullTotal]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, caseTypeFilter, courtFilter, assignedStaffFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const displayList = list;
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safePage * PAGE_SIZE, totalCount);

  useEffect(() => {
    if (totalPages >= 1 && page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await caseImport.handleExcelFile(file);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayIds = displayList.map((c) => String((c as { id?: string }).id ?? "")).filter(Boolean);
  const allDisplaySelected = displayIds.length > 0 && displayIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allDisplaySelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        displayIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        displayIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleCloseCases = async () => {
    if (selectedIds.size === 0) {
      toast.error("종결할 사건을 선택하세요.");
      return;
    }
    setActioning(true);
    try {
      const res = await fetch("/api/admin/cases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: "종결" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "종결 처리 실패");
      toast.success(data.message);
      setSelectedIds(new Set());
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "종결 처리 실패");
    } finally {
      setActioning(false);
    }
  };

  const handleStatusChange = async (newStatus: "진행중" | "종결" | "사임") => {
    if (selectedIds.size === 0) {
      toast.error("변경할 사건을 선택하세요.");
      return;
    }
    setStatusChangeOpen(false);
    setActioning(true);
    try {
      const res = await fetch("/api/admin/cases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "상태 변경 실패");
      toast.success(data.message);
      setSelectedIds(new Set());
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상태 변경 실패");
    } finally {
      setActioning(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("삭제할 사건을 선택하세요.");
      return;
    }
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?`)) return;
    setActioning(true);
    try {
      const res = await fetch("/api/admin/cases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제 실패");
      toast.success(data.message);
      setSelectedIds(new Set());
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          aria-label="관리 대시보드로"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen size={26} className="text-primary-600" />
            사건관리
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            대량 엑셀 등록, 사건 목록 검색·필터, 종결·일괄 삭제 · 현재 등록된 사건{" "}
            <span className="font-semibold text-slate-900">{fullTotalCount}</span>건
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            진행중{" "}
            <span className="font-semibold text-primary-700">
              {statusSummary.진행중}
            </span>
            건 · 종결{" "}
            <span className="font-semibold text-slate-700">
              {statusSummary.종결}
            </span>
            건 · 사임{" "}
            <span className="font-semibold text-amber-700">
              {statusSummary.사임}
            </span>
            건
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={caseImport.previewLoading || caseImport.confirming}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={
              caseImport.previewLoading || caseImport.confirming ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )
            }
            disabled={caseImport.previewLoading || caseImport.confirming}
            asChild
          >
            <span>대량사건엑셀등록</span>
          </Button>
        </label>
        <Link href="/cases/new">
          <Button type="button" variant="outline" size="sm" leftIcon={<Plus size={14} />}>
            사건등록
          </Button>
        </Link>
        <Link href="/admin/cases/bulk-staff">
          <Button type="button" variant="outline" size="sm" leftIcon={<Users size={14} />}>
            담당 일괄변경
          </Button>
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={actioning ? <Loader2 size={14} className="animate-spin" /> : <ToggleRight size={14} />}
          disabled={selectedIds.size === 0 || actioning}
          onClick={() => (selectedIds.size === 0 ? toast.error("사건을 선택하세요.") : setStatusChangeOpen(true))}
        >
          진행상태변경
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<FileDown size={14} />}
          onClick={downloadCaseExcelTemplate}
        >
          양식 다운로드
        </Button>
        <SearchResultExcelButton
          count={totalCount}
          loading={excelExportLoading}
          onExport={async () => {
            setExcelExportLoading(true);
            try {
              const rows = await fetchAllAdminCasesForExport({
                q: search,
                status: statusFilter,
                caseType: caseTypeFilter,
                court: courtFilter,
                assignedStaff: assignedStaffFilter,
              });
              exportCasesSearchResult(rows.map(mapApiCaseRow), "사건목록_관리자");
              toast.success(`${rows.length}건을 엑셀로보냈습니다.`);
            } finally {
              setExcelExportLoading(false);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const res = await fetch("/api/admin/cases/dedupe", { method: "POST" });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "사건 연동에 실패했습니다.");
              toast.success(data.message || "중복 사건 정리 및 연동이 완료되었습니다.");
              fetchList();
              fetchFullTotal();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "사건 연동에 실패했습니다.");
            }
          }}
        >
          사건연동
        </Button>
        <Button
          type="button"
          variant={deleteAllStep === 0 ? "outline" : "danger"}
          size="sm"
          onClick={async () => {
            if (deleteAllStep === 0) {
              setDeleteAllStep(1);
              toast.error("전체 사건 삭제 준비 단계입니다. 정말 모두 삭제하려면 한 번 더 누르세요.");
              setTimeout(() => setDeleteAllStep(0), 10000);
              return;
            }
            try {
              const res = await fetch("/api/admin/cases", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "전체 사건 삭제에 실패했습니다.");
              toast.success(data.message || "전체 사건이 삭제되었습니다.");
              setDeleteAllStep(0);
              setList([]);
              setTotalCount(0);
              setFullTotalCount(0);
              setStatusSummary({ 진행중: 0, 종결: 0, 사임: 0 });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "전체 사건 삭제에 실패했습니다.");
            }
          }}
        >
          {deleteAllStep === 0 ? "전체 사건 삭제" : "정말 전체 삭제"}
        </Button>
      </div>

      {statusChangeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setStatusChangeOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-lg border border-slate-200 p-5 min-w-[280px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">진행상태 변경</h3>
              <button type="button" onClick={() => setStatusChangeOpen(false)} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4">선택한 {selectedIds.size}건을 다음 상태로 변경합니다.</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => handleStatusChange("진행중")} className="flex-1">
                진행중
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handleStatusChange("종결")} className="flex-1">
                종결
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handleStatusChange("사임")} className="flex-1">
                사임
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setStatusChangeOpen(false)}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="당사자(의뢰인)·사건번호·사건명 검색"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCloseCases}
              disabled={selectedIds.size === 0 || actioning}
              leftIcon={actioning ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
            >
              사건종결
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={handleDelete}
              disabled={selectedIds.size === 0 || actioning}
              leftIcon={<Trash2 size={14} />}
            >
              일괄 삭제
            </Button>
          </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <SlidersHorizontal size={13} />
              필터:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={caseTypeFilter}
              onChange={(e) => setCaseTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {CASE_TYPE_OPTIONS.map((o) => (
                <option key={o.value || "ct"} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={assignedStaffFilter}
              onChange={(e) => setAssignedStaffFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {STAFF_OPTIONS.map((o) => (
                <option key={o.value || "st"} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={courtFilter}
              onChange={(e) => setCourtFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {COURT_OPTIONS.map((o) => (
                <option key={o.value || "co"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-muted">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 px-4 text-center">
              {lastError && (lastError.includes("table") || lastError.includes("schema") || lastError.includes("cases")) ? (
                <div className="max-w-lg mx-auto text-left space-y-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <p className="text-sm font-semibold text-amber-800">DB 연동 오류 — public.cases 테이블 없음</p>
                  <p className="text-xs text-slate-600">{lastError}</p>
                  <div className="text-xs text-slate-700 space-y-1.5">
                    <p className="font-medium text-slate-800">해결 방법:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-1">
                      <li>Supabase 대시보드 → SQL Editor 열기</li>
                      <li>프로젝트 루트의 <code className="bg-white px-1 rounded border border-slate-200">supabase/migrations/20260306000001_cases_standalone.sql</code> 파일 내용을 복사</li>
                      <li>SQL Editor에 붙여넣은 뒤 Run 실행</li>
                      <li>이 페이지 새로고침</li>
                    </ol>
                    <p className="pt-1 text-slate-600">
                      상세 SQL 및 설명은 <code className="bg-white px-1 rounded border border-slate-200">docs/db/cases-table-setup.md</code> 참고.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">사건이 없습니다. 대량사건엑셀등록 또는 사건 1건 등록을 이용하세요.</p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="w-10 px-3 py-3 text-left">
                    <button type="button" onClick={toggleSelectAll} className="p-1 rounded hover:bg-slate-200" aria-label="현재 페이지 전체 선택">
                      {allDisplaySelected ? <CheckSquare size={18} className="text-primary-600" /> : <Square size={18} className="text-slate-400" />}
                    </button>
                  </th>
                  <th className="text-left px-3 py-3 min-w-[100px]">사건번호</th>
                  <th className="text-left px-3 py-3 w-14">종류</th>
                  <th className="text-left px-3 py-3 min-w-[120px]">사건명</th>
                  <th className="text-left px-3 py-3 min-w-[100px] hidden md:table-cell">법원</th>
                  <th className="text-left px-3 py-3 min-w-[80px]">의뢰인</th>
                  <th className="text-left px-3 py-3 w-14 hidden sm:table-cell">지위</th>
                  <th className="text-left px-3 py-3 w-16">담당</th>
                  <th className="text-left px-3 py-3 min-w-[80px] hidden lg:table-cell">보조</th>
                  <th className="text-left px-3 py-3 w-24 hidden md:table-cell">다음 기일</th>
                  <th className="text-left px-3 py-3 w-16">상태</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((c) => {
                  const id = String((c as { id?: string }).id ?? "");
                  const isSelected = selectedIds.has(id);
                  const row = c as CaseRow & { id?: string; nextDate?: string | null };
                  return (
                    <tr
                      key={id}
                      className={cn(
                        "border-b border-slate-100 hover:bg-slate-50/50",
                        isSelected && "bg-primary-50/50"
                      )}
                    >
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => toggleSelect(id)} className="p-1 rounded hover:bg-slate-200">
                          {isSelected ? <CheckSquare size={18} className="text-primary-600" /> : <Square size={18} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        <Link href={`/cases/${id}`} className="hover:text-primary-600 hover:underline">
                          {row.caseNumber ?? row.case_number ?? "-"}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{row.caseType ?? row.case_type ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{row.caseName ?? row.case_name ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600 hidden md:table-cell">{row.court ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{row.clientName ?? row.client_name ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">{row.clientPosition ?? row.client_position ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.assignedStaff ?? row.assigned_staff_name ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600 hidden lg:table-cell truncate max-w-[120px]">{row.assistants ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600 hidden md:table-cell">{row.nextDate ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            row.status === "종결" ? "bg-slate-100 text-slate-600" : row.status === "사임" ? "bg-amber-50 text-amber-800" : "bg-primary-100 text-primary-700"
                          )}
                        >
                          {row.status ?? "진행중"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {list.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-text-muted">
              {startItem}–{endItem} / 전체 {list.length}건
              {statusFilter ? ` (상태: ${STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter})` : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="이전 페이지"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="px-2 text-xs text-slate-600 min-w-[4rem] text-center">
                {safePage} / {totalPages}페이지
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="다음 페이지"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
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
