"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WWW_PRODUCTS, type WwwProductId } from "@/lib/wwwContent";

export function WwwProductTabs() {
  const [active, setActive] = useState<WwwProductId>("core");
  const product = WWW_PRODUCTS.find((p) => p.id === active)!;

  return (
    <section className="bg-white py-20 sm:py-28" id="products">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0A1628] sm:text-4xl">나에게 맞는 LawyGo를 선택하세요</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            개인 로펌부터 기업 법무팀까지, 규모에 맞는 송무관리 모듈을 제공합니다.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {WWW_PRODUCTS.map((p) => (
            <button
              key={p.id}
              type="button"
              id={`product-${p.id}`}
              onClick={() => setActive(p.id)}
              className={cn(
                "rounded-full px-6 py-2.5 text-sm font-semibold transition-all",
                active === p.id
                  ? "bg-[#0A1628] text-white shadow-lg shadow-slate-900/15"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mx-auto mt-10 max-w-3xl"
          >
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-xl shadow-slate-900/5 sm:p-10">
              {product.badge && (
                <span className="absolute right-6 top-6 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                  {product.badge}
                </span>
              )}
              <p className="text-xs font-bold tracking-widest text-primary-600">현재 보고 있는 제품</p>
              <h3 className="mt-2 text-2xl font-bold text-[#0A1628] sm:text-3xl">{product.name}</h3>
              <p className="mt-1 text-sm font-medium text-sky-700">{product.tagline}</p>
              <p className="mt-4 text-slate-600">{product.description}</p>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {product.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check size={16} className="mt-0.5 shrink-0 text-primary-600" strokeWidth={2.5} />
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href={product.ctaHref}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0A1628] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#152238]"
              >
                {product.cta}
                <ArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
