"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  FileCheck,
  FolderOpen,
  Home,
  Megaphone,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = ["사건 정보", "기일 관리", "메모·자료"] as const;

const CASES = [
  { no: "2025가단12345", name: "손해배상(기)", client: "김○○", dday: "D-2", hot: true },
  { no: "2025드단67890", name: "이혼", client: "이○○", dday: "D-5", hot: false },
  { no: "2024나98765", name: "대여금", client: "박○○", dday: "D-12", hot: false },
];

const DEADLINES = [
  { date: "6/9", type: "변론기일", caseNo: "2025가단12345", dday: "D-Day" },
  { date: "6/11", type: "서면제출", caseNo: "2025드단67890", dday: "D-2" },
  { date: "6/14", type: "불변기한", caseNo: "2024나98765", dday: "D-5" },
];

export function WwwDashboardMockup() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("기일 관리");

  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-b from-sky-200/50 via-blue-100/30 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_32px_64px_-16px_rgba(10,22,40,0.18)]">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-xs text-slate-400 shadow-sm ring-1 ring-slate-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            lawygo.app — 업무 대시보드
          </div>
        </div>

        <div className="flex min-h-[340px]">
          <aside className="hidden w-14 shrink-0 flex-col items-center gap-3 border-r border-slate-100 bg-slate-50/80 py-4 sm:flex">
            {[Home, Search, FolderOpen, CalendarDays, FileCheck, Settings].map((Icon, i) => (
              <div
                key={i}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                  i === 0 ? "bg-[#0A1628] text-white shadow-md" : "text-slate-400 hover:bg-white hover:text-slate-600"
                )}
              >
                <Icon size={16} />
              </div>
            ))}
          </aside>

          <div className="grid flex-1 gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-r border-slate-100 p-4 sm:p-5">
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { label: "오늘 기일", val: "2", tone: "bg-red-50 text-red-600 ring-red-100" },
                  { label: "3일 이내", val: "5", tone: "bg-amber-50 text-amber-600 ring-amber-100" },
                  { label: "진행 사건", val: "128", tone: "bg-blue-50 text-blue-600 ring-blue-100" },
                ].map((c) => (
                  <div key={c.label} className={cn("rounded-xl p-2.5 ring-1", c.tone)}>
                    <div className="text-[10px] font-medium opacity-80">{c.label}</div>
                    <div className="text-lg font-bold tabular-nums">{c.val}</div>
                  </div>
                ))}
              </div>

              <div className="mb-3 flex items-center gap-2">
                <FolderOpen size={13} className="text-primary-600" />
                <span className="text-xs font-bold text-slate-800">내 담당 사건</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">15건</span>
              </div>

              <div className="space-y-1">
                {CASES.map((c) => (
                  <div
                    key={c.no}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors",
                      c.hot ? "bg-red-50/80 ring-1 ring-red-100" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-primary-700">{c.no}</div>
                      <div className="truncate text-[11px] text-slate-600">
                        {c.name} · {c.client}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        c.hot ? "bg-red-500 text-white" : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {c.dday}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <Megaphone size={12} className="text-primary-600" />
                <span className="text-[11px] text-slate-600">공지: 기일 관리 가이드 업데이트</span>
              </div>
            </div>

            <div className="flex flex-col bg-gradient-to-b from-slate-50/50 to-white p-4 sm:p-5">
              <div className="mb-3 flex gap-1 rounded-xl bg-slate-100/80 p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[10px] font-semibold transition-all",
                      activeTab === tab ? "bg-white text-[#0A1628] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "기일 관리" && (
                <div className="flex-1 space-y-2">
                  {DEADLINES.map((d) => (
                    <div key={d.caseNo} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{d.type}</span>
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                          {d.dday}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {d.date} · {d.caseNo}
                      </div>
                    </div>
                  ))}
                  <button type="button" className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-2 text-[10px] font-medium text-slate-500 hover:border-primary-300 hover:text-primary-600">
                    기일 달력 열기 <ChevronRight size={12} />
                  </button>
                </div>
              )}

              {activeTab === "사건 정보" && (
                <div className="space-y-2 text-[11px] text-slate-600">
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="font-semibold text-slate-800">2025가단12345</div>
                    <div className="mt-2 space-y-1">
                      <div>법원: 서울중앙지방법원</div>
                      <div>의뢰인: 김○○</div>
                      <div>담당: 홍길동 변호사</div>
                      <div>상태: <span className="font-semibold text-primary-600">진행중</span></div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "메모·자료" && (
                <div className="space-y-2">
                  <div className="rounded-xl bg-white p-3 text-[11px] text-slate-600 ring-1 ring-slate-100">
                    <div className="font-semibold text-slate-800">준비서면 메모</div>
                    <p className="mt-1 leading-relaxed">쟁점 정리 및 증거 목록 확인 완료</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-[11px] ring-1 ring-slate-100">
                    <div className="font-semibold text-slate-800">자료실</div>
                    <div className="mt-2 text-slate-500">소장.pdf · 증거목록.xlsx</div>
                  </div>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                <div className="flex items-center gap-2">
                  <FileCheck size={12} className="text-amber-600" />
                  <span className="text-[10px] font-semibold text-amber-800">결재 대기 3건</span>
                </div>
                <ChevronRight size={12} className="text-amber-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
