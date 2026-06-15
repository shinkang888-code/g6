"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileBottomSheet } from "@/components/ui/MobileBottomSheet";
import {
  CASE_INSTITUTION_STAGES,
  type CaseInstitution,
  type CaseInstitutionStage,
  institutionHasData,
} from "@/lib/caseInstitutionTypes";

type Props = {
  caseId: string;
  activeStage?: string;
  courtDivision?: string;
};

export function CaseInstitutionDetailPanel({ caseId, activeStage, courtDivision }: Props) {
  const [institutions, setInstitutions] = useState<CaseInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<CaseInstitutionStage>("court_1");
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    fetch(`/api/admin/cases/${encodeURIComponent(caseId)}/institutions`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: { data?: CaseInstitution[] }) => {
        const list = Array.isArray(json.data) ? json.data : [];
        setInstitutions(list);
        const preferred = (activeStage as CaseInstitutionStage) || "court_1";
        const hasPreferred = list.some((i) => i.stage === preferred);
        if (hasPreferred) setSelectedStage(preferred);
        else if (list[0]?.stage) setSelectedStage(list[0].stage);
      })
      .catch(() => setInstitutions([]))
      .finally(() => setLoading(false));
  }, [caseId, activeStage]);

  const current = institutions.find((i) => i.stage === selectedStage);
  const filledStages = CASE_INSTITUTION_STAGES.filter((s) => {
    const inst = institutions.find((i) => i.stage === s.value);
    return inst && institutionHasData(inst);
  });

  if (loading) {
    return <p className="text-xs text-text-muted">계속기관 정보 불러오는 중…</p>;
  }

  if (filledStages.length === 0 && !courtDivision?.trim()) {
    return null;
  }

  const panelBody = (
    <div className="space-y-3">
      <div className={cn("flex gap-1.5", isMobile && "overflow-x-auto pb-1")}>
        {CASE_INSTITUTION_STAGES.map((s) => {
          const inst = institutions.find((i) => i.stage === s.value);
          const filled = inst && institutionHasData(inst);
          if (!filled && s.value !== selectedStage) return null;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setSelectedStage(s.value)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border",
                selectedStage === s.value
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              {s.shortLabel}
            </button>
          );
        })}
      </div>

      {current && institutionHasData(current) ? (
        <div className="space-y-2 text-sm">
          {current.agencyName && (
            <Row icon={<Building2 size={13} />} label="기관" value={current.agencyName} />
          )}
          {current.caseNumber && <Row label="사건번호" value={current.caseNumber} />}
          {(current.department || current.contactName) && (
            <Row label="담당" value={[current.department, current.contactName].filter(Boolean).join(" / ")} />
          )}
          {current.phone && (
            <a href={`tel:${current.phone.replace(/\s/g, "")}`} className="flex gap-2 text-primary-600 hover:underline">
              <Phone size={13} className="mt-0.5 shrink-0" />
              <span>{current.phone}</span>
            </a>
          )}
          {current.mobile && (
            <a href={`tel:${current.mobile.replace(/\s/g, "")}`} className="flex gap-2 text-primary-600 hover:underline">
              <Phone size={13} className="mt-0.5 shrink-0" />
              <span>{current.mobile} (휴대)</span>
            </a>
          )}
          {current.email && (
            <a href={`mailto:${current.email}`} className="flex gap-2 text-primary-600 hover:underline">
              <Mail size={13} className="mt-0.5 shrink-0" />
              <span>{current.email}</span>
            </a>
          )}
          {current.room && <Row label="호실" value={current.room} />}
        </div>
      ) : courtDivision?.trim() ? (
        <p className="text-xs text-slate-600 leading-relaxed">{courtDivision.trim()}</p>
      ) : (
        <p className="text-xs text-text-muted">등록된 계속기관 정보가 없습니다.</p>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-xs text-slate-700"
        >
          <span className="font-medium">계속기관 연락처</span>
          {current?.agencyName && (
            <span className="block text-slate-500 mt-0.5 truncate">{current.agencyName}</span>
          )}
        </button>
        <MobileBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="계속기관">
          {panelBody}
        </MobileBottomSheet>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">계속기관</div>
      {panelBody}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2">
      {icon && <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>}
      <div>
        <div className="text-[10px] text-text-muted">{label}</div>
        <div className="text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}
