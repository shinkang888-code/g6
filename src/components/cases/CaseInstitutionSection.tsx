"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AgencyNameAutocomplete } from "@/components/cases/AgencyNameAutocomplete";
import {
  CASE_INSTITUTION_STAGES,
  type CaseInstitutionInput,
  type CaseInstitutionStage,
  createEmptyInstitutionsMap,
  institutionHasData,
} from "@/lib/caseInstitutionTypes";

type Props = {
  institutions: Record<CaseInstitutionStage, CaseInstitutionInput>;
  activeStage: CaseInstitutionStage;
  onInstitutionsChange: (next: Record<CaseInstitutionStage, CaseInstitutionInput>) => void;
  onActiveStageChange: (stage: CaseInstitutionStage) => void;
  defaultCaseNumber?: string;
  defaultCaseName?: string;
  courtError?: string;
  /** 상세등록 시 기관 필수 표시 생략 */
  institutionOptional?: boolean;
};

export function CaseInstitutionSection({
  institutions,
  activeStage,
  onInstitutionsChange,
  onActiveStageChange,
  defaultCaseNumber = "",
  defaultCaseName = "",
  courtError,
  institutionOptional = false,
}: Props) {
  const isMobile = useIsMobile();
  const current = institutions[activeStage];

  const updateField = useCallback(
    (field: keyof CaseInstitutionInput, value: string) => {
      const next = {
        ...institutions,
        [activeStage]: { ...institutions[activeStage], [field]: value },
      };
      onInstitutionsChange(next);
    },
    [activeStage, institutions, onInstitutionsChange]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">나. 계속기관</h3>
        <span className="text-[10px] text-slate-500">진행 단계별 연락처</span>
      </div>
      <div className="p-5 space-y-4">
        <div
          className={cn(
            "flex gap-1.5",
            isMobile ? "overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin" : "flex-wrap"
          )}
        >
          {CASE_INSTITUTION_STAGES.map((s) => {
            const filled = institutionHasData(institutions[s.value]);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onActiveStageChange(s.value)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  activeStage === s.value
                    ? "bg-primary-600 text-white border-primary-600"
                    : filled
                      ? "bg-primary-50 text-primary-700 border-primary-200"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                {s.shortLabel}
              </button>
            );
          })}
        </div>

        {courtError && (
          <p className="text-xs text-danger-600">{courtError}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={institutionOptional ? "기관(자동조회시 필수)" : "기관(자동조회시필수) *"}>
            <AgencyNameAutocomplete
              value={current.agencyName ?? ""}
              onChange={(next) => updateField("agencyName", next)}
              stage={activeStage}
              placeholder={
                activeStage === "police"
                  ? "예: 안산경찰서"
                  : activeStage === "prosecution"
                    ? "예: 수원지방검찰청 안양지청"
                    : activeStage.startsWith("court")
                      ? "예: 인천지방법원"
                      : "예: 서울구치소"
              }
              inputClassName={inputClass}
              aria-invalid={!!courtError}
            />
            <p className="mt-1 text-[10px] text-text-muted">
              기관명 일부를 입력하면 법원·검찰·경찰·행정법원 등 목록에서 자동완성됩니다.
            </p>
          </Field>
          <Field label="사건번호">
            <input
              type="text"
              value={current.caseNumber ?? ""}
              onChange={(e) => updateField("caseNumber", e.target.value)}
              placeholder={defaultCaseNumber || "해당 단계 사건번호"}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="사건명">
          <input
            type="text"
            value={current.caseName ?? ""}
            onChange={(e) => updateField("caseName", e.target.value)}
            placeholder={defaultCaseName || "사건명"}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="담당부서">
            <input
              type="text"
              value={current.department ?? ""}
              onChange={(e) => updateField("department", e.target.value)}
              placeholder="예: 형사3부"
              className={inputClass}
            />
          </Field>
          <Field label="담당자">
            <input
              type="text"
              value={current.contactName ?? ""}
              onChange={(e) => updateField("contactName", e.target.value)}
              placeholder="예: 양종화 검사"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="전화">
            <input type="tel" value={current.phone ?? ""} onChange={(e) => updateField("phone", e.target.value)} className={inputClass} />
          </Field>
          <Field label="휴대전화">
            <input type="tel" value={current.mobile ?? ""} onChange={(e) => updateField("mobile", e.target.value)} className={inputClass} />
          </Field>
          <Field label="팩스">
            <input type="tel" value={current.fax ?? ""} onChange={(e) => updateField("fax", e.target.value)} className={inputClass} />
          </Field>
          <Field label="이메일">
            <input type="email" value={current.email ?? ""} onChange={(e) => updateField("email", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="호실">
          <input
            type="text"
            value={current.room ?? ""}
            onChange={(e) => updateField("room", e.target.value)}
            placeholder="예: 611호"
            className={inputClass}
          />
        </Field>

        {activeStage === "detention" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <Field label="구금기관">
              <input
                type="text"
                value={current.detentionAgency ?? ""}
                onChange={(e) => updateField("detentionAgency", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="구금번호">
              <input
                type="text"
                value={current.detentionNumber ?? ""}
                onChange={(e) => updateField("detentionNumber", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}

        <Field label="메모">
          <textarea
            value={current.notes ?? ""}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={2}
            className={cn(inputClass, "resize-none")}
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="activeStage"
            checked
            readOnly
            className="text-primary-600"
          />
          <span className="text-xs text-slate-600">
            현재 선택 탭「{CASE_INSTITUTION_STAGES.find((s) => s.value === activeStage)?.label}」이 진행 단계로 저장됩니다
          </span>
        </label>
      </div>
    </div>
  );
}

/** institutions API 응답 → 폼 맵 */
export function institutionsListToMap(
  list: Array<Partial<CaseInstitutionInput> & { stage: CaseInstitutionStage }>
): Record<CaseInstitutionStage, CaseInstitutionInput> {
  const map = createEmptyInstitutionsMap();
  for (const item of list) {
    if (!item.stage) continue;
    map[item.stage] = { ...map[item.stage], ...item, stage: item.stage };
  }
  return map;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20";

/** 활성 단계 기관명 → cases.court */
export function resolveCourtFromInstitutions(
  institutions: Record<CaseInstitutionStage, CaseInstitutionInput>,
  activeStage: CaseInstitutionStage
): string {
  const agency = institutions[activeStage]?.agencyName?.trim();
  if (agency) return agency;
  for (const s of CASE_INSTITUTION_STAGES) {
    const name = institutions[s.value]?.agencyName?.trim();
    if (name) return name;
  }
  return "";
}

/** institutions 배열로 API 전송용 변환 */
export function institutionsMapToArray(
  map: Record<CaseInstitutionStage, CaseInstitutionInput>
): CaseInstitutionInput[] {
  return CASE_INSTITUTION_STAGES.map((s) => map[s.value]).filter(institutionHasData);
}
