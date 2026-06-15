"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileCheck, Plus, Check, X, FileText, Download, Send, ExternalLink, RotateCcw, Pencil
} from "lucide-react";
import { cn, formatDate, formatAmount } from "@/lib/utils";
import type { ApprovalDoc, ApprovalStep } from "@/lib/types";
import { fetchApprovals, fetchApprovalDetail, patchApproval, deleteApprovalDoc } from "@/lib/approvalApi";
import {
  canUserActOnApproval,
  canUserEditApprovalDoc,
  canUserDeleteApprovalDoc,
  isApprovalSoftDeleted,
} from "@/lib/approvalWorkflow";
import { ApprovalListItemActions } from "@/components/approval/ApprovalListItemActions";
import {
  APPROVAL_LIST_TABS,
  APPROVAL_DOC_TYPE_OPTIONS,
  type ApprovalListTab,
} from "@/lib/approvalConfig";
import { countByTab } from "@/lib/approvalFilters";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportApprovalsSearchResult } from "@/lib/listExcelExports";

function useCurrentUser(): { userId: string; userName: string; isCompanyAdmin: boolean } {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.user) {
          setUserId(String(s.user.userId ?? s.user.id ?? ""));
          setUserName(String(s.user.name ?? s.user.loginId ?? ""));
          setIsCompanyAdmin(Boolean(s.user.isCompanyAdmin));
          return;
        }
        return fetch("/api/auth/me", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.user) {
              setUserId(String(d.user.id ?? d.user.userId ?? ""));
              setUserName(String(d.user.name ?? d.user.loginId ?? ""));
            }
          });
      })
      .catch(() => {});
  }, []);
  return { userId, userName, isCompanyAdmin };
}

function parseTabFromUrl(raw: string | null): ApprovalListTab {
  if (raw && APPROVAL_LIST_TABS.some((t) => t.value === raw)) {
    return raw as ApprovalListTab;
  }
  return "미결재";
}

const statusConfig = {
  임시저장: { color: "text-slate-500 bg-slate-100", dot: "bg-slate-400" },
  결재요청: { color: "text-primary-700 bg-primary-100", dot: "bg-primary-500" },
  결재중: { color: "text-warning-700 bg-warning-100", dot: "bg-warning-500" },
  결재완료: { color: "text-success-700 bg-success-100", dot: "bg-success-500" },
  반려: { color: "text-danger-700 bg-danger-100", dot: "bg-danger-500" },
  삭제대기: { color: "text-warning-800 bg-warning-50", dot: "bg-warning-500" },
};

