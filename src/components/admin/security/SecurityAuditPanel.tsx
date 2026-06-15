"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCw, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuditCategoryResult, AuditFinding, SecurityAuditReport } from "@/lib/security/securityAuditTypes";

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
};

type AuditRunSummary = {
  id: string;
  triggered_by: string;
  summary: SecurityAuditReport["summary"];
  created_at: string;
};

export default function SecurityAuditPanel() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [history, setHistory] = useState<AuditRunSummary[]>([]);
  const [expandedCat, setExpandedCat] = useState<string | null>("CAT-1");
  const [markdown, setMarkdown] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/admin/security/audit/runs", { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      setHistory(json.data ?? []);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runAudit = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/security/audit/run", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.report) {
        setReport(json.report as SecurityAuditReport);
        if (json.runId) {
          const detail = await fetch(`/api/admin/security/audit/runs?id=${json.runId}`, {
            credentials: "include",
          });
          if (detail.ok) {
            const d = await detail.json();
            setMarkdown(d.report_markdown ?? null);
          }
        }
        await loadHistory();
      }
    } finally {
      setRunning(false);
    }
  };

  const loadRun = async (id: string) => {
    const res = await fetch(`/api/admin/security/audit/runs?id=${id}`, { credentials: "include" });
    if (!res.ok) return;
    const d = await res.json();
    setReport({
      projectRoot: "",
      scannedAt: d.created_at,
      categories: groupFindingsByCategory(d.findings ?? []),
      summary: d.summary,
      findings: d.findings ?? [],
    });
    setMarkdown(d.report_markdown ?? null);
  };

  const summary = report?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">fireauto 8카테고리 코드 점검</h2>
          <p className="text-sm text-text-muted mt-0.5">
            시크릿 · 인증 · Rate limit · 업로드 · 스토리지 · Prompt · 정보 노출 · npm audit
          </p>
        </div>
        <Button onClick={runAudit} disabled={running}>
          <Play size={16} className="mr-1" />
          {running ? "점검 중…" : "전체 점검 실행"}
        </Button>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-5">
          {(
            [
              ["CRITICAL", summary.critical, "text-red-700"],
              ["HIGH", summary.high, "text-orange-700"],
              ["MEDIUM", summary.medium, "text-amber-700"],
              ["LOW", summary.low, "text-slate-600"],
              ["TOTAL", summary.total, "text-slate-900"],
            ] as const
          ).map(([label, count, color]) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{count}</p>
            </div>
          ))}
        </div>
      )}

      {report && (
        <div className="space-y-2">
          {report.categories.map((cat) => (
            <CategoryBlock
              key={cat.id}
              cat={cat}
              open={expandedCat === cat.id}
              onToggle={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
            />
          ))}
        </div>
      )}

      {markdown && (
        <details className="bg-white rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-medium text-slate-900 flex items-center gap-2">
            <FileText size={18} />
            마크다운 리포트 (SECURITY_AUDIT.md 형식)
          </summary>
          <pre className="mt-3 text-xs overflow-x-auto whitespace-pre-wrap text-slate-700 bg-slate-50 p-4 rounded-lg max-h-96">
            {markdown}
          </pre>
        </details>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-medium text-slate-900">점검 이력</h3>
          <button type="button" onClick={loadHistory} className="text-slate-500 hover:text-slate-700">
            <RefreshCw size={16} />
          </button>
        </div>
        {history.length === 0 ? (
          <p className="p-6 text-sm text-text-muted text-center">아직 실행 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 flex justify-between items-center text-sm"
                  onClick={() => loadRun(h.id)}
                >
                  <span>
                    {new Date(h.created_at).toLocaleString("ko-KR")} · {h.triggered_by}
                  </span>
                  <span className="text-slate-500">
                    C:{h.summary?.critical ?? 0} H:{h.summary?.high ?? 0} · 총 {h.summary?.total ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryBlock({
  cat,
  open,
  onToggle,
}: {
  cat: AuditCategoryResult;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
        onClick={onToggle}
      >
        <span className="font-medium text-slate-900">
          {cat.id} {cat.name}
          {cat.passed ? (
            <span className="ml-2 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">PASS</span>
          ) : (
            <span className="ml-2 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">
              {cat.findings.length}건
            </span>
          )}
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && cat.findings.length > 0 && (
        <ul className="border-t border-slate-100 divide-y divide-slate-50">
          {cat.findings.map((f) => (
            <FindingRow key={f.id} f={f} />
          ))}
        </ul>
      )}
      {open && cat.findings.length === 0 && (
        <p className="px-4 py-3 text-sm text-green-700 border-t border-slate-100">이슈 없음</p>
      )}
    </div>
  );
}

function FindingRow({ f }: { f: AuditFinding }) {
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className={`text-xs px-2 py-0.5 rounded border ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
        <span className="font-medium text-slate-900">{f.title}</span>
      </div>
      {f.location && <p className="text-xs font-mono text-slate-500 mb-1">{f.location}</p>}
      <p className="text-slate-600">{f.description}</p>
      {f.recommendation && <p className="text-xs text-primary-700 mt-1">권장: {f.recommendation}</p>}
    </li>
  );
}

function groupFindingsByCategory(findings: AuditFinding[]): AuditCategoryResult[] {
  const names: Record<string, string> = {
    "CAT-1": "환경변수/시크릿 노출",
    "CAT-2": "인증/인가",
    "CAT-3": "Rate Limiting",
    "CAT-4": "파일 업로드",
    "CAT-5": "스토리지 보안",
    "CAT-6": "Prompt Injection",
    "CAT-7": "정보 노출",
    "CAT-8": "의존성 취약점",
  };
  const ids = ["CAT-1", "CAT-2", "CAT-3", "CAT-4", "CAT-5", "CAT-6", "CAT-7", "CAT-8"] as const;
  return ids.map((id) => {
    const catFindings = findings.filter((f) => f.category === id);
    return { id, name: names[id], findings: catFindings, passed: catFindings.length === 0 };
  });
}
