"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { WWW_FEATURE_BLOCKS } from "@/lib/wwwContent";

export function WwwFeatureSections() {
  return (
    <div className="space-y-0">
      {WWW_FEATURE_BLOCKS.map((block, idx) => (
        <section
          key={block.id}
          id={`feature-${block.id}`}
          className={idx % 2 === 0 ? "bg-white py-20 sm:py-28" : "bg-slate-50/80 py-20 sm:py-28"}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${block.reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <motion.div
                initial={{ opacity: 0, x: block.reverse ? 20 : -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-xs font-bold tracking-[0.2em] text-primary-600">{block.tag}</p>
                <h2 className="mt-4 whitespace-pre-line text-3xl font-bold leading-tight text-[#0A1628] sm:text-4xl">
                  {block.title}
                </h2>
                <p className="mt-5 text-base leading-relaxed text-slate-600">{block.description}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: block.reverse ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="space-y-3"
              >
                {block.points.map((pt, i) => (
                  <div
                    key={pt.title}
                    className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-primary-200 hover:shadow-md"
                  >
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{pt.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">{pt.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
