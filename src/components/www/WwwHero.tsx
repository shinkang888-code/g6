"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { WwwDashboardMockup } from "@/components/www/WwwDashboardMockup";

export function WwwHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(56,189,248,0.18),transparent)]" />
      <div className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-blue-100/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-sky-100/50 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/80 px-4 py-1.5 text-xs font-semibold text-sky-800">
            송무관리 프로그램 · LawyGo
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.12] tracking-tight text-[#0A1628] sm:text-5xl lg:text-[3.25rem]">
            사건 수임은 끝이 아닌
            <br />
            <span className="bg-gradient-to-r from-[#0A1628] via-primary-700 to-sky-600 bg-clip-text text-transparent">
              시작입니다
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
            이제 LawyGo에게 맡겨보세요. 진행 중인 모든 사건의 기일·불변기한·결재·자료를
            놓치지 않고 확인하고 알려드립니다.
          </p>
        </motion.div>

        <motion.div
          id="product"
          className="mt-14"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <WwwDashboardMockup />
        </motion.div>

        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#0A1628] px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-slate-900/20 transition-all hover:bg-[#152238] hover:shadow-2xl"
          >
            지금 사용해 보기
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/www/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            요금제 보기
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
