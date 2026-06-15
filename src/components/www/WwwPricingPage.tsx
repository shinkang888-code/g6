"use client";

import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WWW_PRICING_PLANS, WWW_PRODUCTS } from "@/lib/wwwContent";
import { WwwFaq } from "@/components/www/WwwFaq";

export function WwwPricingPage() {
  return (
    <main>
      <section className="border-b border-slate-100 bg-gradient-to-b from-sky-50/50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h1 className="text-4xl font-bold text-[#0A1628]">LawyGo 요금 안내</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">
            로펌 규모와 필요한 모듈에 맞는 플랜을 선택하세요. Enterprise는 맞춤 견적을 제공합니다.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
          {WWW_PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-3xl border p-8 transition-shadow",
                plan.highlight
                  ? "border-primary-300 bg-gradient-to-b from-primary-50/50 to-white shadow-xl shadow-primary-900/5 ring-2 ring-primary-200"
                  : "border-slate-200 bg-white shadow-sm hover:shadow-md"
              )}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-6 rounded-full bg-[#0A1628] px-3 py-1 text-xs font-bold text-white">
                  {plan.badge}
                </span>
              )}
              <h2 className="text-xl font-bold text-[#0A1628]">{plan.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{plan.period}</p>
              <div className="mt-6">
                <span className="text-3xl font-bold text-[#0A1628]">{plan.price}</span>
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check size={16} className="mt-0.5 shrink-0 text-primary-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login/signup"
                className={cn(
                  "mt-8 inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-colors",
                  plan.highlight
                    ? "bg-[#0A1628] text-white hover:bg-[#152238]"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                )}
              >
                시작하기 <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50/80 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-[#0A1628]">어떤 플랜이 우리에게 맞을까요?</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {WWW_PRODUCTS.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="font-bold text-slate-900">{p.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{p.description}</p>
                <ul className="mt-4 space-y-2">
                  {p.bullets.slice(0, 3).map((b) => (
                    <li key={b} className="text-xs text-slate-500">· {b}</li>
                  ))}
                </ul>
                <Link href={`/www#product-${p.id}`} className="mt-4 inline-flex text-sm font-semibold text-primary-700 hover:underline">
                  자세히 보기 →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WwwFaq />

      <section className="bg-[#0A1628] py-16 text-center text-white">
        <h2 className="text-2xl font-bold">도입 상담이 필요하신가요?</h2>
        <p className="mt-3 text-slate-300">Enterprise·맞춤 구축 견적은 로그인 후 문의해 주세요.</p>
        <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#0A1628] hover:bg-sky-50">
          문의하기
        </Link>
      </section>
    </main>
  );
}
