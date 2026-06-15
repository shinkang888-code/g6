"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  CASE_PARTY_ROLES,
  createEmptyParty,
  getPrimaryClient,
  partiesByRole,
  PARTY_POSITIONS,
  type CasePartyInput,
  type CasePartyRole,
} from "@/lib/casePartyTypes";

type Props = {
  parties: CasePartyInput[];
  onPartiesChange: (next: CasePartyInput[]) => void;
  clientNameError?: string;
  /** 상세 당사자 — 이름 필수 아님 */
  clientNameOptional?: boolean;
};

export function CasePartySection({
  parties,
  onPartiesChange,
  clientNameError,
  clientNameOptional = false,
}: Props) {
  const isMobile = useIsMobile();
  const [activeRole, setActiveRole] = useState<CasePartyRole>("client");
  const roleParties = useMemo(() => partiesByRole(parties, activeRole), [parties, activeRole]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = Math.min(selectedIndex, Math.max(0, roleParties.length - 1));
  const current = roleParties[safeIndex];

  const updateCurrent = useCallback(
    (field: keyof CasePartyInput, value: string | boolean) => {
      if (!current) return;
      const next = parties.map((p) => {
        if (p.role !== current.role || p.sortOrder !== current.sortOrder) return p;
        if (current.id && p.id && p.id !== current.id) return p;
        return { ...p, [field]: value };
      });
      onPartiesChange(next);
    },
    [current, parties, onPartiesChange]
  );

  const addParty = () => {
    const count = partiesByRole(parties, activeRole).length;
    const next = [...parties, createEmptyParty(activeRole, count)];
    onPartiesChange(next);
    setSelectedIndex(count);
  };

  const removeParty = (index: number) => {
    const target = roleParties[index];
    if (!target) return;
    if (activeRole === "client" && roleParties.length <= 1) return;

    const next = parties
      .filter((p) => !(p.role === target.role && p.sortOrder === target.sortOrder))
      .map((p) => {
        if (p.role !== activeRole || p.sortOrder <= target.sortOrder) return p;
        return { ...p, sortOrder: p.sortOrder - 1 };
      });

    onPartiesChange(next);
    setSelectedIndex(Math.max(0, index - 1));
  };

  const selectParty = (index: number) => {
    setSelectedIndex(index);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">다. 당사자</h3>
        <span className="text-[10px] text-slate-500">의뢰인·상대방·제3자</span>
      </div>

      <div className={cn("p-5", isMobile ? "space-y-4" : "grid grid-cols-[1fr_200px] gap-5")}>
        <div className="space-y-4 min-w-0">
          <div
            className={cn(
              "flex gap-1.5",
              isMobile ? "overflow-x-auto pb-1 -mx-1 px-1" : "flex-wrap"
            )}
          >
            {CASE_PARTY_ROLES.map((r) => {
              const count = partiesByRole(parties, r.value).filter((p) => p.name?.trim()).length;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setActiveRole(r.value);
                    setSelectedIndex(0);
                  }}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    activeRole === r.value
                      ? "bg-primary-600 text-white border-primary-600"
                      : count > 0
                        ? "bg-primary-50 text-primary-700 border-primary-200"
                        : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  {r.shortLabel}
                  {count > 0 ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>

          {clientNameError && activeRole === "client" && (
            <p className="text-xs text-danger-600">{clientNameError}</p>
          )}

          {current ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={activeRole === "client" && !clientNameOptional ? "이름 *" : "이름"}>
                  <input
                    type="text"
                    value={current.name}
                    onChange={(e) => updateCurrent("name", e.target.value)}
                    placeholder="이름 또는 법인명"
                    className={inputClass}
                  />
                </Field>
                <Field label="지위">
                  <select
                    value={current.position ?? ""}
                    onChange={(e) => updateCurrent("position", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">선택</option>
                    {PARTY_POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(current.isCorporate)}
                  onChange={(e) => updateCurrent("isCorporate", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                법인
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="휴대전화">
                  <input
                    type="tel"
                    value={current.mobile ?? ""}
                    onChange={(e) => updateCurrent("mobile", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="전화">
                  <input
                    type="tel"
                    value={current.phone ?? ""}
                    onChange={(e) => updateCurrent("phone", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="팩스">
                  <input
                    type="tel"
                    value={current.fax ?? ""}
                    onChange={(e) => updateCurrent("fax", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="이메일">
                  <input
                    type="email"
                    value={current.email ?? ""}
                    onChange={(e) => updateCurrent("email", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="주소">
                <input
                  type="text"
                  value={current.address ?? ""}
                  onChange={(e) => updateCurrent("address", e.target.value)}
                  className={inputClass}
                />
              </Field>

              {activeRole === "client" && (
                <Field label="고객 비고">
                  <textarea
                    value={current.clientMemo ?? ""}
                    onChange={(e) => updateCurrent("clientMemo", e.target.value)}
                    placeholder="고객관리에 저장되는 메모 (사건 비고와 별도)"
                    rows={2}
                    className={cn(inputClass, "resize-none")}
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    고객관리·엑셀의 「메모」에 반영됩니다. 사건 하단 「비고」와는 다릅니다.
                  </p>
                </Field>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="주민/고유번호">
                  <input
                    type="text"
                    value={current.idNumber ?? ""}
                    onChange={(e) => updateCurrent("idNumber", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="사업자등록번호">
                  <input
                    type="text"
                    value={current.bizNumber ?? ""}
                    onChange={(e) => updateCurrent("bizNumber", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted py-4 text-center">
              당사자가 없습니다. 추가 버튼을 눌러 등록하세요.
            </p>
          )}
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[200px]">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-600">
            {CASE_PARTY_ROLES.find((r) => r.value === activeRole)?.label} 목록
          </div>
          <ul className="flex-1 overflow-y-auto p-2 space-y-1">
            {roleParties.length === 0 && (
              <li className="text-xs text-text-muted text-center py-4">등록된 당사자 없음</li>
            )}
            {roleParties.map((p, i) => (
              <li key={p.id ?? `${p.role}-${p.sortOrder}`}>
                <button
                  type="button"
                  onClick={() => selectParty(i)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors",
                    safeIndex === i
                      ? "bg-primary-50 text-primary-800 border border-primary-200"
                      : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <User size={12} className="shrink-0 opacity-60" />
                  <span className="truncate flex-1">{p.name?.trim() || "(이름 없음)"}</span>
                  {(activeRole !== "client" || roleParties.length > 1) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeParty(i);
                      }}
                      className="p-1 rounded hover:bg-danger-50 text-slate-400 hover:text-danger-600"
                      aria-label="제외"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="p-2 border-t border-slate-100">
            <button
              type="button"
              onClick={addParty}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Plus size={14} />
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function partiesToApiPayload(parties: CasePartyInput[]): CasePartyInput[] {
  return parties.filter((p) => p.name?.trim());
}

export function getPrimaryClientName(parties: CasePartyInput[]): string {
  return getPrimaryClient(parties)?.name?.trim() ?? "";
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
