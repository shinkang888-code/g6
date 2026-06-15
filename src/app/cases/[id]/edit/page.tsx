"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Save, X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { CaseItem } from "@/lib/types";
import { StaffMultiPicker } from "@/components/cases/StaffMultiPicker";
import { CASE_EDITED_MESSAGE_TYPE, isCaseEditPopupWindow } from "@/lib/caseEditPopup";
import { DEFAULT_TAB_TITLE, formatTaskTabTitle, setDocumentTabTitle } from "@/lib/tabTitle";
import { appendCaseHistory } from "@/lib/caseHistoryStorage";
import { trialFormEditFetchHeaders } from "@/lib/trialNameMask";
import {
  CaseInstitutionSection,
  institutionsListToMap,
  institutionsMapToArray,
  resolveCourtFromInstitutions,
} from "@/components/cases/CaseInstitutionSection";
import {
  createEmptyInstitutionsMap,
  type CaseInstitutionStage,
  trialLevelToCourtStage,
  TRIAL_LEVELS,
  type CaseInstitution,
} from "@/lib/caseInstitutionTypes";
import {
  CasePartySection,
  getPrimaryClientName,
  partiesToApiPayload,
} from "@/components/cases/CasePartySection";
import {
  buildPartiesFromLegacyCase,
  createInitialParties,
  type CaseParty,
  type CasePartyInput,
} from "@/lib/casePartyTypes";
import { partyInputFromParty } from "@/lib/casePartyApi";

const caseTypes = ["형사", "민사", "행정", "헌법", "가사", "파산/회생", "기타"];
const statuses: CaseItem["status"][] = ["진행중", "종결", "사임"];

function getCurrentAccount(): string {
  if (typeof window === "undefined") return "관리자";
  try {
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("lawygo_session="));
    if (!cookie) return "관리자";
    const payload = cookie.split("=")[1]?.split(".")[0];
    if (!payload) return "관리자";
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.name ?? decoded.loginId ?? "관리자";
  } catch {
    return "관리자";
  }
}

function splitStaffFields(assignedStaff: string, assistants: string) {
  const lawyers: string[] = [];
  const staff: string[] = [];
  if (assignedStaff.trim()) lawyers.push(assignedStaff.trim());
  if (assistants.trim()) {
    for (const name of assistants.split(",").map((s) => s.trim()).filter(Boolean)) {
      staff.push(name);
    }
  }
  return { lawyers, staff };
}

