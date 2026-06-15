"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";

const shortcuts = [
  { key: "/", description: "검색창 포커스" },
  { key: "G", description: "대시보드로 이동" },
  { key: "C", description: "사건 목록으로 이동" },
  { key: "A", description: "결재함으로 이동" },
  { key: "F", description: "회계/수납으로 이동" },
  { key: "N", description: "새 사건 등록" },
  { key: "Esc", description: "닫기 / 포커스 해제" },
];

export function KeyboardHints() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-md text-slate-500 hover:text-primary-600 hover:border-primary-300 transition-all z-40 hover:shadow-lg hover:-translate-y-0.5"
        title="키보드 단축키"
      >
        <Keyboard size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed bottom-16 right-5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl w-72 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Keyboard size={14} className="text-primary-600" />
                  키보드 단축키
                </div>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="p-3 space-y-1">
                {shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50">
                    <span className="text-sm text-slate-600">{s.description}</span>
                    <kbd className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 border border-slate-200">
                      {s.key}
                    </kbd>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-slate-100 px-2">
                  <p className="text-xs text-text-muted">* 입력창 외부에서 사용하세요</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