export default function ApprovalPage() {
  const searchParams = useSearchParams();
  const docIdFromUrl = searchParams.get("doc");
  const tabFromUrl = searchParams.get("tab");

  const [approvals, setApprovals] = useState<ApprovalDoc[]>([]);
  const [allApprovals, setAllApprovals] = useState<ApprovalDoc[]>([]);
  const [selected, setSelected] = useState<ApprovalDoc | null>(null);
  const [approvalLine, setApprovalLine] = useState<ApprovalStep[]>([]);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageToDrafter, setMessageToDrafter] = useState("");
  const [activeTab, setActiveTab] = useState<ApprovalListTab>(() => parseTabFromUrl(tabFromUrl));
  const [searchQ, setSearchQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<
    Array<{ id: string; actor_name: string; action: string; comment?: string | null; created_at: string }>
  >([]);
  const [attachmentData, setAttachmentData] = useState<{ name: string; data: string }[]>([]);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const { userId: currentUserId, userName: currentUserName, isCompanyAdmin } = useCurrentUser();
  const permCtx = useMemo(() => ({ isCompanyAdmin }), [isCompanyAdmin]);

  const loadApprovals = useCallback(
    async (opts?: { selectId?: string; preferTab?: ApprovalListTab }) => {
      setLoading(true);
      try {
        const [all, filtered] = await Promise.all([
          fetchApprovals({ tab: "전체" }),
          fetchApprovals({
            tab: opts?.preferTab ?? activeTab,
            q: searchQ,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            docType: docTypeFilter,
          }),
        ]);
        setAllApprovals(all);
        setApprovals(filtered);
        if (opts?.preferTab) setActiveTab(opts.preferTab);
        const selectId =
          opts?.selectId ||
          (typeof window !== "undefined"
            ? sessionStorage.getItem("lawygo_approval_select_id")
            : null) ||
          docIdFromUrl ||
          undefined;
        if (selectId && typeof window !== "undefined") {
          sessionStorage.removeItem("lawygo_approval_select_id");
        }
        setSelected((prev) => {
          const pickFrom = (pool: ApprovalDoc[]) => {
            if (selectId) return pool.find((a) => a.id === selectId) ?? filtered[0] ?? pool[0] ?? null;
            if (docIdFromUrl) return pool.find((a) => a.id === docIdFromUrl) ?? filtered[0] ?? pool[0] ?? null;
            if (prev) return pool.find((a) => a.id === prev.id) ?? filtered[0] ?? pool[0] ?? null;
            return filtered[0] ?? pool[0] ?? null;
          };
          return pickFrom(all.length ? all : filtered);
        });
      } catch (e) {
        setApprovals([]);
        toast.error(e instanceof Error ? e.message : "결재 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [docIdFromUrl, activeTab, searchQ, dateFrom, dateTo, docTypeFilter]
  );

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  useEffect(() => {
    if (tabFromUrl) setActiveTab(parseTabFromUrl(tabFromUrl));
  }, [tabFromUrl]);

  useEffect(() => {
    const interval = setInterval(() => loadApprovals(), 15000);
    const onFocus = () => {
      if (sessionStorage.getItem("lawygo_approval_pending_refresh")) {
        sessionStorage.removeItem("lawygo_approval_pending_refresh");
        loadApprovals({ preferTab: "나의작성" });
      } else {
        loadApprovals();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadApprovals]);
  useEffect(() => {
    if (!docIdFromUrl) return;
    const doc = approvals.find((a) => a.id === docIdFromUrl);
    if (doc) {
      setSelected(doc);
      setApprovalLine(doc.approvalLine);
    }
  }, [docIdFromUrl, approvals]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (
        e.data?.type === "APPROVAL_DRAFT_SUBMIT" ||
        e.data?.type === "APPROVAL_DRAFT_UPDATE" ||
        e.data?.type === "APPROVAL_REJECT"
      ) {
        const newId = e.data?.payload?.id as string | undefined;
        loadApprovals({
          selectId: newId,
          preferTab:
            e.data?.type === "APPROVAL_DRAFT_SUBMIT" || e.data?.type === "APPROVAL_DRAFT_UPDATE"
              ? "나의작성"
              : activeTab,
        });
        if (e.data?.type === "APPROVAL_DRAFT_SUBMIT") {
          toast.success("새 결재 문서가 등록되었습니다. 결재자에게 알림이 발송됩니다.");
        }
        if (e.data?.type === "APPROVAL_DRAFT_UPDATE") {
          toast.success("결재 문서가 수정·저장되었습니다.");
        }
        if (e.data?.type === "APPROVAL_REJECT") {
          toast.error("결재를 반려했습니다.");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [loadApprovals]);

  useEffect(() => {
    if (selected) setApprovalLine(selected.approvalLine);
  }, [selected]);

  useEffect(() => {
    if (!selected?.id) {
      setHistory([]);
      setAttachmentData([]);
      return;
    }
    fetchApprovalDetail(selected.id)
      .then((detail) => {
        setHistory(detail.history ?? []);
        setAttachmentData(detail.attachmentData ?? []);
      })
      .catch(() => {
        setHistory([]);
        setAttachmentData([]);
      });
  }, [selected?.id]);

  const openDraftWindow = (type?: string) => {
    const w = 560;
    const h = 820;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    window.open(
      `/approval/draft${qs}`,
      "approval-draft",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`
    );
  };

  const openEditWindow = (id: string) => {
    const w = 560;
    const h = 820;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(
      `/approval/draft?id=${encodeURIComponent(id)}`,
      "approval-draft",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`
    );
  };

  const handleRowClick = (ap: ApprovalDoc) => {
    setSelected(ap);
    setApprovalLine(ap.approvalLine);
  };

  const handleDeleteApproval = async (ap: ApprovalDoc) => {
    const soft = isApprovalSoftDeleted(ap);
    const completed = ap.status === "결재완료";
    const msg = soft
      ? `"${ap.title}" 문서를 영구 삭제하시겠습니까? 복구할 수 없습니다.${
          completed && isCompanyAdmin ? "\n(사내관리자 삭제 감사 로그가 기록됩니다.)" : ""
        }`
      : completed
        ? `"${ap.title}" 결재완료 문서를 삭제 대기로 변경하시겠습니까?\n한 번 더 삭제하면 영구 삭제됩니다.${
            isCompanyAdmin ? "\n(삭제 시 문서 본문이 보안 감사 로그에 보관됩니다.)" : ""
          }`
        : `"${ap.title}" 문서를 삭제 대기 상태로 변경하시겠습니까?\n한 번 더 삭제하면 영구 삭제됩니다.`;
    if (!confirm(msg)) return;

    setDeleteLoadingId(ap.id);
    try {
      const result = await deleteApprovalDoc(ap.id);
      if (result.mode === "permanent") {
        setApprovals((prev) => prev.filter((d) => d.id !== ap.id));
        setAllApprovals((prev) => prev.filter((d) => d.id !== ap.id));
        if (selected?.id === ap.id) setSelected(null);
        toast.success("결재 문서가 영구 삭제되었습니다.");
      } else if (result.data) {
        const updated = result.data;
        setApprovals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        setAllApprovals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        if (selected?.id === updated.id) setSelected(updated);
        toast.success("삭제 대기로 변경되었습니다. 영구 삭제하려면 삭제를 한 번 더 누르세요.");
      }
      void loadApprovals({ preferTab: activeTab });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const canEditSelected = selected ? canUserEditApprovalDoc(selected, currentUserId) : false;
  const myStep = useMemo(
    () => selected?.approvalLine.find((s) => s.staffId === currentUserId),
    [selected, currentUserId]
  );
  const canAct = selected
    ? canUserActOnApproval(selected.approvalLine, currentUserId, selected.status)
    : false;
  const canRevert =
    selected &&
    (myStep?.status === "승인" || myStep?.status === "반려") &&
    (selected.status === "결재완료" || selected.status === "반려" || selected.status === "결재중");

  const openNewWindowPreview = () => {
    if (!selected) return;
    const title = selected.title;
    const attachmentLabel = secondAttachmentName ?? "첨부.pdf";
    const body = selected.notes
      ? selected.notes
      : `[첨부: ${attachmentLabel}]\n\n실제 파일은 서버에 저장된 문서로 조회됩니다.`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family: sans-serif; padding: 1.5rem; max-width: 48rem; margin: 0 auto;"><h1 style="font-size: 1.25rem;">${title}</h1><pre style="white-space: pre-wrap; background: #f8fafc; padding: 1rem; border-radius: 0.5rem;">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    try {
      const updated = await patchApproval(selected.id, { action: "approve" });
      setApprovals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelected(updated);
      setApprovalLine(updated.approvalLine);
      if (updated.status === "결재완료") {
        setActiveTab("완료");
        toast.success("결재가 완료되었습니다.");
      } else if (updated.status === "결재중") {
        setActiveTab("결재중");
        toast.success("승인했습니다. 다음 결재 차례로 이동합니다.");
      } else {
        toast.success("결재를 승인했습니다.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "승인 실패");
    }
  };

  const openRejectPopup = () => {
    if (!selected) return;
    const params = new URLSearchParams({
      doc: selected.id,
      requesterId: selected.requesterId,
      requesterName: selected.requesterName,
      senderId: currentUserId,
    });
    const w = 440;
    const h = 420;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(
      `/approval/reject?${params.toString()}`,
      "approval-reject",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
  };

  const handleRevert = async () => {
    if (!selected || !myStep) return;
    try {
      const updated = await patchApproval(selected.id, { action: "revert" });
      setApprovals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelected(updated);
      setApprovalLine(updated.approvalLine);
      toast.success("결재를 대기 상태로 되돌렸습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "취소 실패");
    }
  };

  const handleSendMessage = async () => {
    const msg = messageToDrafter.trim();
    if (!msg || !selected) {
      toast.error("메시지 내용을 입력하세요.");
      return;
    }
    try {
      await patchApproval(selected.id, { action: "comment", messageToDrafter: msg });
      toast.success("기안자에게 수정·보완 요청 메시지를 발송했습니다.", {
        description: `${selected.requesterName}님에게 전달됩니다.`,
      });
      setMessageToDrafter("");
      setMessageModalOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "메시지 발송 실패");
    }
  };

  const tabCounts = useMemo(
    () => countByTab(allApprovals, currentUserId, currentUserName, permCtx),
    [allApprovals, currentUserId, currentUserName, permCtx]
  );

  const filteredApprovals = approvals;

  const previewAttachment = attachmentData[1] ?? attachmentData[0];
  const secondAttachmentName =
    previewAttachment?.name ?? selected?.attachmentNames?.[1] ?? selected?.attachmentNames?.[0];
  const handleDownloadAttachment = () => {
    const att = previewAttachment;
    if (att?.data) {
      const a = document.createElement("a");
      a.href = att.data;
      a.download = att.name;
      a.click();
      toast.success("첨부파일을 다운로드했습니다.");
      return;
    }
    const name = secondAttachmentName || "제출문서.txt";
    const content = selected?.notes
      ? `[결재 문서]\n${selected.title}\n\n${selected.notes}`
      : `[결재 문서] ${selected?.title}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name.endsWith(".pdf") ? name : `${name.replace(/\.[^.]+$/, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("첨부파일을 다운로드했습니다.");
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: 기안창 (전자결재함) - 절반 */}
      <aside className="w-1/2 min-w-0 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">나의 전자결재</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {loading ? "불러오는 중…" : `${activeTab} ${filteredApprovals.length}건 · 전체 ${allApprovals.length}건`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <SearchResultExcelButton
              size="sm"
              count={filteredApprovals.length}
              disabled={loading}
              onExport={() => {
                if (exportApprovalsSearchResult(filteredApprovals, activeTab)) {
                  toast.success(`${filteredApprovals.length}건을 엑셀로보냈습니다.`);
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={() => openDraftWindow("기안서")}>
              기안서
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDraftWindow("지급품의서")}>
              지급품의서
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDraftWindow("근태행선지")}>
              근태행선지
            </Button>
            <Button size="sm" leftIcon={<Plus size={13} />} onClick={() => openDraftWindow()}>
              기안
            </Button>
          </div>
        </div>

        {/* 검색·기간 (LawTop 상단 툴바) */}
        <div className="px-3 py-2 border-b border-slate-100 space-y-2 bg-slate-50/40">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
              title="시작일"
            />
            <span className="text-xs text-slate-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
              title="종료일"
            />
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
            >
              <option value="전체">문서유형 전체</option>
              {APPROVAL_DOC_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadApprovals()}
              placeholder="제목·사건번호·기안자·내용 검색"
              className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
            />
            <Button size="xs" variant="outline" onClick={() => void loadApprovals()}>
              검색
            </Button>
          </div>
        </div>

        {/* Tabs (LawTop 나의작성·미결재·기결재·참조/협조) */}
        <div className="flex flex-wrap border-b border-slate-100 text-xs font-medium">
          {APPROVAL_LIST_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-3 py-2.5 transition-colors shrink-0",
                tab.value === activeTab
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-text-muted hover:text-slate-700"
              )}
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-80">({tabCounts[tab.value]})</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {!loading && filteredApprovals.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-text-muted">
              {activeTab === "미결재" && "처리할 결재 문서가 없습니다."}
              {activeTab === "나의작성" && "작성한 결재 문서가 없습니다. 기안 버튼을 이용하세요."}
              {activeTab === "기결재" && "처리 완료한 결재가 없습니다."}
              {activeTab === "참조협조" && "참조·협조로 받은 문서가 없습니다."}
              {activeTab === "결재중" && "진행 중인 결재가 없습니다."}
              {activeTab === "완료" && "완료·반려된 결재가 없습니다."}
              {activeTab === "전체" && "결재 문서가 없습니다."}
            </div>
          )}
          {filteredApprovals.map((ap) => {
            const softDeleted = isApprovalSoftDeleted(ap);
            const displayStatus = softDeleted ? "삭제대기" : ap.status;
            const sc = statusConfig[displayStatus as keyof typeof statusConfig] ?? statusConfig.결재요청;
            const canEdit = canUserEditApprovalDoc(ap, currentUserId);
            const canDelete = canUserDeleteApprovalDoc(ap, currentUserId, permCtx);
            return (
              <div
                key={ap.id}
                onClick={() => handleRowClick(ap)}
                className={cn(
                  "px-4 py-3 cursor-pointer transition-colors",
                  selected?.id === ap.id
                    ? "bg-primary-50 border-l-2 border-primary-600"
                    : "hover:bg-slate-50",
                  softDeleted && "opacity-80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{ap.title}</div>
                    <div className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{ap.type}</span>
                      {ap.caseNumber && <span>{ap.caseNumber}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={cn(
                        "text-xs font-medium rounded-full px-2 py-0.5 flex items-center gap-1",
                        sc.color
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                      {displayStatus}
                    </span>
                    <ApprovalListItemActions
                      isSoftDeleted={softDeleted}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      deleteLoading={deleteLoadingId === ap.id}
                      onEdit={() => openEditWindow(ap.id)}
                      onDelete={() => void handleDeleteApproval(ap)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar name={ap.requesterName} size="xs" />
                  <span className="text-xs text-text-muted">
                    {ap.requesterName} · {formatDate(ap.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right: 결재 문서 상세 - 절반 */}
      {selected ? (
        <main className="w-1/2 min-w-0 overflow-y-auto bg-background flex flex-col">
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-card p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5 font-medium">
                      {selected.type}
                    </span>
                    <span className={cn("text-xs font-medium rounded-full px-2 py-0.5 flex items-center gap-1", statusConfig[selected.status].color)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig[selected.status].dot)} />
                      {selected.status}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-slate-900">{selected.title}</h1>
                  <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                    <span>{selected.caseNumber}</span>
                    <span>·</span>
                    <span>{formatDate(selected.createdAt)} 기안</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {canEditSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Pencil size={13} />}
                      onClick={() => openEditWindow(selected.id)}
                    >
                      수정
                    </Button>
                  )}
                  {selected.amount && (
                    <div className="text-right">
                      <div className="text-xs text-text-muted mb-1">금액</div>
                      <div className="text-xl font-bold text-slate-900 tabular-nums">
                        {formatAmount(selected.amount)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selected.metadata && (selected.type === "지급품의서" || selected.type === "근태행선지") && (
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  {selected.type === "지급품의서" && (
                    <>
                      {selected.metadata.paymentPurpose && (
                        <div><span className="text-text-muted">지급목적</span> {selected.metadata.paymentPurpose}</div>
                      )}
                      {selected.metadata.payee && (
                        <div><span className="text-text-muted">지급대상</span> {selected.metadata.payee}</div>
                      )}
                    </>
                  )}
                  {selected.type === "근태행선지" && (
                    <>
                      {selected.metadata.leaveType && (
                        <div><span className="text-text-muted">구분</span> {selected.metadata.leaveType}</div>
                      )}
                      {selected.metadata.destination && (
                        <div><span className="text-text-muted">행선지</span> {selected.metadata.destination}</div>
                      )}
                      {(selected.metadata.travelFrom || selected.metadata.travelTo) && (
                        <div className="col-span-2">
                          <span className="text-text-muted">기간</span>{" "}
                          {selected.metadata.travelFrom} ~ {selected.metadata.travelTo}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {selected.notes && (
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selected.notes}
                </div>
              )}

              {selected.status === "결재요청" && !canAct && myStep?.status !== "대기" && (
                <p className="text-sm text-text-muted mt-5 pt-5 border-t border-slate-100">
                  다른 결재자가 처리할 때까지 대기 중입니다.
                </p>
              )}
            </motion.div>

            {/* 결재선 타임라인 (결재자1~4) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">결재선</h3>
              </div>
              <div className="p-5">
                <ApprovalTimeline line={approvalLine} history={history} />
              </div>
            </div>

            {(selected.referrerNames?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800">참조/협조</h3>
                </div>
                <div className="p-5 flex flex-wrap gap-2">
                  {selected.referrerNames!.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 결재확인: 제출 문서 미리보기 + 다운로드 + 결재/반려/메시지발송 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <FileCheck size={16} className="text-primary-600" />
                <h3 className="text-sm font-semibold text-slate-800">결재확인</h3>
              </div>

              <div className="p-5 space-y-4">
                {/* 두 번째 첨부파일 미리보기 */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    제출된 문서 미리보기 {secondAttachmentName && `· ${secondAttachmentName}`}
                  </div>
                  <div className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden">
                    <div className="max-h-[280px] overflow-y-auto p-4 text-sm text-slate-700 whitespace-pre-wrap">
                      {selected.notes
                        ? selected.notes
                        : secondAttachmentName
                          ? `[첨부: ${secondAttachmentName}]\n\n실제 파일은 서버에 저장된 문서로 조회됩니다.`
                          : "첨부된 문서가 없습니다. 기안 내용은 상단 요약에서 확인할 수 있습니다."}
                    </div>
                    <div className="px-4 py-2.5 border-t border-slate-200 bg-white flex items-center justify-between">
                      <span className="text-xs text-text-muted">
                        두 번째 첨부파일로 제출된 문서
                        {secondAttachmentName && ` (${secondAttachmentName})`}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        leftIcon={<Download size={12} />}
                        onClick={handleDownloadAttachment}
                      >
                        다운로드
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 하단: 새창보기 / 승인 / 반려 / 취소 / 메시지발송 */}
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leftIcon={<ExternalLink size={14} />}
                    onClick={openNewWindowPreview}
                  >
                    새창보기
                  </Button>
                  {canAct && (
                    <>
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        leftIcon={<Check size={14} />}
                        onClick={handleApprove}
                      >
                        승인
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        leftIcon={<X size={14} />}
                        onClick={openRejectPopup}
                      >
                        반려
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Send size={14} />}
                        onClick={() => setMessageModalOpen(true)}
                      >
                        메시지발송
                      </Button>
                    </>
                  )}
                  {canRevert && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      leftIcon={<RotateCcw size={14} />}
                      onClick={handleRevert}
                      className="text-warning-600 border-warning-200 hover:bg-warning-50"
                    >
                      취소
                    </Button>
                  )}
                  {selected.status !== "결재요청" && !canRevert && (
                    <p className="text-xs text-text-muted">
                      {selected.status === "결재완료" && "결재가 완료되었습니다."}
                      {selected.status === "반려" && "반려된 문서입니다."}
                      {selected.status === "결재중" && "다른 결재자가 처리할 때까지 대기 중입니다."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-muted">
            <FileText size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm">결재 문서를 선택하세요</p>
          </div>
        </div>
      )}

      {/* 메시지발송 모달: 기안자에게 수정·보완 요청 */}
      {messageModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">메시지 발송</h3>
              <p className="text-xs text-text-muted mt-0.5">
                기안자({selected.requesterName})에게 수정·보완 요청 메시지를 보냅니다.
              </p>
            </div>
            <div className="p-5">
              <textarea
                value={messageToDrafter}
                onChange={(e) => setMessageToDrafter(e.target.value)}
                placeholder="수정·보완이 필요한 내용을 입력하세요. 예: 2차 착수금 산정 근거 서류를 보완해 주세요."
                rows={4}
                className={cn(
                  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none",
                  "focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                )}
              />
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { setMessageModalOpen(false); setMessageToDrafter(""); }}
              >
                취소
              </Button>
              <Button
                type="button"
                className="flex-1"
                leftIcon={<Send size={14} />}
                onClick={handleSendMessage}
              >
                발송
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
