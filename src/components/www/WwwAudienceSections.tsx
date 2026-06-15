"use client";

import { motion } from "framer-motion";
import { WWW_AUDIENCE } from "@/lib/wwwContent";

export function WwwAudienceSections() {
  return (
    <div>
      {WWW_AUDIENCE.map((section, sIdx) => (
        <section
          key={section.id}
          className={sIdx % 2 === 0 ? "bg-slate-50/80 py-20 sm:py-28" : "bg-white py-20 sm:py-28"}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-2xl"
            >
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-600">{section.label}</p>
              <h2 className="mt-3 whitespace-pre-line text-3xl font-bold text-[#0A1628] sm:text-4xl">{section.title}</h2>
              <p className="mt-4 text-slate-600">{section.subtitle}</p>
            </motion.div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {section.cards.map((card, i) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg"
                >
                  <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.desc}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
