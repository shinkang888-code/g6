"use client";

import { Scale, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  caseNumber?: string;
  children: React.ReactNode;
  className?: string;
};

export function CaseQuickPopupShell({ title, caseNumber, children, className }: Props) {
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Scale size={18} className="text-primary-600 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 truncate">{title}</h1>
            {caseNumber ? (
              <p className="text-xs text-slate-500 truncate">{caseNumber}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 shrink-0"
          aria-label="창 닫기"
        >
          <X size={18} />
        </button>
      </header>
      <main className={cn("flex-1 min-h-0 overflow-auto", className)}>{children}</main>
    </div>
  );
}
