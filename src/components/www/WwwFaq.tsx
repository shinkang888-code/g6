"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WWW_FAQ } from "@/lib/wwwContent";

export function WwwFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold text-[#0A1628]">자주 묻는 질문</h2>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {WWW_FAQ.map((item, i) => (
            <div key={item.q}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold text-slate-900">{item.q}</span>
                <ChevronDown size={18} className={cn("shrink-0 text-slate-400 transition-transform", open === i && "rotate-180")} />
              </button>
              {open === i && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 text-sm leading-relaxed text-slate-600">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
