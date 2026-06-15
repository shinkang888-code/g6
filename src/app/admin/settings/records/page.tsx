"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CASE_AUDIT_ACTION_LABELS,
  CASE_FIELD_LABELS,
  type CaseAuditAction,
  type CaseAuditLog,
} from "@/lib/caseAuditLogShared";

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "전체 작업" },
  ...Object.entries(CASE_AUDIT_ACTION_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatChangeValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(없음)";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  return String(v);
}

export default function AdminSettingsRecordsPage() {
  const [list, setList] = useState<CaseAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (caseNumber.trim()) sp.set("caseNumber", caseNumber.trim());
      if (clientName.trim()) sp.set("clientName", clientName.trim());
      if (action) sp.set("action", action);
      if (actor.trim()) sp.set("actor", actor.trim());
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      sp.set("page", String(page));
      sp.set("page_size", String(pageSize));

      const res = await fetch(`/api/admin/case-audit-logs?${sp.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        data?: CaseAuditLog[];
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        setList([]);
        setTotal(0);
        return;
      }
      setList(Array.isArray(json.data) ? json.data : []);
      setTotal(typeof json.total === "number" ? json.total : 0);
    } finally {
      setLoading(false);
    }
  }, [q, caseNumber, clientName, action, actor, from, to, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

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
            <ClipboardList size={26} className="text-primary-600" />
            기록 관리
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            사건 등록·수정·삭제 등 변경 이력을 누가 언제 했는지 확인합니다. (서버 보관)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="통합 검색 (사건번호·의뢰인·작업자)"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            placeholder="사건번호"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="의뢰인"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="작업자 (아이디·이름)"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            leftIcon={<Search size={14} />}
            onClick={handleSearch}
          >
            검색
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            변경 로그 {total.toLocaleString()}건
          </span>
          {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>

        {list.length === 0 && !loading ? (
          <div className="p-10 text-center text-sm text-text-muted">
            기록이 없거나 검색 조건에 맞는 로그가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.map((entry) => {
              const expanded = expandedId === entry.id;
              const changeEntries = Object.entries(entry.changes ?? {});
              return (
                <div key={entry.id} className="px-5 py-4 hover:bg-slate-50/50">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          entry.action === "delete"
                            ? "bg-danger-100 text-danger-700"
                            : entry.action === "create"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-primary-100 text-primary-700"
                        )}
                      >
                        {CASE_AUDIT_ACTION_LABELS[entry.action as CaseAuditAction] ?? entry.action}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {entry.caseNumber || "(사건번호 없음)"}
                      {entry.clientName ? ` · ${entry.clientName}` : ""}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      작업자: <span className="font-medium">{entry.actorName}</span>
                      {entry.actorLoginId ? ` (${entry.actorLoginId})` : ""}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{entry.summary}</p>
                  </button>

                  {expanded && (
                    <div className="mt-3 pl-3 border-l-2 border-primary-200 space-y-2">
                      {entry.caseId && (
                        <Link
                          href={`/cases/${entry.caseId}`}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          사건 상세 보기
                        </Link>
                      )}
                      {changeEntries.length > 0 ? (
                        <ul className="text-xs text-slate-600 space-y-1">
                          {changeEntries.map(([key, ch]) => (
                            <li key={key}>
                              <span className="font-medium text-slate-700">
                                {CASE_FIELD_LABELS[key] ?? key}
                              </span>
                              : {formatChangeValue(ch.from)} → {formatChangeValue(ch.to)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-text-muted">필드별 변경 내역 없음</p>
                      )}
                      {entry.ipAddress && (
                        <p className="text-[10px] text-slate-400">IP: {entry.ipAddress}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft size={14} />}
            >
              이전
            </Button>
            <span className="text-xs text-slate-500">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={<ChevronRight size={14} />}
            >
              다음
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
