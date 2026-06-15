"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown, Menu, Scale, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WWW_NAV_FEATURES, WWW_PRODUCTS } from "@/lib/wwwContent";

export function WwwNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [featureOpen, setFeatureOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/www" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A1628] to-[#1e3a5f] shadow-lg shadow-slate-900/10 transition-transform group-hover:scale-105">
            <Scale size={17} className="text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#0A1628]">LawyGo</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <div
            className="relative"
            onMouseEnter={() => setProductOpen(true)}
            onMouseLeave={() => setProductOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              제품 <ChevronDown size={14} className={cn("transition-transform", productOpen && "rotate-180")} />
            </button>
            {productOpen && (
              <div className="absolute left-0 top-full pt-2">
                <div className="w-72 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xl shadow-slate-900/10">
                  {WWW_PRODUCTS.map((p) => (
                    <Link
                      key={p.id}
                      href={`/www#product-${p.id}`}
                      className="block rounded-xl px-4 py-3 transition-colors hover:bg-slate-50"
                      onClick={() => setProductOpen(false)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                        {p.badge && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{p.tagline}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => setFeatureOpen(true)}
            onMouseLeave={() => setFeatureOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              기능 <ChevronDown size={14} className={cn("transition-transform", featureOpen && "rotate-180")} />
            </button>
            {featureOpen && (
              <div className="absolute left-0 top-full pt-2">
                <div className="w-56 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xl shadow-slate-900/10">
                  {WWW_NAV_FEATURES.map((f) => (
                    <Link
                      key={f.label}
                      href={f.href}
                      className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      onClick={() => setFeatureOpen(false)}
                    >
                      {f.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/www/pricing" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
            가격
          </Link>
          <Link href="/www#security" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
            보안
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
            로그인
          </Link>
          <Link
            href="/login/signup"
            className="inline-flex items-center gap-2 rounded-full bg-[#0A1628] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition-all hover:bg-[#152238] hover:shadow-xl"
          >
            무료로 시작하기
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
              <ArrowRight size={12} />
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-4 py-4 md:hidden">
          <div className="space-y-1">
            {WWW_NAV_FEATURES.map((f) => (
              <Link key={f.label} href={f.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700" onClick={() => setMobileOpen(false)}>
                {f.label}
              </Link>
            ))}
            <Link href="/www/pricing" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700" onClick={() => setMobileOpen(false)}>
              가격
            </Link>
            <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700" onClick={() => setMobileOpen(false)}>
              로그인
            </Link>
            <Link href="/login/signup" className="mt-2 block rounded-full bg-[#0A1628] px-4 py-3 text-center text-sm font-semibold text-white" onClick={() => setMobileOpen(false)}>
              무료로 시작하기
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
