"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchStaffDirectory,
  filterStaffByQuery,
  splitStaffByRole,
  type StaffDirectoryEntry,
} from "@/lib/staffDirectory";

type StaffMultiPickerProps = {
  selectedLawyers: string[];
  selectedStaff: string[];
  onToggleLawyer: (name: string) => void;
  onToggleStaff: (name: string) => void;
  lawyerError?: string;
  inputClass: (hasError: boolean) => string;
};

function StaffCheckboxList({
  items,
  selected,
  onToggle,
  emptyMessage,
}: {
  items: StaffDirectoryEntry[];
  selected: string[];
  onToggle: (name: string) => void;
  emptyMessage: string;
}) {
  if (!items.length) {
    return <p className="px-1 py-2 text-xs text-text-muted">{emptyMessage}</p>;
  }
  return (
    <>
      {items.map((s) => (
        <label
          key={s.id}
          className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
        >
          <input
            type="checkbox"
            checked={selected.includes(s.name)}
            onChange={() => onToggle(s.name)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600"
          />
          <span className="text-slate-700">{s.name}</span>
          <span className="text-[10px] text-text-muted">
            {s.role}
            {s.department ? ` · ${s.department}` : ""}
          </span>
        </label>
      ))}
    </>
  );
}

export function StaffMultiPicker({
  selectedLawyers,
  selectedStaff,
  onToggleLawyer,
  onToggleStaff,
  lawyerError,
  inputClass,
}: StaffMultiPickerProps) {
  const [lawyerSearch, setLawyerSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [directory, setDirectory] = useState<StaffDirectoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStaffDirectory()
      .then(({ staff, error }) => {
        if (cancelled) return;
        setDirectory(staff);
        setLoadError(error ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setDirectory([]);
          setLoadError("직원 목록을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { lawyers, employees } = useMemo(() => splitStaffByRole(directory), [directory]);
  const filteredLawyers = useMemo(
    () => filterStaffByQuery(lawyers, lawyerSearch),
    [lawyers, lawyerSearch]
  );
  const filteredEmployees = useMemo(
    () => filterStaffByQuery(employees, staffSearch),
    [employees, staffSearch]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin" />
        직원 목록 불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {loadError && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {loadError} (회원 관리에서 승인된 직원이 표시됩니다.)
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">변호사 *</label>
          <input
            type="text"
            value={lawyerSearch}
            onChange={(e) => setLawyerSearch(e.target.value)}
            placeholder="이름 검색 후 선택"
            className={cn(inputClass(!!lawyerError), "mb-2")}
          />
          <div className="border border-slate-200 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto text-xs">
            <StaffCheckboxList
              items={filteredLawyers}
              selected={selectedLawyers}
              onToggle={onToggleLawyer}
              emptyMessage="등록된 변호사가 없습니다."
            />
          </div>
          {selectedLawyers.length > 0 && (
            <p className="mt-1.5 text-xs text-text-muted">선택: {selectedLawyers.join(", ")}</p>
          )}
          {lawyerError && <p className="mt-1 text-xs text-danger-600">{lawyerError}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">직원</label>
          <input
            type="text"
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
            placeholder="이름 검색 후 선택"
            className={cn(inputClass(false), "mb-2")}
          />
          <div className="border border-slate-200 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto text-xs">
            <StaffCheckboxList
              items={filteredEmployees}
              selected={selectedStaff}
              onToggle={onToggleStaff}
              emptyMessage="등록된 직원이 없습니다."
            />
          </div>
          {selectedStaff.length > 0 && (
            <p className="mt-1.5 text-xs text-text-muted">선택: {selectedStaff.join(", ")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
