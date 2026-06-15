"use client";

import { Bot, ExternalLink, Link2, Loader2, CheckCircle2 } from "lucide-react";
import { AgencyNameAutocomplete } from "@/components/cases/AgencyNameAutocomplete";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatQuickSyncDetail, type QuickSyncPreview } from "@/lib/caseQuickSyncUi";

const caseTypes = ["형사", "민사", "행정", "헌법", "가사", "파산/회생", "기타"];

type Props = {
  caseNumber: string;
  caseType: string;
  caseName: string;
  courtName: string;
  partyName: string;
  errors: Record<string, string>;
  quickLoading: boolean;
  quickLoadingLabel?: string;
  syncPreview?: QuickSyncPreview | null;
  onCaseNumberChange: (v: string) => void;
  onCaseTypeChange: (v: string) => void;
  onCaseNameChange: (v: string) => void;
  onCourtChange: (v: string) => void;
  onPartyChange: (v: string) => void;
  onOpenScourtSearch: () => void;
  onQuickRegister: () => void;
  inputClass: (hasError: boolean) => string;
};

export function CaseQuickRegisterSection({
  caseNumber,
  caseType,
  caseName,
  courtName,
  partyName,
  errors,
  quickLoading,
  quickLoadingLabel = "등록·기일 연동 중…",
  syncPreview,
  onCaseNumberChange,
  onCaseTypeChange,
  onCaseNameChange,
  onCourtChange,
  onPartyChange,
  onOpenScourtSearch,
  onQuickRegister,
  inputClass,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-700">가. 간편등록</h3>
        <p className="text-[11px] text-text-muted mt-0.5">
          사건번호·기관·당사자만으로 나의사건검색 봇 조회 후 등록·기일 연동
        </p>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <Field label="사건번호 *" error={errors.caseNumber}>
          <input
            type="text"
            value={caseNumber}
            onChange={(e) => onCaseNumberChange(e.target.value)}
            placeholder="예: 2025가소32949"
            className={inputClass(!!errors.caseNumber)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="사건종류">
            <select
              value={caseType}
              onChange={(e) => onCaseTypeChange(e.target.value)}
              className={inputClass(false)}
            >
              <option value="">자동 추정</option>
              {caseTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="사건명">
            <input
              type="text"
              value={caseName}
              onChange={(e) => onCaseNameChange(e.target.value)}
              placeholder="조회 후 자동 반영 가능"
              className={inputClass(false)}
            />
          </Field>
        </div>

        <Field label="당사자 *" error={errors.partyName}>
          <input
            type="text"
            value={partyName}
            onChange={(e) => onPartyChange(e.target.value)}
            placeholder="의뢰인·당사자 이름"
            className={inputClass(!!errors.partyName)}
          />
        </Field>

        <Field label="기관 *" error={errors.court}>
          <AgencyNameAutocomplete
            value={courtName}
            onChange={onCourtChange}
            scope="all"
            placeholder="예: 서울중앙지방법원, 수원지검"
            inputClassName={inputClass(!!errors.court)}
            aria-invalid={!!errors.court}
          />
          <p className="mt-1 text-[10px] text-text-muted">
            법원·검찰·경찰 등 기관명 일부 입력 시 자동완성
          </p>
        </Field>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 min-h-[44px]"
            onClick={onOpenScourtSearch}
            leftIcon={<ExternalLink size={15} />}
          >
            나의사건검색 연동
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 min-h-[44px]"
            onClick={onQuickRegister}
            disabled={quickLoading}
            leftIcon={
              quickLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Bot size={15} />
              )
            }
          >
            {quickLoading ? quickLoadingLabel : "간편등록"}
          </Button>
        </div>
        {syncPreview && !quickLoading && (
          <div className="text-[11px] text-success-800 bg-success-50 border border-success-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
            <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">법원 연동 결과</p>
              <p className="mt-0.5 text-success-900">{formatQuickSyncDetail(syncPreview)}</p>
              {syncPreview.courtDivision && (
                <p className="mt-1 text-success-800/90">재판부: {syncPreview.courtDivision}</p>
              )}
            </div>
          </div>
        )}
        <p className="text-[10px] text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <Link2 size={12} className="shrink-0 mt-0.5" />
          간편등록: 사건번호·기관·당사자로 봇 자동조회 → 사건 저장 → 기일 연동까지 한 번에 처리합니다.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}
