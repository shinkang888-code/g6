"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { LANDING_FEATURES, LANDING_STATS } from "@/lib/landingContent";

/** 스플릿 레이아웃 — 좌측 카피 + 우측 목업, 다이내믹 그라데이션 */
export function LandingDesignV2() {
  return (
    <div className="min-h-screen bg-[#F4F8FF] text-slate-900">
      <LandingNav />

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(30,64,175,0.12),_transparent_50%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="inline-flex rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700">
                송무관리 플랫폼
              </span>
              <h1 className="mt-5 text-3xl font-bold leading-tight text-[#0A1628] sm:text-5xl">
                복잡한 송무,
                <br />
                <span className="text-primary-700">LawyGo</span> 하나로
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
                사건·기일·의뢰인·결재·자료실을 분산된 엑셀과 메모에서 벗어나 통합 관리하세요.
                법원 동기화와 LawTop형 엑셀 연동으로 기존 업무 방식을 그대로 이어갑니다.
              </p>

              <ul className="mt-6 space-y-2.5">
                {["기일 D-Day 자동 집계", "사건 메모·자료실 통합", "다단계 결재 & 공지 연동"].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 size={16} className="text-primary-600" />
                    {t}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0A1628] px-6 py-3 text-sm font-semibold text-white hover:bg-[#152238]"
                >
                  지금 사용해 보기
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/login/signup"
                  className="inline-flex rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  회원가입
                </Link>
              </div>
            </div>

            <div id="product" className="lg:pl-4">
              <DashboardMockup glow="gradient" className="lg:scale-[1.02]" />
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-white py-10">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 sm:grid-cols-4 sm:px-6">
            {LANDING_STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold text-[#0A1628]">{s.value}</div>
                <div className="mt-1 text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#0A1628] sm:text-3xl">송무팀이 매일 쓰는 핵심 기능</h2>
              <p className="mt-3 text-sm text-slate-500">사건 등록부터 기일·결재까지 이어지는 워크플로우</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {LANDING_FEATURES.map((f) => (
                <article
                  key={f.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <p className="text-[10px] font-bold tracking-widest text-primary-600">{f.tag}</p>
                  <h3 className="mt-3 whitespace-pre-line text-lg font-bold text-[#0A1628]">{f.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className="bg-[#0A1628] py-16 text-white">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold">로펌·기업 법무팀을 위한 송무 OS</h2>
            <p className="mt-4 text-sm text-slate-300">
              담당 사건, 다가오는 기일, 결재 대기를 대시보드 한 화면에서 확인하고
              팀 전체가 같은 데이터로 협업합니다.
            </p>
            <Link href="/login" className="mt-8 inline-flex rounded-full bg-sky-400 px-8 py-3 text-sm font-semibold text-[#0A1628] hover:bg-sky-300">
              LawyGo 시작하기
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
