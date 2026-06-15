"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { PriorityCard } from "@/components/dashboard/PriorityCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { mockDashboardStats, mockApprovals } from "@/lib/mockData";
import { fetchCurrentUserName, fetchDashboardData } from "@/lib/dashboardData";
import type { CaseItem } from "@/lib/types";
import { formatDate, getDDay } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { StatusBadge, DDayBadge, ElectronicBadge } from "@/components/ui/badge";
import {
  FolderOpen, AlertTriangle, FileCheck, CreditCard,
  Coffee, TrendingUp, Clock, CalendarDays, ArrowRight, Megaphone, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";
import { fetchNotices } from "@/lib/noticeClient";

const NOTICE_PAGE_SIZE = 5;
const MY_TASKS_PAGE_SIZE = 15;
const APPROVAL_PAGE_SIZE = 7;
const UPCOMING_PAGE_SIZE = 7;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export default function DashboardPage() {
  const [deleteTarget, setDeleteTarget] = useState<{ caseNumber: string; id: string } | null>(null);
  const [noticeSearchQuery, setNoticeSearchQuery] = useState("");
  const [noticePage, setNoticePage] = useState(1);
  const [noticeList, setNoticeList] = useState<{ id: number; title: string; updatedAt: string }[]>([]);
  const [noticeTotalPages, setNoticeTotalPages] = useState(1);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [activeCaseCount, setActiveCaseCount] = useState(0);
  const [deadlineCases, setDeadlineCases] = useState<CaseItem[]>([]);
  const [myCases, setMyCases] = useState<CaseItem[]>([]);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [monthlyReceived, setMonthlyReceived] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDashboardLoading(true);
      try {
        const userName = await fetchCurrentUserName();
        const data = await fetchDashboardData(userName);
        if (cancelled) return;
        setActiveCaseCount(data.activeCaseCount);
        setMyCases(data.myCases);
        setDeadlineCases(data.deadlineCases);
        setPendingPaymentCount(data.pendingPaymentCount);
        setMonthlyReceived(data.monthlyReceived);
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNoticeList = useCallback(async () => {
    try {
      const { items, total } = await fetchNotices({
        q: noticeSearchQuery,
        page: noticePage,
        pageSize: NOTICE_PAGE_SIZE,
      });
      setNoticeList(
        items.map((n) => ({ id: n.numId, title: n.title, updatedAt: n.updatedAt }))
      );
      setNoticeTotalPages(Math.max(1, Math.ceil(total / NOTICE_PAGE_SIZE)));
    } catch {
      setNoticeList([]);
      setNoticeTotalPages(1);
    }
  }, [noticeSearchQuery, noticePage]);

  useEffect(() => {
    void loadNoticeList();
  }, [loadNoticeList]);

  useEffect(() => {
    const onFocus = () => void loadNoticeList();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadNoticeList]);

  const openNoticeDetail = (numId: number) => {
    window.open(`/board/notice/post/${numId}`, "notice", "width=760,height=820,scrollbars=yes,resizable=yes");
  };

  const [myTasksPage, setMyTasksPage] = useState(1);
  const myTasksTotalPages = Math.max(1, Math.ceil(myCases.length / MY_TASKS_PAGE_SIZE));
  const myTasksToShow = useMemo(
    () => myCases.slice((myTasksPage - 1) * MY_TASKS_PAGE_SIZE, myTasksPage * MY_TASKS_PAGE_SIZE),
    [myCases, myTasksPage]
  );

  const upcomingCases = useMemo(
    () =>
      deadlineCases.filter(
        (c) => c.nextDate && getDDay(c.nextDate) >= 0 && getDDay(c.nextDate) <= 14
      ),
    [deadlineCases]
  );

  const [approvalPage, setApprovalPage] = useState(1);
  const approvalTotalPages = Math.max(1, Math.ceil(mockApprovals.length / APPROVAL_PAGE_SIZE));
  const approvalsToShow = useMemo(
    () =>
      mockApprovals.slice(
        (approvalPage - 1) * APPROVAL_PAGE_SIZE,
        approvalPage * APPROVAL_PAGE_SIZE
      ),
    [approvalPage]
  );

  const [upcomingPage, setUpcomingPage] = useState(1);
  const upcomingTotalPages = Math.max(1, Math.ceil(upcomingCases.length / UPCOMING_PAGE_SIZE));
  const upcomingToShow = useMemo(
    () =>
      upcomingCases.slice(
        (upcomingPage - 1) * UPCOMING_PAGE_SIZE,
        upcomingPage * UPCOMING_PAGE_SIZE
      ),
    [upcomingCases, upcomingPage]
  );

  const openDeadlineManage = (nextDate?: string | null) => {
    if (!nextDate || typeof window === "undefined") return;
    const url = `/calendar/manage?date=${encodeURIComponent(nextDate)}`;
    const w = 520;
    const h = 720;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(
      url,
      "calendar-manage",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">

        {/* Page header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">업무 대시보드</h1>
            <p className="text-sm text-text-muted mt-0.5">
              {new Date().toLocaleDateString("ko-KR", {
                year: "numeric", month: "long", day: "numeric", weekday: "long",
              })}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Link href="/calendar">
              <Button variant="outline" size="sm" leftIcon={<CalendarDays size={14} />}>기일 달력</Button>
            </Link>
            <Link href="/cases/new">
              <Button size="sm" leftIcon={<FolderOpen size={14} />}>사건 등록</Button>
            </Link>
          </div>
        </motion.div>

        {/* 모바일 빠른 작업 */}
        <motion.div variants={itemVariants} className="sm:hidden grid grid-cols-2 gap-2">
          <Link href="/cases/new">
            <Button className="w-full min-h-[48px]" leftIcon={<FolderOpen size={18} />}>
              사건 등록
            </Button>
          </Link>
          <Link href="/calendar">
            <Button variant="outline" className="w-full min-h-[48px]" leftIcon={<CalendarDays size={18} />}>
              기일 달력
            </Button>
          </Link>
        </motion.div>

        {/* 공지사항 (검색 + 목록 + 페이지네이션) */}
        <motion.div variants={itemVariants}>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-primary-600" />
                <h2 className="text-sm font-semibold text-slate-800">공지사항</h2>
              </div>
              <Link
                href="/board/notice"
                className="text-xs text-primary-600 hover:underline flex items-center gap-1"
              >
                전체 보기 <ArrowRight size={12} />
              </Link>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={noticeSearchQuery}
                  onChange={(e) => {
                    setNoticeSearchQuery(e.target.value);
                    setNoticePage(1);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && setNoticePage(1)}
                  placeholder="제목·내용 검색"
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNoticePage(1)}
                  className="shrink-0"
                  leftIcon={<Search size={14} />}
                >
                  검색
                </Button>
              </div>
              <div className="divide-y divide-slate-50">
                {noticeList.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-text-muted">
                    {noticeSearchQuery.trim() ? "검색 결과가 없습니다." : "등록된 공지가 없습니다."}
                  </div>
                ) : (
                  noticeList.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openNoticeDetail(n.id)}
                      className="w-full flex items-center justify-between gap-3 px-2 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-slate-800 truncate flex-1">{n.title}</span>
                      <span className="text-xs text-text-muted shrink-0">
                        {new Date(n.updatedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    </button>
                  ))
                )}
              </div>
              {noticeTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs text-text-muted mr-1">목록:</span>
                  {Array.from({ length: noticeTotalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNoticePage(p)}
                      className={cn(
                        "min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors",
                        noticePage === p ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Priority deadline cards */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-danger-600" />
            <h2 className="text-sm font-semibold text-slate-800">기일 현황</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {dashboardLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl h-40 bg-slate-100 animate-pulse" />
              ))
            ) : (
              <>
                <PriorityCard cases={deadlineCases} type="today" />
                <PriorityCard cases={deadlineCases} type="3days" />
                <PriorityCard cases={deadlineCases} type="7days" />
              </>
            )}
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="전체 진행 사건"
            value={dashboardLoading ? "…" : activeCaseCount}
            unit="건"
            icon={<FolderOpen size={16} />}
            color="blue"
          />
          <StatCard title="결재 대기" value={mockDashboardStats.pendingApprovals} unit="건" icon={<FileCheck size={16} />} color="yellow" />
          <StatCard
            title="미수 청구"
            value={dashboardLoading ? "…" : pendingPaymentCount}
            unit="건"
            icon={<CreditCard size={16} />}
            color="red"
          />
          <StatCard
            title="이번 달 수납"
            value={dashboardLoading ? "…" : monthlyReceived}
            icon={<TrendingUp size={16} />}
            color="green"
            isAmount
          />
        </motion.div>

        {/* Main grid: 좌/우 세로 맞춤 */}
        <motion.div variants={itemVariants} className="grid grid-cols-12 gap-5 items-stretch min-h-[420px]">

          {/* My Tasks Table - 우측과 동일 세로 높이로 꽉 채움 */}
          <div className="col-span-12 lg:col-span-8 flex flex-col min-h-0">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden flex flex-col h-full min-h-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-primary-600" />
                  <h3 className="text-sm font-semibold text-slate-800">내 담당 사건</h3>
                  <span className="text-xs text-text-muted bg-slate-100 rounded-full px-2 py-0.5">
                    {dashboardLoading ? "…" : `${myCases.length}건`}
                  </span>
                </div>
                <Link href="/cases" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  전체 보기 <ArrowRight size={12} />
                </Link>
              </div>

              {dashboardLoading ? (
                <div className="flex flex-col items-center justify-center py-12 flex-1 text-sm text-text-muted">
                  사건 목록을 불러오는 중…
                </div>
              ) : myCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 flex-1">
                  <Coffee size={36} className="text-slate-300 mb-3" />
                  <div className="text-sm font-medium text-slate-600">담당 사건이 없습니다.</div>
                  <div className="text-xs text-text-muted mt-1">사건 관리에서 담당자로 배정된 사건이 표시됩니다.</div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50/70 text-xs text-text-muted font-medium">
                          <th className="text-left px-4 py-2.5">사건번호</th>
                          <th className="text-left px-4 py-2.5">사건명</th>
                          <th className="text-left px-4 py-2.5 hidden md:table-cell">법원</th>
                          <th className="text-left px-4 py-2.5">다음 기일</th>
                          <th className="text-left px-4 py-2.5">상태</th>
                          <th className="text-left px-4 py-2.5 hidden lg:table-cell">D-Day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myTasksToShow.map((c) => {
                        const dday = c.nextDate ? getDDay(c.nextDate) : null;
                        return (
                          <tr
                            key={c.id}
                            className={cn(
                              "border-t border-slate-50 text-sm transition-colors cursor-pointer group",
                              "hover:bg-primary-50/60",
                              dday !== null && dday <= 0 && "bg-danger-50/50"
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {c.isElectronic && <ElectronicBadge />}
                                <Link href={`/cases/${c.id}`} className="text-primary-600 font-semibold hover:underline text-sm">
                                  {c.caseNumber}
                                </Link>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-slate-800 font-medium">{c.caseName}</div>
                              <div className="text-xs text-text-muted">{c.clientName}</div>
                            </td>
                            <td className="px-4 py-3 text-text-muted hidden md:table-cell text-xs">{c.court}</td>
                            <td className="px-4 py-3">
                              {c.nextDate ? (
                                <div>
                                  <div className={cn("text-sm font-medium tabular-nums", dday !== null && dday <= 0 ? "text-danger-600" : "text-slate-800")}>
                                    {formatDate(c.nextDate)}
                                  </div>
                                  <div className="text-xs text-text-muted">{c.nextDateType}</div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">미정</span>
                              )}
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {dday !== null && <DDayBadge dday={dday} />}
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                  {myTasksTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-slate-100 shrink-0">
                      <span className="text-xs text-text-muted mr-1">목록:</span>
                      {Array.from({ length: myTasksTotalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setMyTasksPage(p)}
                          className={cn(
                            "min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors",
                            myTasksPage === p ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right sidebar - 우하단과 동일 높이 유지 */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 min-h-0">
            {/* Pending Approvals */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden shrink-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCheck size={14} className="text-warning-500" />
                  <span className="text-sm font-semibold text-slate-800">결재 대기</span>
                </div>
                <span className="text-xs bg-warning-100 text-warning-700 font-bold rounded-full px-2 py-0.5">
                  {mockApprovals.length}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {approvalsToShow.map((ap) => (
                  <Link key={ap.id} href="/approval" className="block px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="text-sm font-medium text-slate-800 truncate">{ap.title}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-text-muted">{ap.requesterName} 요청</span>
                      <span className="text-xs text-warning-600 font-medium">결재요청</span>
                    </div>
                  </Link>
                ))}
              </div>
              {approvalTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 px-4 py-2.5 border-t border-slate-100">
                  {Array.from({ length: approvalTotalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setApprovalPage(p)}
                      className={cn(
                        "min-w-[26px] h-6 px-1 rounded text-xs font-medium transition-colors",
                        approvalPage === p ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-4 py-2.5 bg-slate-50">
                <Link href="/approval" className="text-xs text-primary-600 font-medium hover:underline flex items-center gap-1">
                  결재함 바로가기 <ArrowRight size={11} />
                </Link>
              </div>
            </div>

            {/* Upcoming deadlines - 남는 세로 공간 채움 */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-primary-600" />
                  <span className="text-sm font-semibold text-slate-800">다가오는 기일</span>
                </div>
              </div>
              <div className="divide-y divide-slate-50 flex-1 min-h-0 overflow-auto">
                {dashboardLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-text-muted">기일을 불러오는 중…</div>
                ) : upcomingToShow.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-text-muted">14일 이내 예정된 기일이 없습니다.</div>
                ) : null}
                {upcomingToShow.map((c) => {
                  const dday = getDDay(c.nextDate!);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openDeadlineManage(c.nextDate)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors text-left"
                    >
                      <div className={cn(
                        "text-center w-10 shrink-0 rounded-lg py-1",
                        dday === 0 ? "bg-danger-100" : dday <= 3 ? "bg-warning-100" : "bg-slate-100"
                      )}>
                        <div className={cn(
                          "text-lg font-bold leading-none",
                          dday === 0 ? "text-danger-600" : dday <= 3 ? "text-warning-600" : "text-slate-700"
                        )}>
                          {new Date(c.nextDate!).getDate()}
                        </div>
                        <div className="text-xs text-text-muted">
                          {new Date(c.nextDate!).toLocaleDateString("ko-KR", { month: "short" })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{c.caseName}</div>
                        <div className="text-xs text-text-muted">{c.caseNumber} · {c.nextDateType}</div>
                      </div>
                      <DDayBadge dday={dday} />
                    </button>
                  );
                })}
              </div>
              {upcomingTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 px-4 py-2.5 border-t border-slate-100 shrink-0">
                  {Array.from({ length: upcomingTotalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setUpcomingPage(p)}
                      className={cn(
                        "min-w-[26px] h-6 px-1 rounded text-xs font-medium transition-colors",
                        upcomingPage === p ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </motion.div>
      </motion.div>

      {/* 2중 안전장치 삭제 모달 (예시 트리거) */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          toast.success(`사건 ${deleteTarget?.caseNumber}이 삭제되었습니다.`);
          setDeleteTarget(null);
        }}
        caseNumber={deleteTarget?.caseNumber ?? ""}
      />
    </div>
  );
}
