"use client";

import { User, X } from "lucide-react";
import type { StaffMember } from "@/lib/types";

type Props = {
  label: string;
  required?: boolean;
  roleHint?: "필수결재자" | "선택결재자";
  search: string;
  onSearchChange: (v: string) => void;
  selected: StaffMember[];
  onAdd: (s: StaffMember) => void;
  onRemove: (id: string) => void;
  candidates: StaffMember[];
  staffLoaded: boolean;
};

export function ApproverOrderPicker({
  label,
  required,
  roleHint,
  search,
  onSearchChange,
  selected,
  onAdd,
  onRemove,
  candidates,
  staffLoaded,
}: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
        {required || roleHint === "필수결재자"
          ? " (필수결재자)"
          : " (선택결재자)"}{" "}
        — 이름 검색 후 여러 명 선택 가능
      </label>
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="이름 또는 부서로 검색"
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-2 focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 max-h-20 overflow-y-auto">
          {selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-sm"
            >
              <span className="font-medium text-slate-800">{s.name}</span>
              <span className="text-xs text-text-muted">
                {[s.role, s.department].filter(Boolean).join(" · ") || "직원"}
              </span>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                className="text-slate-400 hover:text-danger-500 p-0.5"
                aria-label="제거"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="max-h-[4.5rem] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
        {!staffLoaded ? (
          <div className="px-3 py-3 text-xs text-text-muted text-center">직원 목록 불러오는 중…</div>
        ) : candidates.length === 0 ? (
          <div className="px-3 py-3 text-xs text-text-muted text-center">
            {search.trim() ? "검색 결과가 없습니다." : "이름 또는 부서로 검색 후 선택"}
          </div>
        ) : (
          candidates.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onAdd(s)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <User size={14} className="text-slate-400 shrink-0" />
              <span className="font-medium text-slate-800">{s.name}</span>
              <span className="text-xs text-text-muted">
                {[s.role, s.department].filter(Boolean).join(" · ") || "직원"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
