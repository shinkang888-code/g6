"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MessageSquare, FileText, DollarSign,
  Scale, Sparkles, X,
  FileIcon, Download, Eye, AlertCircle, MoreVertical, Trash2, Edit, ExternalLink, Paperclip,
  Clock, MapPin, Phone
} from "lucide-react";
import { copyAndOpenScourtSearch } from "@/lib/scourtLinks";
import { mockTimeline } from "@/lib/mockData";
import { applyCourtSyncDeadlineMemo } from "@/lib/caseDeadlineMemo";
import {
  getInitialMemosFromMock,
  persistCaseMemos,
  readCaseMemosForCase,
  subscribeCaseMemoChanges,
} from "@/lib/caseScopedStorage";
import { CaseMemoTab } from "@/components/cases/CaseMemoTab";
import { loadCourtOverrides } from "@/lib/caseCourtOverrides";
import { pickNextDeadline } from "@/lib/caseDeadlineMemo";
import {
  type DeadlineRow,
  formatDeadlineDateTime,
  getDeadlineContactPhone,
  getDeadlineLocation,
  parseTimeFromDeadlineMemo,
  resolveStaffContactPhone,
} from "@/lib/deadlineDisplay";
import type { CaseItem, StaffMember } from "@/lib/types";
import { isCaseDetailPopupWindow } from "@/lib/caseDetailPopup";
import { cn, formatDate, getDDay, formatAmount, formatFileSize } from "@/lib/utils";
import { StatusBadge, DDayBadge, ElectronicBadge, ImmutableBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StaffChips } from "@/components/cases/StaffChips";
import { CaseInstitutionDetailPanel } from "@/components/cases/CaseInstitutionDetailPanel";
import { maskCaseFields } from "@/lib/trialNameMask";
import { CasePartyDetailPanel } from "@/components/cases/CasePartyDetailPanel";
import { formatCourtDivisionContactLine } from "@/lib/courtContactFormat";
import { ConfirmDeleteModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";
import { CaseFinanceTab } from "@/components/finance/CaseFinanceTab";
import type { Timeline } from "@/lib/types";

type TabId = "memo" | "dates" | "documents" | "finance";

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "memo", label: "메모장", icon: <MessageSquare size={14} /> },
  { id: "dates", label: "기일 목록", icon: <Scale size={14} /> },
  { id: "documents", label: "문서함", icon: <FileIcon size={14} /> },
  { id: "finance", label: "수임료", icon: <DollarSign size={14} /> },
];

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [isPopupEmbed, setIsPopupEmbed] = useState(() => searchParams.get("popup") === "1");

  useEffect(() => {
    setIsPopupEmbed(
      searchParams.get("popup") === "1" || isCaseDetailPopupWindow(window.location.pathname)
    );
  }, [searchParams]);
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [caseLoading, setCaseLoading] = useState(true);
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [courtOverrides, setCourtOverrides] = useState<Record<string, string>>(() => loadCourtOverrides());

  useEffect(() => {
    setCourtOverrides(loadCourtOverrides());
  }, [id]);

  const fetchCaseItem = useCallback(() => {
    if (!id) {
      setCaseLoading(false);
      return;
    }
    setCaseLoading(true);
    fetch(`/api/admin/cases?id=${encodeURIComponent(id)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: { data?: CaseItem[] }) => {
        const list = Array.isArray(json.data) ? json.data : [];
        const one = list.length > 0 ? list[0] : null;
        setCaseItem(one);
      })
      .catch(() => setCaseItem(null))
      .finally(() => setCaseLoading(false));
  }, [id]);

  useEffect(() => {
    fetchCaseItem();
  }, [fetchCaseItem]);

  useEffect(() => {
    if (!id) {
      setDeadlines([]);
      return;
    }
    fetch(`/api/deadlines?caseId=${encodeURIComponent(id)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: { data?: DeadlineRow[] }) => {
        setDeadlines(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => setDeadlines([]));
  }, [id]);

  useEffect(() => {
    fetch("/api/staff", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { staff?: StaffMember[] }) => {
        setStaffList(Array.isArray(json.staff) ? json.staff : []);
      })
      .catch(() => setStaffList([]));
  }, []);

  const displayCase = caseItem
    ? maskCaseFields({
        ...caseItem,
        court: courtOverrides[caseItem.id] ?? caseItem.court,
      })
    : null;
  const timeline = caseItem ? mockTimeline.filter((t) => t.caseId === caseItem.id) : [];
  const nextDeadline = pickNextDeadline(deadlines);
  const nextDeadlineTime = nextDeadline ? parseTimeFromDeadlineMemo(nextDeadline.memo) : "미정";
  const nextDeadlineLocation = nextDeadline
    ? getDeadlineLocation(nextDeadline, displayCase?.court ?? "")
    : displayCase?.court ?? "미정";
  const nextDeadlinePhone = nextDeadline && displayCase
    ? getDeadlineContactPhone(nextDeadline, displayCase.assignedStaff, staffList)
    : displayCase
      ? (resolveStaffContactPhone(displayCase.assignedStaff, staffList) ?? "미등록")
      : "미등록";
  const nextDeadlineDate = nextDeadline?.date ?? displayCase?.nextDate ?? null;
  const nextDeadlineType = nextDeadline?.type ?? displayCase?.nextDateType ?? "기일";
  const dday = nextDeadlineDate ? getDDay(nextDeadlineDate) : null;

  const [activeTab, setActiveTab] = useState<TabId>("memo");
  const [memos, setMemos] = useState<Timeline[]>([]);
  const [drawerOpen, setDrawerOpen] = useState<"ai" | "doc" | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setMemos([]);
      return;
    }
    const mockSeed = getInitialMemosFromMock(mockTimeline);
    setMemos(readCaseMemosForCase(id, mockSeed));
  }, [id]);

  const updateMemos = useCallback(
    (next: Timeline[]) => {
      if (!id) return;
      setMemos(next);
      persistCaseMemos(id, next, getInitialMemosFromMock(mockTimeline));
    },
    [id]
  );

  useEffect(() => {
    if (!id) return;
    return subscribeCaseMemoChanges((changedCaseId) => {
      if (changedCaseId && changedCaseId !== id) return;
      const fresh = readCaseMemosForCase(id, getInitialMemosFromMock(mockTimeline));
      setMemos((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
    });
  }, [id]);

  useEffect(() => {
    if (!caseItem) return;
    let cancelled = false;
    applyCourtSyncDeadlineMemo(caseItem.id, {
      caseNumber: caseItem.caseNumber,
      clientName: caseItem.clientName,
      court: caseItem.court,
      nextDate: caseItem.nextDate ?? undefined,
      nextDateType: caseItem.nextDateType ?? undefined,
    }).then((result) => {
      if (!cancelled && result?.memos?.length) updateMemos(result.memos);
    });
    return () => {
      cancelled = true;
    };
  }, [
    caseItem?.id,
    caseItem?.caseNumber,
    caseItem?.clientName,
    caseItem?.court,
    caseItem?.nextDate,
    caseItem?.nextDateType,
    updateMemos,
  ]);

  if (caseLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-sm text-text-muted">사건 정보를 불러오는 중...</div>
      </div>
    );
  }
  if (!displayCase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-2">
        <div className="text-sm text-slate-600">사건을 찾을 수 없습니다.</div>
        <Link href="/cases" className="text-primary-600 hover:underline text-sm">사건 목록으로</Link>
      </div>
    );
  }

  return (
    <div className={cn("flex overflow-hidden", isPopupEmbed ? "h-screen" : "h-full")}>
      {/* ── Left: Case Context Pane ── */}
      <aside className="hidden lg:flex w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-white overflow-y-auto">
        <div className="p-5 space-y-5">
          {/* Back */}
          {!isPopupEmbed && (
            <Link href="/cases" className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary-600 transition-colors">
              <ArrowLeft size={13} /> 사건 목록
            </Link>
          )}

          {/* Title */}
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {displayCase.isElectronic && <ElectronicBadge />}
              {displayCase.isImmutable && <ImmutableBadge />}
              <StatusBadge status={displayCase.status} />
              {displayCase.isUrgent && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-danger-100 text-danger-700">긴급</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{displayCase.caseNumber}</h1>
            <p className="text-sm text-slate-600 mt-0.5 leading-snug">{displayCase.caseName}</p>
          </div>

          {/* Next Deadline */}
          {nextDeadlineDate && (
            <div className={cn(
              "rounded-xl p-3.5 border space-y-2.5",
              dday !== null && dday <= 0 ? "bg-danger-50 border-danger-200 danger-pulse" :
              dday !== null && dday <= 3 ? "bg-warning-50 border-warning-200" :
              "bg-primary-50 border-primary-200"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">다음 기일</span>
                {dday !== null && <DDayBadge dday={dday} />}
              </div>
              <div className="text-xs font-medium text-slate-500">{nextDeadlineType}</div>
              <DeadlineDetailRow
                icon={<Clock size={13} />}
                label="일시"
                value={formatDeadlineDateTime(nextDeadlineDate, nextDeadlineTime)}
              />
              <DeadlineDetailRow
                icon={<MapPin size={13} />}
                label="장소"
                value={nextDeadlineLocation}
              />
              <DeadlineDetailRow
                icon={<Phone size={13} />}
                label="담당전화"
                value={nextDeadlinePhone}
                isPhone={nextDeadlinePhone !== "미등록"}
              />
            </div>
          )}

          {/* Case details */}
          <div className="space-y-3">
            <SectionTitle>사건 정보</SectionTitle>
            <InfoItem icon="📂" label="사건종류" value={displayCase.caseType || "-"} />
            <InfoItem icon="🏛️" label="계속기관" value={displayCase.court || "-"} />
            {displayCase.trialLevel && (
              <InfoItem icon="📊" label="심급" value={displayCase.trialLevel} />
            )}
            {formatCourtDivisionContactLine(displayCase.courtDivision) && (
              <InfoItem
                icon="📞"
                label="기관연락처"
                value={formatCourtDivisionContactLine(displayCase.courtDivision)!}
              />
            )}
            <CaseInstitutionDetailPanel
              caseId={id}
              activeStage={displayCase.activeStage}
              courtDivision={displayCase.courtDivision}
            />
            <InfoItem icon="📋" label="진행상태" value={displayCase.status} />
            {displayCase.notes?.trim() && (
              <InfoItem icon="📝" label="비고" value={displayCase.notes.trim()} />
            )}
            {displayCase.updatedAt && (
              <InfoItem icon="🕐" label="최종 수정" value={formatDate(displayCase.updatedAt, "time")} />
            )}
          </div>

          {/* Info */}
          <div className="space-y-3">
            <SectionTitle>당사자 정보</SectionTitle>
            <InfoItem
              icon="👤"
              label="의뢰인"
              value={
                displayCase.clientPosition
                  ? `${displayCase.clientName} (${displayCase.clientPosition})`
                  : displayCase.clientName
              }
            />
            {displayCase.opponentName?.trim() && (
              <InfoItem icon="⚔️" label="상대방" value={displayCase.opponentName} />
            )}
            <CasePartyDetailPanel
              caseId={id}
              fallbackClientName={displayCase.clientName}
              fallbackClientPosition={displayCase.clientPosition}
              fallbackOpponentName={displayCase.opponentName}
            />
            <InfoItem icon="🏛️" label="기관" value={displayCase.court} />
            <button
              type="button"
              onClick={() =>
                copyAndOpenScourtSearch(
                  displayCase.caseNumber,
                  displayCase.clientName,
                  displayCase.court,
                  displayCase.id
                )
              }
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:border-primary-200 hover:text-primary-600 transition-colors"
              title="사건번호·법원·당사자명 복사 후 대법원 나의 사건검색 열기"
            >
              <ExternalLink size={12} />
              법원 나의 사건검색에서 조회
            </button>

            <SectionTitle>수임 정보</SectionTitle>
            <InfoItem icon="📅" label="수임일" value={formatDate(displayCase.receivedDate)} />
            {/* 담당: 클릭 시 이 사건 상세(타임라인) 새 창 */}
            <div className="flex gap-2">
              <span className="text-base flex-shrink-0 mt-0.5">⚖️</span>
              <div>
                <div className="text-xs text-text-muted">담당</div>
                {displayCase.assignedStaff ? (
                  <Link
                    href={`/cases/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary-600 hover:underline"
                  >
                    {displayCase.assignedStaff}
                  </Link>
                ) : (
                  <div className="text-sm font-medium text-slate-800">-</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted mb-1.5">담당 직원</div>
              <StaffChips staffStr={displayCase.assistants} max={4} />
            </div>

            <SectionTitle>수임료 현황</SectionTitle>
            <FinanceItem label="수임료" value={formatAmount(displayCase.amount)} />
            <FinanceItem label="수납액" value={formatAmount(displayCase.receivedAmount)} positive />
            {displayCase.pendingAmount > 0 && (
              <FinanceItem label="미수금" value={formatAmount(displayCase.pendingAmount)} danger />
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">

        {/* Top toolbar with tabs */}
        <div className="bg-white border-b border-slate-200 flex-shrink-0">
          {/* Mobile breadcrumb */}
          <div className="lg:hidden flex items-center gap-2 px-4 pt-3 pb-1">
            <Link href="/cases" className="flex items-center gap-1 text-xs text-text-muted hover:text-primary-600">
              <ArrowLeft size={12} /> 목록
            </Link>
            <span className="text-slate-300 text-xs">/</span>
            <span className="text-xs font-medium text-slate-700 truncate">{displayCase.caseNumber}</span>
          </div>

          {/* Case title row */}
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900">{displayCase.caseNumber}</span>
                  {displayCase.isElectronic && <ElectronicBadge />}
                </div>
                <div className="text-xs text-text-muted truncate">{displayCase.caseName} · {displayCase.court}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant={drawerOpen === "ai" ? "primary" : "outline"}
                size="sm"
                leftIcon={<Sparkles size={13} />}
                onClick={() => setDrawerOpen(drawerOpen === "ai" ? null : "ai")}
                className="hidden sm:flex"
              >
                AI 요약
              </Button>
              <Button
                variant={drawerOpen === "doc" ? "primary" : "outline"}
                size="sm"
                leftIcon={<FileText size={13} />}
                onClick={() => setDrawerOpen(drawerOpen === "doc" ? null : "doc")}
                className="hidden sm:flex"
              >
                문서함
              </Button>
              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <MoreVertical size={16} />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 w-44 overflow-hidden"
                    >
                      <Link href={`/cases/${displayCase.id}/edit`} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                        <Edit size={14} /> 사건 수정
                      </Link>
                      <button
                        className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-danger-600 hover:bg-danger-50 w-full text-left"
                        onClick={() => { setDeleteModalOpen(true); setMenuOpen(false); }}
                      >
                        <Trash2 size={14} /> 사건 삭제
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center border-t border-slate-100 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "text-primary-600 border-primary-600"
                    : "text-text-muted border-transparent hover:text-slate-700 hover:border-slate-300"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {activeTab === "memo" && displayCase && (
                <CaseMemoTab
                  caseItem={displayCase}
                  memos={memos}
                  onMemosChange={updateMemos}
                />
              )}
              {activeTab === "dates" && displayCase && (
                <DatesTab
                  caseItem={displayCase}
                  deadlines={deadlines}
                  staffList={staffList}
                />
              )}
              {activeTab === "documents" && <DocumentsTab timeline={timeline} />}
              {activeTab === "finance" && caseItem && (
                <CaseFinanceTab caseItem={caseItem} onCaseUpdated={fetchCaseItem} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Right: Smart Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden hidden lg:flex"
          >
            <div className="w-80 h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-800">
                  {drawerOpen === "ai" ? "AI 사건 요약" : "문서함"}
                </span>
                <button onClick={() => setDrawerOpen(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {drawerOpen === "ai" && caseItem ? <AIDrawer caseItem={caseItem} /> : <DocDrawer timeline={timeline} />}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => toast.error(`사건 ${displayCase.caseNumber}이 삭제되었습니다.`)}
        caseNumber={displayCase.caseNumber}
        title={`"${displayCase.caseName}" 사건을 삭제하시겠습니까?`}
      />
    </div>
  );
}

/* ────────────── Tab Components ────────────── */

function DatesTab({
  caseItem,
  deadlines,
  staffList,
}: {
  caseItem: CaseItem;
  deadlines: DeadlineRow[];
  staffList: StaffMember[];
}) {
  const rows = deadlines.length > 0
    ? deadlines.map((d) => ({
        id: d.id,
        date: d.date,
        time: parseTimeFromDeadlineMemo(d.memo),
        type: d.type || "기일",
        court: getDeadlineLocation(d, caseItem.court),
        phone: getDeadlineContactPhone(d, caseItem.assignedStaff, staffList),
        status: d.date && getDDay(d.date) < 0 ? "완료" : "예정",
      }))
    : caseItem.nextDate
      ? [{
          id: "fallback",
          date: caseItem.nextDate,
          time: "미정",
          type: caseItem.nextDateType || "기일",
          court: caseItem.court,
          phone: resolveStaffContactPhone(caseItem.assignedStaff, staffList) ?? "미등록",
          status: "예정",
        }]
      : [];

  return (
    <div className="max-w-3xl mx-auto px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">기일 목록 {rows.length > 0 && `(${rows.length})`}</h3>
        <Button size="sm" variant="outline" leftIcon={<Scale size={13} />}>기일 추가</Button>
      </div>
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center text-sm text-text-muted">
          등록된 기일이 없습니다.
        </div>
      ) : (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-xs text-text-muted font-medium border-b border-slate-100">
              <th className="text-left px-4 py-3">일시</th>
              <th className="text-left px-4 py-3">종류</th>
              <th className="text-left px-4 py-3">장소</th>
              <th className="text-left px-4 py-3">담당전화</th>
              <th className="text-left px-4 py-3">D-Day</th>
              <th className="text-left px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const dday = getDDay(d.date);
              return (
                <tr key={d.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 tabular-nums">
                    {formatDeadlineDateTime(d.date, d.time)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{d.type}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{d.court}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 tabular-nums">
                    {d.phone !== "미등록" ? (
                      <a href={`tel:${d.phone.replace(/[^\d+]/g, "")}`} className="text-primary-600 hover:underline">
                        {d.phone}
                      </a>
                    ) : (
                      <span className="text-text-muted">미등록</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.status === "예정" && <DDayBadge dday={dday} />}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-xs font-medium rounded-full px-2 py-0.5",
                      d.status === "완료" ? "bg-success-100 text-success-700" : "bg-primary-100 text-primary-700"
                    )}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function DocumentsTab({ timeline }: { timeline: Timeline[] }) {
  const allFiles = timeline.flatMap((t) => t.attachments ?? []);

  return (
    <div className="max-w-2xl mx-auto px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">문서함 ({allFiles.length}개)</h3>
        <Button size="sm" variant="outline" leftIcon={<Paperclip size={13} />}>파일 업로드</Button>
      </div>
      <div className="space-y-2">
        {allFiles.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <FileIcon size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm">등록된 문서가 없습니다.</p>
          </div>
        ) : (
          allFiles.map((file) => (
            <div key={file.id} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-card hover:shadow-card-hover transition-all group">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0",
                file.mimeType.includes("pdf") ? "bg-danger-100 text-danger-700" :
                file.mimeType.includes("excel") ? "bg-success-100 text-success-700" :
                "bg-primary-100 text-primary-700"
              )}>
                {file.mimeType.includes("pdf") ? "PDF" : file.mimeType.includes("excel") ? "XLS" : "FILE"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{file.fileName}</div>
                <div className="text-xs text-text-muted">{formatFileSize(file.fileSize)}</div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 hover:bg-slate-100 rounded-lg"><Eye size={14} className="text-slate-500" /></button>
                <button className="p-1.5 hover:bg-slate-100 rounded-lg"><Download size={14} className="text-slate-500" /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AIDrawer({ caseItem }: { caseItem: CaseItem }) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-primary-50 to-violet-50 rounded-xl p-4 border border-primary-100">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-primary-600" />
          <span className="text-sm font-semibold text-primary-800">AI 사건 요약</span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          {caseItem.caseName} 사건으로 현재 진행 중입니다.
          {caseItem.nextDate && ` ${formatDate(caseItem.nextDate)} ${(caseItem as any).nextDateType || "기일"}이 예정되어 있습니다.`}
          {caseItem.pendingAmount > 0 && ` 미수금 ${formatAmount(caseItem.pendingAmount)} 처리가 필요합니다.`}
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">주요 이슈</div>
        {caseItem.nextDate && getDDay(caseItem.nextDate) <= 3 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium text-danger-600 bg-danger-50 border-danger-200">
            <AlertCircle size={13} /> 기일 임박 — {(caseItem as any).nextDateType || "기일"} D-{getDDay(caseItem.nextDate)}
          </div>
        )}
        {caseItem.pendingAmount > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium text-warning-600 bg-warning-50 border-warning-200">
            <DollarSign size={13} /> 미수금 {formatAmount(caseItem.pendingAmount)} 미처리
          </div>
        )}
        {caseItem.isElectronic && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium text-violet-600 bg-violet-50 border-violet-200">
            <Scale size={13} /> 전자사건 — 전자제출 시스템 확인 필요
          </div>
        )}
      </div>
    </div>
  );
}

function DocDrawer({ timeline }: { timeline: Timeline[] }) {
  const allFiles = timeline.flatMap((t) => t.attachments ?? []);
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">문서 {allFiles.length}개</div>
      {allFiles.map((file) => (
        <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold", file.mimeType.includes("pdf") ? "bg-danger-100 text-danger-600" : "bg-success-100 text-success-600")}>
            {file.mimeType.includes("pdf") ? "PDF" : "XLS"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-700 truncate">{file.fileName}</div>
            <div className="text-xs text-text-muted">{formatFileSize(file.fileSize)}</div>
          </div>
          <Download size={14} className="text-slate-400 hover:text-primary-600 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

function DeadlineDetailRow({
  icon,
  label,
  value,
  isPhone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isPhone?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-500 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] text-text-muted">{label}</div>
        {isPhone ? (
          <a
            href={`tel:${value.replace(/[^\d+]/g, "")}`}
            className="text-sm font-semibold text-primary-700 hover:underline tabular-nums"
          >
            {value}
          </a>
        ) : (
          <div className="text-sm font-semibold text-slate-900 leading-snug">{value}</div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-1 border-t border-slate-100">{children}</div>;
}
function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <div className="text-xs text-text-muted">{label}</div>
        <div className="text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}
function FinanceItem({ label, value, positive, danger }: { label: string; value: string; positive?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={cn("font-semibold tabular-nums", positive ? "text-success-600" : danger ? "text-danger-600" : "text-slate-800")}>{value}</span>
    </div>
  );
}
