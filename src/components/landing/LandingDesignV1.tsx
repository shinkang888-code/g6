"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { LANDING_FEATURES, LANDING_TRUST_LOGOS } from "@/lib/landingContent";

/** Allibee 스타일 — 중앙 히어로 + 대형 목업 + 신뢰 로고 */
export function LandingDesignV1() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LandingNav />

      <main>
        <section className="mx-auto max-w-5xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#0A1628] sm:text-5xl sm:leading-[1.15]">
            사건 수임은 끝이 아닌
            <br />
            시작입니다
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
            이제 LawyGo에게 맡겨보세요. 진행 중인 모든 사건의 기일·불변기한·결재·자료를
            24시간 놓치지 않고 송무 관리 시스템이 확인하고 알려드립니다.
          </p>

          <div id="product" className="mx-auto mt-12 max-w-4xl">
            <DashboardMockup glow="blue" />
          </div>

          <Link
            href="/login"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#0A1628] px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#152238]"
          >
            지금 사용해 보기
            <ArrowRight size={16} />
          </Link>
        </section>

        <section id="trust" className="border-t border-slate-100 py-14">
          <p className="text-center text-sm text-slate-500">다수의 로펌 · 법무팀이 선택한 LawyGo</p>
          <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6">
            {LANDING_TRUST_LOGOS.map((name) => (
              <span key={name} className="text-sm font-semibold tracking-wide text-slate-300">
                {name}
              </span>
            ))}
          </div>
        </section>

        <section id="features" className="bg-slate-50/80 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {LANDING_FEATURES.map((f, i) => (
              <div
                key={f.id}
                className={`grid items-center gap-10 py-12 ${i % 2 === 1 ? "md:grid-cols-2" : "md:grid-cols-2"} ${i > 0 ? "border-t border-slate-200/80" : ""}`}
              >
                <div className={i % 2 === 1 ? "md:order-2" : ""}>
                  <p className="text-xs font-bold tracking-widest text-primary-600">{f.tag}</p>
                  <h2 className="mt-3 whitespace-pre-line text-2xl font-bold text-[#0A1628] sm:text-3xl">
                    {f.title}
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{f.description}</p>
                  <ul className="mt-5 space-y-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${i % 2 === 1 ? "md:order-1" : ""}`}>
                  <div className="space-y-3">
                    {f.bullets.map((b) => (
                      <div key={b} className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                        {b}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#0A1628] py-20 text-center text-white">
          <h2 className="text-2xl font-bold sm:text-3xl">송무 관리, LawyGo가 대신 챙깁니다</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300">
            사건 등록부터 기일·결재·자료실까지. 복잡한 송무 운영을 한 플랫폼에서 시작하세요.
          </p>
          <Link
            href="/login/signup"
            className="mt-8 inline-flex rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#0A1628] hover:bg-sky-50"
          >
            LawyGo 무료로 시작하기
          </Link>
        </section>
      </main>
    </div>
  );
}
