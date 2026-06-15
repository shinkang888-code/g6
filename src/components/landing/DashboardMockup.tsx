"use client";

import { CalendarDays, FileCheck, FolderOpen, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  glow?: "blue" | "navy" | "gradient";
};

const CASES = [
  { no: "2025가단12345", name: "손해배상(기)", client: "김○○", dday: "D-2", urgent: true },
  { no: "2025드단67890", name: "이혼", client: "이○○", dday: "D-5", urgent: false },
  { no: "2024나98765", name: "대여금", client: "박○○", dday: "D-12", urgent: false },
];

const DEADLINES = [
  { day: "9", label: "변론기일", case: "2025가단12345" },
  { day: "11", label: "제출기한", case: "2025드단67890" },
  { day: "14", label: "불변기한", case: "2024나98765" },
];

export function DashboardMockup({ className, glow = "blue" }: Props) {
  const glowClass =
    glow === "navy"
      ? "from-[#0A1628]/10 via-sky-100/40 to-blue-50"
      : glow === "gradient"
        ? "from-indigo-100/60 via-sky-50 to-white"
        : "from-sky-100/80 via-blue-50/60 to-white";

  return (
    <div className={cn("relative", className)}>
      <div className={cn("absolute -inset-4 rounded-[2rem] bg-gradient-to-b blur-2xl", glowClass)} />
      <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_24px_80px_-20px_rgba(15,23,42,0.25)]">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="mx-auto rounded-md bg-white px-3 py-1 text-[10px] text-slate-400">
            lawygo.app — 업무 대시보드
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[1.1fr_0.9fr] sm:p-5">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "오늘 기일", value: "2건", color: "text-red-600 bg-red-50" },
                { label: "3일 이내", value: "5건", color: "text-amber-600 bg-amber-50" },
                { label: "진행 사건", value: "128건", color: "text-blue-600 bg-blue-50" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-100 bg-white p-2.5">
                  <div className="text-[10px] text-slate-500">{s.label}</div>
                  <div className={cn("mt-1 text-sm font-bold", s.color.split(" ")[0])}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-100 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-50 px-3 py-2">
                <FolderOpen size={12} className="text-primary-600" />
                <span className="text-xs font-semibold text-slate-800">내 담당 사건</span>
              </div>
              <div className="divide-y divide-slate-50">
                {CASES.map((c) => (
                  <div key={c.no} className="flex items-center justify-between px-3 py-2.5 text-[11px]">
                    <div className="min-w-0">
                      <div className="font-semibold text-primary-700">{c.no}</div>
                      <div className="truncate text-slate-700">{c.name} · {c.client}</div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        c.urgent ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {c.dday}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays size={12} className="text-primary-600" />
                <span className="text-xs font-semibold text-slate-800">6월 기일</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-slate-400">
                {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => {
                  const hit = DEADLINES.find((x) => Number(x.day) === d);
                  return (
                    <div
                      key={d}
                      className={cn(
                        "rounded-md py-1",
                        hit ? "bg-primary-600 font-bold text-white" : "text-slate-600"
                      )}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-50 px-3 py-2">
                <FileCheck size={12} className="text-amber-500" />
                <span className="text-xs font-semibold text-slate-800">결재 대기</span>
                <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">3</span>
              </div>
              <div className="space-y-2 p-3 text-[11px]">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">소장 제출 승인 요청</div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">자료 열람 결재</div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <Megaphone size={12} className="text-primary-600" />
              공지: 기일 관리 팁 업데이트
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
