"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, FolderOpen, Users } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { LANDING_FEATURES, LANDING_TRUST_LOGOS } from "@/lib/landingContent";

const HIGHLIGHTS = [
  {
    icon: CalendarDays,
    title: "법원 기일 자동 추적",
    desc: "다음 기일·불변기한·D-Day를 캘린더와 대시보드에서 실시간 확인",
  },
  {
    icon: FolderOpen,
    title: "사건·자료 통합 관리",
    desc: "사건 목록, 메모, 자료실, LawTop형 엑셀 import/export",
  },
  {
    icon: Users,
    title: "팀 협업 & 결재",
    desc: "담당변경, 결재선, 공지·메신저까지 송무 허브로 연결",
  },
];

/** 기능 중심 — 히어로 + 3카드 + 목업 + 다크 CTA */
export function LandingDesignV3() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LandingNav variant="light" />

      <main>
        <section className="border-b border-slate-100 bg-gradient-to-b from-sky-50/50 to-white">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <p className="text-xs font-bold tracking-[0.2em] text-primary-600">ALL-IN-ONE LITIGATION PLATFORM</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-[#0A1628] sm:text-5xl">
              송무 관리의 새 기준,
              <br />
              LawyGo
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm text-slate-600 sm:text-base">
              사건 수임 이후의 모든 업무 — 기일, 서류, 결재, 고객 소통 — 을
              하나의 송무관리 프로그램에서 끝까지 관리합니다.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-16 sm:grid-cols-3 sm:px-6">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <h.icon size={20} />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#0A1628]">{h.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{h.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className="py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <h2 className="text-2xl font-bold text-[#0A1628] sm:text-3xl">
                업무 대시보드에서
                <br />
                오늘 할 일이 보입니다
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                공지사항, 기일 현황, 내 담당 사건, 결재 대기, 다가오는 기일을
                한 화면에 모았습니다. 아침에 로그인하면 송무팀 전체가 같은 맥락으로 하루를 시작합니다.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
              >
                대시보드 체험하기 <ArrowRight size={14} />
              </Link>
            </div>
            <DashboardMockup glow="navy" />
          </div>
        </section>

        <section id="features" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold text-[#0A1628]">역할별 송무 업무, 한 플랫폼에서</h2>
            <div className="mt-12 space-y-6">
              {LANDING_FEATURES.map((f) => (
                <div
                  key={f.id}
                  className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-[200px_1fr] md:items-start"
                >
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-primary-600">{f.tag}</p>
                    <h3 className="mt-2 whitespace-pre-line text-lg font-bold text-[#0A1628]">{f.title}</h3>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">{f.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {f.bullets.map((b) => (
                        <span key={b} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className="py-14">
          <p className="text-center text-sm text-slate-500">신뢰하는 법무 조직</p>
          <div className="mx-auto mt-8 flex max-w-5xl flex-wrap justify-center gap-8 px-6">
            {LANDING_TRUST_LOGOS.map((name) => (
              <div
                key={name}
                className="flex h-12 min-w-[100px] items-center justify-center rounded-lg border border-slate-100 bg-white px-4 text-xs font-semibold text-slate-400"
              >
                {name}
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#0A1628] py-20 text-white">
          <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold sm:text-4xl">송무 운영, LawyGo로 단순하게</h2>
            <p className="mt-4 text-sm text-slate-300">
              10초 만에 가입하고, 분산된 사건 관리에서 벗어나세요.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login/signup" className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#0A1628] hover:bg-sky-50">
                무료로 시작하기
              </Link>
              <Link href="/login" className="rounded-full border border-white/30 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10">
                로그인
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} LawyGo · 법무법인을 위한 송무관리 시스템
      </footer>
    </div>
  );
}
