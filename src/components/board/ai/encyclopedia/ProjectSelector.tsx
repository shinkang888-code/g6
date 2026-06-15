// filepath: src/components/board/ai/encyclopedia/ProjectSelector.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderKanban, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type EncyclopediaProjectOption = {
  id: string;
  client_name: string;
  case_title: string;
  case_id: string | null;
  display: string;
  drive_folder_path: string | null;
};

type CaseOption = {
  id: string;
  label: string;
  clientName: string;
  caseTitle: string;
};

interface ProjectSelectorProps {
  value: string | null;
  onChange: (project: EncyclopediaProjectOption | null) => void;
  /** 종류 프레임 내 세로 배치 */
  layout?: "inline" | "stacked";
}

export function ProjectSelector({ value, onChange, layout = "inline" }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<EncyclopediaProjectOption[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [clientName, setClientName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/encyclopedia/projects", { credentials: "include" }),
        fetch("/api/encyclopedia/case-options", { credentials: "include" }),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      setProjects(pData.projects ?? []);
      setCases(cData.cases ?? []);
    } catch {
      toast.error("프로젝트 목록 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectProject = (id: string) => {
    const p = projects.find((x) => x.id === id) ?? null;
    onChange(p);
    if (p) localStorage.setItem("lawygo_encyclopedia_project_id", p.id);
  };

  useEffect(() => {
    if (loading || projects.length === 0) return;
    const saved = localStorage.getItem("lawygo_encyclopedia_project_id");
    if (saved && !value) {
      const p = projects.find((x) => x.id === saved);
      if (p) onChange(p);
    }
  }, [loading, projects, value, onChange]);

  const createFromCase = async () => {
    if (!selectedCaseId) {
      toast.error("사건을 선택하세요.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/encyclopedia/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caseId: selectedCaseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      onChange(data.project);
      setShowNew(false);
      toast.success("프로젝트가 생성되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const createManual = async () => {
    if (!clientName.trim() || !caseTitle.trim()) {
      toast.error("의뢰인명과 사건명을 입력하세요.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/encyclopedia/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientName, caseTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      onChange(data.project);
      setShowNew(false);
      setClientName("");
      setCaseTitle("");
      toast.success("프로젝트가 생성되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const active = projects.find((p) => p.id === value);
  const stacked = layout === "stacked";

  return (
    <div className={cn("gap-2", stacked ? "flex flex-col" : "flex flex-wrap items-center")}>
      <div className={cn("flex items-center gap-2", stacked && "w-full")}>
        <FolderKanban size={14} className="text-indigo-600 shrink-0" />
        {stacked && (
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">프로젝트</span>
        )}
      </div>
      {loading ? (
        <Loader2 size={14} className="animate-spin text-slate-400" />
      ) : (
        <select
          value={value ?? ""}
          onChange={(e) => selectProject(e.target.value)}
          className={cn(
            "text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white",
            stacked ? "w-full" : "min-w-[200px] max-w-[320px]"
          )}
        >
          <option value="">프로젝트 선택 (의뢰인 · 사건)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display}
            </option>
          ))}
        </select>
      )}
      {active?.drive_folder_path && (
        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded w-fit">Drive 연동</span>
      )}
      <Button
        size="xs"
        variant="outline"
        className={stacked ? "w-full justify-center" : undefined}
        leftIcon={<Plus size={12} />}
        onClick={() => setShowNew((v) => !v)}
      >
        새 프로젝트
      </Button>

      {showNew && (
        <div className="w-full flex flex-wrap gap-2 p-2 rounded-xl border border-indigo-100 bg-indigo-50/40 mt-1">
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 flex-1 min-w-[180px]"
          >
            <option value="">기존 사건에서 생성</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <Button size="xs" onClick={createFromCase} disabled={creating}>
            사건 연동 생성
          </Button>
          <span className="text-[10px] text-slate-400 self-center">또는</span>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="의뢰인명"
            className="text-xs border rounded-lg px-2 py-1.5 w-28"
          />
          <input
            value={caseTitle}
            onChange={(e) => setCaseTitle(e.target.value)}
            placeholder="사건명"
            className="text-xs border rounded-lg px-2 py-1.5 w-36"
          />
          <Button size="xs" variant="secondary" onClick={createManual} disabled={creating}>
            수동 생성
          </Button>
        </div>
      )}
    </div>
  );
}
