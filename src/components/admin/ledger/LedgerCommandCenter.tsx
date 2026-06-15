"use client";

import { useState } from "react";
import { Link2, LayoutDashboard, ScrollText, Boxes, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import LedgerOverviewPanel from "@/components/admin/ledger/LedgerOverviewPanel";
import LedgerTransactionExplorer from "@/components/admin/ledger/LedgerTransactionExplorer";
import LedgerBlockExplorer from "@/components/admin/ledger/LedgerBlockExplorer";
import LedgerAlertsPanel from "@/components/admin/ledger/LedgerAlertsPanel";

type TabId = "overview" | "transactions" | "blocks" | "alerts";

const TABS: { id: TabId; label: string; icon: typeof Link2 }[] = [
  { id: "overview", label: "원장 상태", icon: LayoutDashboard },
  { id: "transactions", label: "거래 로그", icon: ScrollText },
  { id: "blocks", label: "Merkle 블록", icon: Boxes },
  { id: "alerts", label: "무결성 알림", icon: AlertTriangle },
];

export default function LedgerCommandCenter() {
  const [tab, setTab] = useState<TabId>("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Link2 size={26} className="text-primary-600" />
          분산원장 관리 (HDL)
        </h1>
        <p className="text-sm text-text-muted mt-1">
          신원-거래 강결합 해시체인 · Merkle 블록 · 외부 앵커 — 무결성 실시간 감시
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === t.id ? "bg-white text-primary-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <LedgerOverviewPanel refreshKey={refreshKey} onRefresh={bump} />}
      {tab === "transactions" && <LedgerTransactionExplorer refreshKey={refreshKey} />}
      {tab === "blocks" && <LedgerBlockExplorer refreshKey={refreshKey} />}
      {tab === "alerts" && <LedgerAlertsPanel refreshKey={refreshKey} onRefresh={bump} />}
    </div>
  );
}