export default function CaseEditPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const [isPopupEmbed, setIsPopupEmbed] = useState(() => searchParams.get("popup") === "1");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    caseNumber: "",
    caseType: "",
    caseName: "",
    trialLevel: "1심",
    managementKey: "",
    courtDivision: "",
    receivedDate: "",
    amount: "",
    isElectronic: false,
    status: "진행중" as CaseItem["status"],
    notes: "",
  });
  const [selectedLawyers, setSelectedLawyers] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [institutions, setInstitutions] = useState(createEmptyInstitutionsMap);
  const [activeStage, setActiveStage] = useState<CaseInstitutionStage>("court_1");
  const [parties, setParties] = useState<CasePartyInput[]>(createInitialParties);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsPopupEmbed(
      searchParams.get("popup") === "1" || isCaseEditPopupWindow(window.location.pathname)
    );
  }, [searchParams]);

  useEffect(() => {
    const fromQuery = searchParams.get("tab");
    const label = fromQuery?.trim() || getPrimaryClientName(parties) || form.caseNumber.trim();
    if (label) {
      setDocumentTabTitle(formatTaskTabTitle("사건수정", label));
    }
    return () => setDocumentTabTitle(DEFAULT_TAB_TITLE);
  }, [searchParams, parties, form.caseNumber]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const caseRes = await fetch(`/api/admin/cases?id=${encodeURIComponent(id)}`, {
          credentials: "include",
          headers: trialFormEditFetchHeaders,
        });
        const caseJson = (await caseRes.json()) as { data?: CaseItem[] };
        const item = Array.isArray(caseJson.data) ? caseJson.data[0] : null;
        if (!item) return;

        setForm({
          caseNumber: item.caseNumber ?? "",
          caseType: item.caseType ?? "",
          caseName: item.caseName ?? "",
          trialLevel: item.trialLevel ?? "1심",
          managementKey: item.managementKey ?? "",
          courtDivision: item.courtDivision ?? "",
          receivedDate: item.receivedDate?.slice(0, 10) ?? "",
          amount: item.amount ? String(item.amount) : "",
          isElectronic: Boolean(item.isElectronic),
          status: item.status ?? "진행중",
          notes: item.notes ?? "",
        });
        const stage =
          (item.activeStage as CaseInstitutionStage) ||
          trialLevelToCourtStage(item.trialLevel ?? "1심");
        setActiveStage(stage);
        const { lawyers, staff } = splitStaffFields(item.assignedStaff ?? "", item.assistants ?? "");
        setSelectedLawyers(lawyers);
        setSelectedStaff(staff);

        const instRes = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/institutions`, {
          credentials: "include",
          headers: trialFormEditFetchHeaders,
        });
        const instJson = (await instRes.json()) as { data?: CaseInstitution[] };
        const list = Array.isArray(instJson.data) ? instJson.data : [];
        if (list.length > 0) {
          setInstitutions(institutionsListToMap(list));
        } else {
          const seedStage = stage;
          setInstitutions((prev) => ({
            ...prev,
            [seedStage]: {
              ...prev[seedStage],
              agencyName: item.court ?? "",
              caseNumber: item.caseNumber ?? "",
              caseName: item.caseName ?? "",
            },
          }));
        }

        const partyRes = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/parties`, {
          credentials: "include",
          headers: trialFormEditFetchHeaders,
        });
        const partyJson = (await partyRes.json()) as { data?: CaseParty[] };
        const partyList = Array.isArray(partyJson.data) ? partyJson.data : [];
        if (partyList.length > 0) {
          setParties(partyList.map(partyInputFromParty));
        } else {
          const seed = buildPartiesFromLegacyCase({
            client_name: item.clientName,
            client_position: item.clientPosition,
            opponent_name: item.opponentName,
            client_id: item.clientId,
          });
          setParties(seed.length > 0 ? seed : createInitialParties());
        }
      } catch {
        toast.error("사건 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const update = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const toggleLawyer = (name: string) => {
    setSelectedLawyers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
    if (errors.assignedStaff) setErrors((prev) => ({ ...prev, assignedStaff: "" }));
  };

  const toggleStaffMember = (name: string) => {
    setSelectedStaff((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.caseNumber.trim()) errs.caseNumber = "사건번호를 입력하세요.";
    if (!form.caseType.trim()) errs.caseType = "사건종류를 선택하세요.";
    if (!form.caseName.trim()) errs.caseName = "사건명을 입력하세요.";
    if (!resolveCourtFromInstitutions(institutions, activeStage)) {
      errs.court = "계속기관 탭에서 기관명을 입력하세요.";
    }
    if (!getPrimaryClientName(parties)) errs.clientName = "대표 의뢰인 이름을 입력하세요.";
    if (selectedLawyers.length === 0) errs.assignedStaff = "담당 변호사를 1명 이상 선택하세요.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const notifySaved = () => {
    const msg = { type: CASE_EDITED_MESSAGE_TYPE, caseId: id };
    try {
      window.parent?.postMessage(msg, window.location.origin);
      window.opener?.postMessage(msg, window.location.origin);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("필수 항목을 입력해 주세요.");
      return;
    }

    const assignedStaff = selectedLawyers[0] ?? "";
    const assistants = [...selectedLawyers.slice(1), ...selectedStaff].filter(Boolean).join(", ");

    const court = resolveCourtFromInstitutions(institutions, activeStage);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          caseNumber: form.caseNumber.trim(),
          caseType: form.caseType.trim(),
          caseName: form.caseName.trim(),
          court,
          trialLevel: form.trialLevel.trim() || undefined,
          managementKey: form.managementKey.trim() || undefined,
          courtDivision: form.courtDivision.trim() || undefined,
          activeStage,
          clientName: getPrimaryClientName(parties),
          assignedStaff,
          assistants: assistants || undefined,
          receivedDate: form.receivedDate || undefined,
          amount: Number(form.amount) || 0,
          isElectronic: form.isElectronic,
          status: form.status,
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "저장에 실패했습니다.");
        return;
      }

      const instRes = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/institutions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          institutions: institutionsMapToArray(institutions),
          activeStage,
        }),
      });
      const instJson = (await instRes.json()) as { error?: string };
      if (!instRes.ok) {
        toast.error(instJson.error ?? "계속기관 저장에 실패했습니다.");
        return;
      }

      const partyRes = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/parties`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ parties: partiesToApiPayload(parties) }),
      });
      const partyJson = (await partyRes.json()) as { error?: string };
      if (!partyRes.ok) {
        toast.error(partyJson.error ?? "당사자 저장에 실패했습니다.");
        return;
      }

      appendCaseHistory({
        caseId: id,
        caseNumber: form.caseNumber.trim(),
        clientName: getPrimaryClientName(parties),
        action: "수정",
        accountName: getCurrentAccount(),
        timestamp: new Date().toISOString(),
        details: "사건 등록 정보 수정",
      });

      toast.success("저장되었습니다.");
      notifySaved();

      if (!isPopupEmbed && window.opener) {
        window.opener.focus();
        window.close();
      }
    } catch {
      toast.error("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    cn(
      "w-full px-3 py-2 text-sm border rounded-lg bg-white outline-none",
      "focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20",
      hasError ? "border-danger-400 bg-danger-50" : "border-slate-200"
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[240px] text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin mr-2" />
        사건 정보를 불러오는 중...
      </div>
    );
  }

  if (!form.caseNumber && !form.caseName) {
    return (
      <div className="p-6 text-center text-slate-500">
        사건을 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className={cn("mx-auto p-6", isPopupEmbed ? "max-w-none h-full overflow-y-auto" : "max-w-3xl")}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-slate-900">사건 등록 · 수정</h1>
        {!isPopupEmbed && (
          <button
            type="button"
            onClick={() => window.close()}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-700">가. 기초사항</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">관리키</label>
                <input
                  type="text"
                  value={form.managementKey}
                  onChange={(e) => update("managementKey", e.target.value)}
                  className={inputClass(false)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">심급</label>
                <select
                  value={form.trialLevel}
                  onChange={(e) => update("trialLevel", e.target.value)}
                  className={inputClass(false)}
                >
                  {TRIAL_LEVELS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">사건번호 *</label>
                <input
                  type="text"
                  value={form.caseNumber}
                  onChange={(e) => update("caseNumber", e.target.value)}
                  className={inputClass(!!errors.caseNumber)}
                />
                {errors.caseNumber && (
                  <p className="mt-1 text-xs text-danger-600 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.caseNumber}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">사건종류 *</label>
                <select
                  value={form.caseType}
                  onChange={(e) => update("caseType", e.target.value)}
                  className={inputClass(!!errors.caseType)}
                >
                  <option value="">선택</option>
                  {caseTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.caseType && <p className="mt-1 text-xs text-danger-600">{errors.caseType}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">사건명 *</label>
              <input
                type="text"
                value={form.caseName}
                onChange={(e) => update("caseName", e.target.value)}
                className={inputClass(!!errors.caseName)}
              />
              {errors.caseName && <p className="mt-1 text-xs text-danger-600">{errors.caseName}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">재판부·기관연락처</label>
              <textarea
                value={form.courtDivision}
                onChange={(e) => update("courtDivision", e.target.value)}
                rows={2}
                className={cn(inputClass(false), "resize-none")}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isElectronic"
                checked={form.isElectronic}
                onChange={(e) => update("isElectronic", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600"
              />
              <label htmlFor="isElectronic" className="text-sm text-slate-700 cursor-pointer">
                전자사건 (ELEC)
              </label>
            </div>
          </div>
        </div>

        <CaseInstitutionSection
          institutions={institutions}
          activeStage={activeStage}
          onInstitutionsChange={setInstitutions}
          onActiveStageChange={setActiveStage}
          defaultCaseNumber={form.caseNumber}
          defaultCaseName={form.caseName}
          courtError={errors.court}
        />

        <CasePartySection
          parties={parties}
          onPartiesChange={setParties}
          clientNameError={errors.clientName}
        />

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-700">라. 담당자</h3>
          </div>
          <div className="p-5">
            <StaffMultiPicker
              selectedLawyers={selectedLawyers}
              selectedStaff={selectedStaff}
              onToggleLawyer={toggleLawyer}
              onToggleStaff={toggleStaffMember}
              lawyerError={errors.assignedStaff}
              inputClass={inputClass}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-700">기타</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">수임일</label>
                <input
                  type="date"
                  value={form.receivedDate}
                  onChange={(e) => update("receivedDate", e.target.value)}
                  className={inputClass(false)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">수임료</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => update("amount", e.target.value)}
                  className={inputClass(false)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">진행상태</label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className={inputClass(false)}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">비고</label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                className={cn(inputClass(false), "resize-none")}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" leftIcon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={submitting}>
            {submitting ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </div>
  );
}
