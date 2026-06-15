"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { WWW_TESTIMONIALS } from "@/lib/wwwContent";

export function WwwTestimonials() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0A1628]">고객 성공 사례</h2>
          <p className="mt-3 text-slate-500">실제 송무 현장에서 LawyGo를 사용하는 이야기</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {WWW_TESTIMONIALS.map((t, i) => (
            <motion.blockquote
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-6 shadow-sm"
            >
              <Quote size={28} className="text-primary-200" />
              <p className="mt-4 text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-5 border-t border-slate-100 pt-4">
                <cite className="not-italic">
                  <span className="font-semibold text-slate-900">{t.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{t.role}</span>
                </cite>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
