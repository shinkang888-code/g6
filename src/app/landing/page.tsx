"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LandingDesignV1 } from "@/components/landing/LandingDesignV1";
import { LandingDesignV2 } from "@/components/landing/LandingDesignV2";
import { LandingDesignV3 } from "@/components/landing/LandingDesignV3";

const DESIGNS = [
  {
    id: "v1",
    label: "디자인 1",
    subtitle: "Allibee형 · 중앙 히어로",
    Component: LandingDesignV1,
  },
  {
    id: "v2",
    label: "디자인 2",
    subtitle: "스플릿 · 좌우 레이아웃",
    Component: LandingDesignV2,
  },
  {
    id: "v3",
    label: "디자인 3",
    subtitle: "기능 카드 · 섹션형",
    Component: LandingDesignV3,
  },
] as const;

type DesignId = (typeof DESIGNS)[number]["id"];

export default function LandingShowcasePage() {
  const [active, setActive] = useState<DesignId>("v1");
  const current = DESIGNS.find((d) => d.id === active) ?? DESIGNS[0];
  const ActiveDesign = current.Component;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-[60] border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-semibold text-primary-600">LawyGo 랜딩 디자인 시안</p>
            <p className="text-sm text-slate-500">Allibee 참조 · 송무관리 프로그램 소개 · 3안 비교</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DESIGNS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setActive(d.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                  active === d.id
                    ? "bg-[#0A1628] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {d.label}
              </button>
            ))}
            <Link
              href={`/landing/${active}`}
              className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              단독 페이지 ↗
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center text-xs text-slate-500 sm:px-6">
          {current.label} — {current.subtitle}
        </div>
      </div>

      <ActiveDesign />
    </div>
  );
}
