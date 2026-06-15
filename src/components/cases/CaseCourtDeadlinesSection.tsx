"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Phone, Scale, Loader2 } from "lucide-react";
import { CaseCourtDeadlineActions } from "@/components/cases/CaseCourtDeadlineActions";
import { DDayBadge } from "@/components/ui/badge";
import {
  type DeadlineRow,
  formatDeadlineDateTime,
  getDeadlineContactPhone,
  getDeadlineLocation,
  parseTimeFromDeadlineMemo,
  resolveStaffContactPhone,
} from "@/lib/deadlineDisplay";
import { cn, getDDay } from "@/lib/utils";
import type { CaseItem, StaffMember, Timeline } from "@/lib/types";

type DeadlineCard = {
  id: string;
  date: string;
  time: string;
  type: string;
  court: string;
  phone: string;
  status: "예정" | "완료";
};

function buildDeadlineCards(
  caseItem: CaseItem,
  deadlines: DeadlineRow[],
  staffList: StaffMember[]
): DeadlineCard[] {
  if (deadlines.length > 0) {
    return deadlines.map((d) => ({
      id: d.id,
      date: d.date,
      time: parseTimeFromDeadlineMemo(d.memo),
      type: d.type || "기일",
      court: getDeadlineLocation(d, caseItem.court),
      phone: getDeadlineContactPhone(d, caseItem.assignedStaff, staffList),
      status: d.date && getDDay(d.date) < 0 ? "완료" : "예정",
    }));
  }
  if (caseItem.nextDate) {
    return [
      {
        id: "fallback",
        date: caseItem.nextDate,
        time: "미정",
        type: caseItem.nextDateType || "기일",
        court: caseItem.court || "미정",
        phone: resolveStaffContactPhone(caseItem.assignedStaff, staffList) ?? "미등록",
        status: "예정",
      },
    ];
  }
  return [];
}

export function CaseCourtDeadlinesSection({
  caseItem,
  onSyncDone,
  refreshKey = 0,
  mobile = false,
}: {
  caseItem: CaseItem;
  onSyncDone?: (caseId: string, memos?: Timeline[]) => void;
  /** 기일연동·목록 갱신 후 재조회 */
  refreshKey?: number;
  mobile?: boolean;
}) {
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/deadlines?caseId=${encodeURIComponent(caseItem.id)}`, {
        credentials: "include",
      }).then((r) => r.json()),
      fetch("/api/staff", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([deadlineJson, staffJson]) => {
        if (cancelled) return;
        setDeadlines(Array.isArray(deadlineJson.data) ? deadlineJson.data : []);
        setStaffList(Array.isArray(staffJson.staff) ? staffJson.staff : []);
      })
      .catch(() => {
        if (!cancelled) {
          setDeadlines([]);
          setStaffList([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseItem.id, caseItem.nextDate, caseItem.nextDateType, refreshKey]);

  const rows = useMemo(
    () => buildDeadlineCards(caseItem, deadlines, staffList),
    [caseItem, deadlines, staffList]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Scale size={15} className="text-primary-600 shrink-0" />
          법원 기일 정보
          {rows.length > 0 && (
            <span className="text-xs font-normal text-slate-500">({rows.length})</span>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <CaseCourtDeadlineActions caseItem={caseItem} onSyncDone={onSyncDone} mobile={mobile} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin text-primary-500" />
          기일 정보 불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-text-muted">
          등록된 기일이 없습니다. 기일연동 버튼으로 법원 정보를 가져오세요.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((d) => {
            const dday = getDDay(d.date);
            return (
              <li key={d.id} className="px-3 py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 tabular-nums">
                      {formatDeadlineDateTime(d.date, d.time)}
                    </div>
                    <div className="text-xs text-primary-700 font-medium mt-0.5">{d.type}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {d.status === "예정" && <DDayBadge dday={dday} />}
                    <span
                      className={cn(
                        "text-[10px] font-medium rounded-full px-2 py-0.5",
                        d.status === "완료"
                          ? "bg-success-100 text-success-700"
                          : "bg-primary-100 text-primary-700"
                      )}
                    >
                      {d.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-1.5 text-xs text-slate-600">
                  <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{d.court}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Phone size={12} className="text-slate-400 shrink-0" />
                  {d.phone !== "미등록" ? (
                    <a
                      href={`tel:${d.phone.replace(/[^\d+]/g, "")}`}
                      className="text-primary-600 hover:underline tabular-nums"
                    >
                      {d.phone}
                    </a>
                  ) : (
                    <span className="text-text-muted">담당전화 미등록</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock size={11} className="shrink-0" />
                  {caseItem.court}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
