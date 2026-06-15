"use client";

import { motion } from "framer-motion";
import { WWW_STATS } from "@/lib/wwwContent";

export function WwwStats() {
  return (
    <section className="border-y border-slate-200/80 bg-[#0A1628] py-16 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-sm font-medium text-slate-400">숫자로 보는 LawyGo</p>
        <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {WWW_STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-sky-300 sm:text-4xl">{s.value}</div>
              <div className="mt-2 text-sm font-semibold">{s.label}</div>
              <div className="mt-1 text-xs text-slate-400">{s.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
