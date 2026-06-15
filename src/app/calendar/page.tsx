"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Scale, Link2, Upload, FileDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { downloadDeadlineExcelTemplate } from "@/lib/deadlineExcel";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportDeadlinesSearchResult } from "@/lib/listExcelExports";
import { toast } from "@/components/ui/toast";
import { trialSampleConsultations } from "@/lib/trialSampleData";
import { useTrialTenant } from "@/hooks/useTrialTenant";
import { getDDay } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { dedupeDeadlinesForDisplay } from "@/lib/deadlineDedup";
import { getDeadlinesForDate } from "@/lib/deadlineStorage";
import { openScourtMyCaseSearch } from "@/lib/scourtLinks";
import { usePageTabTitle } from "@/lib/tabTitle";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

/** API 기일 항목 (달력 셀 표시용) */
type ApiDeadlineItem = { id: string; date: string; caseNumber: string; type?: string };

export default function CalendarPage() {
  usePageTabTitle("기일관리");
  const { isTrial, loading: trialLoading } = useTrialTenant();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [apiDeadlines, setApiDeadlines] = useState<ApiDeadlineItem[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);

  const calendarReady = !trialLoading && !deadlinesLoading;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const fetchDeadlines = useCallback(() => {
    setDeadlinesLoading(true);
    fetch(`/api/deadlines?dateFrom=${dateFrom}&dateTo=${dateTo}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setApiDeadlines((json.data ?? []).map((d: { id: string; date: string; caseNumber?: string; type?: string }) => ({
        id: d.id,
        date: d.date,
        caseNumber: d.caseNumber ?? "",
        type: d.type,
      }))))
      .catch(() => setApiDeadlines([]))
      .finally(() => setDeadlinesLoading(false));
  }, [dateFrom, dateTo]);
  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);
  useEffect(() => {
    const onFocus = () => fetchDeadlines();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchDeadlines]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = lastDay;
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getConsultationsForDay = (day: number) => {
    if (!calendarReady || !isTrial) return [];
    const dateStr = getDateStr(day);
    return trialSampleConsultations.filter(
      (c) => c.consultationDate === dateStr && c.status !== "cancelled"
    );
  };

  const getDeadlinesForDay = (day: number) => {
    if (!calendarReady) return [];
    const dateStr = getDateStr(day);
    const local = getDeadlinesForDate(dateStr);
    const fromApi = apiDeadlines.filter((d) => d.date === dateStr).map((d) => ({
      id: d.id,
      date: d.date,
      caseNumber: d.caseNumber || d.type || "기일",
      type: d.type,
      status: "active" as const,
      createdAt: "",
      updatedAt: "",
    }));
    return dedupeDeadlinesForDisplay([...fromApi, ...local]);
  };

  const openManagePopup = (date: string) => {
    const url = `/calendar/manage?date=${date}`;
    window.open(url, "calendar-manage", "width=520,height=680,scrollbars=yes,resizable=yes");
  };
  const openManagePopupToday = () => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    openManagePopup(`${y}-${m}-${d}`);
  };

  const [downloading, setDownloading] = useState(false);
  const handleCourtSync = () => {
    openScourtMyCaseSearch();
    fetchDeadlines();
  };
  const openExcelUploadPopup = () => {
    const url = "/calendar/upload";
    window.open(url, "calendar-excel-upload", "width=420,height=320,scrollbars=yes,resizable=yes");
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "calendar-excel-upload-done") {
        fetchDeadlines();
        window.removeEventListener("message", onMessage);
      }
    };
    window.addEventListener("message", onMessage);
  };
  const handleExcelDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/deadlines?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const json = await res.json().catch(() => ({ data: [] }));
      const list = (json.data ?? []) as Array<{
        caseNumber?: string;
        clientName?: string;
        date?: string;
        type?: string;
        court?: string;
        memo?: string;
        assignedStaff?: string;
        isImmutable?: boolean;
        completedAt?: string | null;
      }>;
      if (exportDeadlinesSearchResult(list, `기일_${year}년_${month + 1}월`)) {
        toast.success(`${list.length}건을 엑셀로보냈습니다.`);
      }
    } finally {
      setDownloading(false);
    }
  }, [dateFrom, dateTo, year, month]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">기일 달력</h1>
          <p className="text-sm text-text-muted mt-0.5">{year}년 {MONTHS[month]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={openManagePopupToday}
            className="text-sm font-medium text-primary-600 hover:underline flex items-center gap-1"
          >
            <Scale size={14} /> 기일관리
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={handleCourtSync}
            className="text-sm font-medium text-slate-700 hover:text-primary-600 hover:underline flex items-center gap-1"
            title="대법원 나의사건검색 열기 후 달력 기일 최신으로 갱신"
          >
            <Link2 size={14} /> 법원기일연동
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={openExcelUploadPopup}
            className="text-sm font-medium text-slate-700 hover:text-primary-600 hover:underline flex items-center gap-1"
            title="기일 엑셀 업로드 창 열기"
          >
            <Upload size={14} /> 엑셀업로드
          </button>
          <span className="text-slate-300">|</span>
          <SearchResultExcelButton
            size="sm"
            count={apiDeadlines.length}
            loading={downloading}
            onExport={handleExcelDownload}
          />
          <button
            type="button"
            onClick={downloadDeadlineExcelTemplate}
            className="text-sm font-medium text-slate-700 hover:text-primary-600 hover:underline flex items-center gap-1"
            title="기일 일괄등록 양식 다운로드"
          >
            <FileDown size={14} /> 양식
          </button>
          <span className="text-slate-300">|</span>
          <Link href="/consultation" className="text-sm font-medium text-primary-600 hover:underline flex items-center gap-1">
            <CalendarDays size={14} /> 상담일정
          </Link>
          <div className="flex items-center gap-2 ml-1 sm:ml-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="text-sm font-medium text-primary-600 hover:underline px-2"
          >
            이번달
          </button>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <ChevronRight size={16} />
          </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-center py-3 text-xs font-semibold uppercase tracking-wide",
                i === 0 ? "text-danger-500" : i === 6 ? "text-primary-500" : "text-slate-500"
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isWeekend = idx % 7 === 0 || idx % 7 === 6;
            const consultations = day ? getConsultationsForDay(day) : [];
            const deadlines = day ? getDeadlinesForDay(day) : [];
            const dateStr = day ? getDateStr(day) : "";
            const hasUrgent =
              calendarReady &&
              deadlines.some((d) => {
                const dday = getDDay(d.date);
                return dday !== null && dday <= 0;
              });
            const totalCount = deadlines.length;

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-24 p-2 border-b border-r border-slate-100 transition-colors",
                  day ? "hover:bg-slate-50" : "bg-slate-50/50",
                  isToday && "bg-primary-50/60",
                  hasUrgent && "bg-danger-50/30"
                )}
              >
                {day ? (
                  <>
                    <div className={cn(
                      "w-6 h-6 flex items-center justify-center text-sm font-medium rounded-full mb-1",
                      isToday ? "bg-primary-600 text-white" :
                      isWeekend ? (idx % 7 === 0 ? "text-danger-500" : "text-primary-500") : "text-slate-700"
                    )}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {!calendarReady ? (
                        <div className="h-4 rounded bg-slate-100/80 animate-pulse" aria-hidden />
                      ) : (
                        <>
                      {deadlines.slice(0, 3).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={(e) => { e.preventDefault(); openManagePopup(dateStr); }}
                          className="w-full text-left text-xs rounded px-1.5 py-0.5 truncate font-medium block bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          {d.caseNumber}
                        </button>
                      ))}
                      {deadlines.length > 3 && (
                        <button
                          type="button"
                          onClick={() => openManagePopup(dateStr)}
                          className="text-xs text-text-muted pl-1 hover:underline"
                        >
                          +{totalCount - 3}건
                        </button>
                      )}
                      {totalCount === 0 && (
                        <button
                          type="button"
                          onClick={() => openManagePopup(dateStr)}
                          className="text-xs text-slate-400 hover:text-primary-600 hover:underline"
                        >
                          기일 보기/등록
                        </button>
                      )}
                      {consultations.length > 0 && (
                        <Link
                          href={`/consultation?date=${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
                          className="text-xs text-warning-600 hover:underline block truncate"
                        >
                          상담 {consultations.length}건
                        </Link>
                      )}
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-300 font-medium">
                    {daysInPrevMonth - firstDay + idx + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
