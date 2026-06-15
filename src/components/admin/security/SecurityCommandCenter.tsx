"use client";

import { useState } from "react";
import { Shield, LayoutDashboard, ScrollText, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import SecurityOverviewPanel from "@/components/admin/security/SecurityOverviewPanel";
import SecurityLogExplorer, {
  type LogFilterPreset,
} from "@/components/admin/security/SecurityLogExplorer";
import SecurityAuditPanel from "@/components/admin/security/SecurityAuditPanel";

type TabId = "overview" | "logs" | "audit";

const TABS: { id: TabId; label: string; icon: typeof Shield }[] = [
  { id: "overview", label: "개요", icon: LayoutDashboard },
  { id: "logs", label: "보안·접속 로그", icon: ScrollText },
  { id: "audit", label: "코드 점검 (8CAT)", icon: FileSearch },
];

export default function SecurityCommandCenter() {
  const [tab, setTab] = useState<TabId>("overview");
  const [logPreset, setLogPreset] = useState<LogFilterPreset | null>(null);

  const openLogs = (preset?: LogFilterPreset) => {
    setLogPreset(preset ?? null);
    setTab("logs");
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield size={26} className="text-primary-600" />
          LawyGo 보안 관제 센터 (LSCC)
        </h1>
        <p className="text-sm text-text-muted mt-1">
          관리자 전용 — 전체 서버 접속·보안 이벤트 SOC 관제 및 fireauto 8카테고리 코드 감사
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

      {tab === "overview" && <SecurityOverviewPanel onOpenLogs={openLogs} />}
      {tab === "logs" && <SecurityLogExplorer initialPreset={logPreset} />}
      {tab === "audit" && <SecurityAuditPanel />}
    </div>
  );
}
