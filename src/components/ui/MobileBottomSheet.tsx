"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function MobileBottomSheet({ open, onClose, title, children, className }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/45 z-[60] lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-2xl shadow-2xl lg:hidden",
              "max-h-[min(85dvh,720px)] flex flex-col safe-area-pb",
              className
            )}
          >
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
