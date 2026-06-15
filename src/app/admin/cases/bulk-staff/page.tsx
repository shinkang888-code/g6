"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Search,
  CheckSquare,
  Square,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { BulkStaffAction, BulkStaffPlan, BulkStaffRole } from "@/lib/bulkStaffCore";
import { BulkStaffPreviewModal } from "@/components/cases/BulkStaffPreviewModal";
import { appendCaseHistory } from "@/lib/caseHistoryStorage";

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "진행중", label: "진행중" },
  { value: "종결", label: "종결" },
  { value: "사임", label: "사임" },
];

const PAGE_SIZE = 20;

type CaseRow = {
  id: string;
  caseNumber: string;
  caseName: string;
  clientName: string;
  court: string;
  status: string;
  assignedStaff: string;
  assistants: string;
};

export default function BulkStaffPage() {
  const [list, setList] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [staffQ, setStaffQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("진행중");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [operatorName, setOperatorName] = useState("");

  const [role, setRole] = useState<BulkStaffRole>("수행");
  const [action, setAction] = useState<BulkStaffAction>("교체");
  const [personName, setPersonName] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [plan, setPlan] = useState<BulkStaffPlan | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.name) setOperatorName(d.user.name);
      })
      .catch(() => {});

    fetch("/api/staff", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { staff: [] }))
      .then((d) => {
        const names = (d.staff ?? [])
          .map((s: { name?: string }) => String(s.name ?? "").trim())
          .filter(Boolean);
        setStaffNames([...new Set(names)] as string[]);
      })
      .catch(() => {});
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (staffQ.trim()) params.set("staff_q", staffQ.trim());
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const res = await fetch(`/api/admin/cases?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "목록 조회 실패");
      const rows = (data.data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ""),
        caseNumber: String(r.caseNumber ?? ""),
        caseName: String(r.caseName ?? ""),
        clientName: String(r.clientName ?? ""),
        court: String(r.court ?? ""),
        status: String(r.status ?? ""),
        assignedStaff: String(r.assignedStaff ?? ""),
        assistants: String(r.assistants ?? ""),
      }));
      setList(rows);
      setTotalCount(typeof data.total === "number" ? data.total : rows.length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "목록을 불러올 수 없습니다.");
      setList([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [search, staffQ, statusFilter, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
  }, [search, staffQ, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const displayIds = list.map((c) => c.id).filter(Boolean);
  const allDisplaySelected = displayIds.length > 0 && displayIds.every((id) => selectedIds.has(id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const effectiveAction = (): BulkStaffAction => {
    if (action === "주담당") return "주담당";
    return action;
  };

  const buildPayload = (dryRun: boolean) => ({
    ids: Array.from(selectedIds),
    role,
    action: effectiveAction(),
    personName,
    dryRun,
  });

  const handlePreview = async () => {
    if (selectedIds.size === 0) {
      toast.error("사건을 선택하세요.");
      return;
    }
    if (!personName.trim()) {
      toast.error("대상 인물을 선택하세요.");
      return;
    }

    setPreviewOpen(true);
    setPreviewLoading(true);
    setPlan(null);

    try {
      const res = await fetch("/api/admin/cases/bulk-staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload(true)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "미리보기 실패");
      setPlan(data.plan ?? null);
      if (data.missingIds?.length) {
        toast.error(`DB에 없는 사건 ${data.missingIds.length}건은 제외되었습니다.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "미리보기 실패");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!plan || plan.summary.apply === 0) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/cases/bulk-staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload(false)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "적용 실패");

      const appliedPlan = (data.plan ?? plan) as BulkStaffPlan;
      const account = data.operator || operatorName || "관리자";
      const label = appliedPlan.actionLabel || `${role} ${action}`;

      for (const row of appliedPlan.rows.filter((r) => r.status === "apply")) {
        appendCaseHistory({
          caseId: row.caseId,
          caseNumber: row.caseNumber,
          clientName: row.clientName,
          action: "수정",
          accountName: account,
          timestamp: new Date().toISOString(),
          details: `일괄담당변경: ${label} (수행: ${row.after.assignedStaff}, 보조: ${row.after.assistants || "-"})`,
        });
      }

      toast.success(data.message || `${data.applied}건이 변경되었습니다.`);
      setPreviewOpen(false);
      setPlan(null);
      setSelectedIds(new Set());
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "적용 실패");
    } finally {
      setConfirming(false);
    }
  };

  const onActionChange = (next: BulkStaffAction) => {
    setAction(next);
    if (next === "주담당") return;
    if (next === "교체") setRole("수행");
    if (next === "IN" || next === "OUT") setRole("보조");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/cases"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          aria-label="사건관리로"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={26} className="text-primary-600" />
            사건담당 일괄변경
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            선택한 사건에 수행 담당 교체, 보조 IN/OUT, 주담당 지정을 일괄 적용합니다. (LawTop MVP)
          </p>
        </div>
      </div>

      {/* 일괄 동작 패널 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">일괄 동작</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">동작</label>
            <select
              value={action}
              onChange={(e) => onActionChange(e.target.value as BulkStaffAction)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[140px]"
            >
              <option value="교체">수행 담당 교체</option>
              <option value="IN">보조 IN</option>
              <option value="OUT">보조 OUT</option>
              <option value="주담당">주담당 지정</option>
            </select>
          </div>
          {action !== "주담당" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">역할</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as BulkStaffRole)}
                disabled={action === "교체" || action === "IN" || action === "OUT"}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[100px] disabled:bg-slate-50"
              >
                <option value="수행">수행</option>
                <option value="보조">보조</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-500 mb-1">대상 인물</label>
            <select
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[160px]"
            >
              <option value="">선택…</option>
              {staffNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={selectedIds.size === 0 || previewLoading}
            leftIcon={previewLoading ? <Loader2 size={14} className="animate-spin" /> : undefined}
            onClick={handlePreview}
          >
            미리보기 ({selectedIds.size}건)
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          수임 역할은 DB에 없어 LawTop과 동일한 수임 IN/OUT은 지원하지 않습니다. 수행 담당은 최소 1명이 유지됩니다.
        </p>
      </div>

      {/* 필터 + 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="사건번호·의뢰인·사건명"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <input
            type="text"
            value={staffQ}
            onChange={(e) => setStaffQ(e.target.value)}
            placeholder="담당·보조 검색"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg min-w-[140px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => fetchList()}>
            검색
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="px-3 py-3 w-10">
                  <button type="button" onClick={toggleSelectAll} className="text-slate-500 hover:text-primary-600">
                    {allDisplaySelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
                <th className="text-left px-3 py-3">사건번호</th>
                <th className="text-left px-3 py-3">의뢰인</th>
                <th className="text-left px-3 py-3 hidden md:table-cell">사건명</th>
                <th className="text-left px-3 py-3">수행</th>
                <th className="text-left px-3 py-3 hidden lg:table-cell">보조</th>
                <th className="text-left px-3 py-3 w-16">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 size={20} className="animate-spin inline mr-2" />
                    로딩 중…
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                list.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-slate-50 cursor-pointer hover:bg-slate-50/80",
                      selectedIds.has(c.id) && "bg-primary-50/60"
                    )}
                    onClick={() => toggleSelect(c.id)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => toggleSelect(c.id)} className="text-slate-500">
                        {selectedIds.has(c.id) ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{c.caseNumber || "-"}</td>
                    <td className="px-3 py-2">{c.clientName || "-"}</td>
                    <td className="px-3 py-2 hidden md:table-cell truncate max-w-[160px]" title={c.caseName}>
                      {c.caseName || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs">{c.assignedStaff || "-"}</td>
                    <td className="px-3 py-2 text-xs hidden lg:table-cell truncate max-w-[140px]" title={c.assistants}>
                      {c.assistants || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs">{c.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-600">
            <span>
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)} / {totalCount}건
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="xs"
                leftIcon={<ChevronLeft size={14} />}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                이전
              </Button>
              <span className="px-2 py-1">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                rightIcon={<ChevronRight size={14} />}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </div>

      <BulkStaffPreviewModal
        open={previewOpen}
        loading={previewLoading}
        confirming={confirming}
        plan={plan}
        selectedCount={selectedIds.size}
        onClose={() => {
          if (confirming) return;
          setPreviewOpen(false);
          setPlan(null);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
