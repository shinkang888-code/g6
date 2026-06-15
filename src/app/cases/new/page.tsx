"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { saveClient, loadClientsRaw } from "@/lib/clientStorage";
import { StaffMultiPicker } from "@/components/cases/StaffMultiPicker";
import { CaseQuickRegisterSection } from "@/components/cases/CaseQuickRegisterSection";
import {
  CaseInstitutionSection,
  institutionsMapToArray,
  resolveCourtFromInstitutions,
} from "@/components/cases/CaseInstitutionSection";
import {
  createEmptyInstitutionsMap,
  type CaseInstitutionStage,
  trialLevelToCourtStage,
} from "@/lib/caseInstitutionTypes";
import {
  CasePartySection,
  getPrimaryClientName,
  partiesToApiPayload,
} from "@/components/cases/CasePartySection";
import { createInitialParties, partiesByRole, type CasePartyInput } from "@/lib/casePartyTypes";
import {
  buildQuickScourtJob,
  DEFAULT_QUICK_LAWYER,
  DEFAULT_QUICK_STAFF,
  inferQuickCaseType,
  validateQuickRegisterFields,
} from "@/lib/caseQuickRegister";
import { pollScourtJob } from "@/lib/scourtClientPoll";
import {
  formatQuickSyncDetail,
  type QuickLoadingStage,
  type QuickSyncPreview,
  QUICK_LOADING_LABELS,
} from "@/lib/caseQuickSyncUi";
import { usePageTabTitle } from "@/lib/tabTitle";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function NewCasePage() {
  usePageTabTitle("새 사건 등록");
  const router = useRouter();
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    caseNumber: "",
    caseType: "",
    caseName: "",
    trialLevel: "1심",
    managementKey: "",
    receivedDate: new Date().toISOString().split("T")[0],
    amount: "",
    isElectronic: false,
    notes: "",
  });

  const [simpleCourt, setSimpleCourt] = useState("");
  const [quickPartyName, setQuickPartyName] = useState("");
  const [institutions, setInstitutions] = useState(createEmptyInstitutionsMap);
  const [activeStage, setActiveStage] = useState<CaseInstitutionStage>("court_1");
  const [parties, setParties] = useState<CasePartyInput[]>(createInitialParties);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedLawyers, setSelectedLawyers] = useState<string[]>([DEFAULT_QUICK_LAWYER]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([DEFAULT_QUICK_STAFF]);
  const [submitting, setSubmitting] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickLoadingStage, setQuickLoadingStage] = useState<QuickLoadingStage>(null);
  const [syncPreview, setSyncPreview] = useState<QuickSyncPreview | null>(null);

  useEffect(() => {
    setSelectedLawyers((prev) => (prev.length ? prev : [DEFAULT_QUICK_LAWYER]));
    setSelectedStaff((prev) => (prev.length ? prev : [DEFAULT_QUICK_STAFF]));
  }, []);

  const syncQuickPartyToParties = useCallback((name: string) => {
    setParties((prev) =>
      prev.map((p) => (p.role === "client" && p.sortOrder === 0 ? { ...p, name } : p))
    );
  }, []);

  const syncCourtToInstitutions = useCallback((court: string) => {
    setInstitutions((inst) => {
      const stage = trialLevelToCourtStage(form.trialLevel);
      return { ...inst, [stage]: { ...inst[stage], agencyName: court } };
    });
  }, [form.trialLevel]);

  const resolveCourt = () => {
    const fromSimple = simpleCourt.trim();
    if (fromSimple) return fromSimple;
    return resolveCourtFromInstitutions(institutions, activeStage);
  };

  const buildCasePayload = () => {
    const court = resolveCourt();
    const partyName = quickPartyName.trim() || getPrimaryClientName(parties);
    const assignedStaff = selectedLawyers[0] ?? DEFAULT_QUICK_LAWYER;
    const assistants = [...selectedLawyers.slice(1), ...selectedStaff].filter(Boolean).join(", ");
    const caseType =
      form.caseType.trim() || inferQuickCaseType(form.caseNumber.trim(), form.caseType);

    return {
      caseNumber: form.caseNumber.trim(),
      caseType,
      caseName: form.caseName.trim() || caseType || "사건",
      court: court || "미정",
      trialLevel: form.trialLevel.trim() || undefined,
      managementKey: form.managementKey.trim() || undefined,
      activeStage,
      institutions: institutionsMapToArray(institutions),
      parties: partiesToApiPayload(
        quickPartyName.trim()
          ? parties.map((p) =>
              p.role === "client" && p.sortOrder === 0 ? { ...p, name: quickPartyName.trim() } : p
            )
          : parties
      ),
      clientName: partyName || undefined,
      assignedStaff,
      assistants: assistants || undefined,
      receivedDate: form.receivedDate,
      amount: Number(form.amount) || 0,
      isElectronic: form.isElectronic,
      notes: form.notes.trim() || undefined,
      status: "진행중",
    };
  };

  const persistClientsFromParties = () => {
    const list = quickPartyName.trim()
      ? parties.map((p) =>
          p.role === "client" && p.sortOrder === 0 ? { ...p, name: quickPartyName.trim() } : p
        )
      : parties;

    for (const client of partiesByRole(list, "client")) {
      if (!client.name?.trim()) continue;
      const mobile = client.mobile?.trim();
      const phone = client.phone?.trim();
      const existing = loadClientsRaw().find(
        (c) =>
          !c.deletedAt &&
          c.name === client.name.trim() &&
          (c.mobile === mobile || c.phone === phone || (!mobile && !phone))
      );
      if (existing) {
        saveClient({
          id: existing.id,
          name: client.name.trim(),
          phone: phone || undefined,
          mobile: mobile || undefined,
          address: client.address?.trim() || undefined,
          idNumber: client.idNumber?.trim() || undefined,
          bizNumber: client.bizNumber?.trim() || undefined,
          memo: existing.memo,
        });
      } else {
        saveClient({
          name: client.name.trim(),
          phone: phone || undefined,
          mobile: mobile || undefined,
          address: client.address?.trim() || undefined,
          idNumber: client.idNumber?.trim() || undefined,
          bizNumber: client.bizNumber?.trim() || undefined,
        });
      }
    }
  };

  const createCaseOnServer = async (): Promise<string | null> => {
    persistClientsFromParties();
    const res = await fetch("/api/admin/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(buildCasePayload()),
    });
    const json = (await res.json()) as { error?: string; data?: { id?: string } };
    if (!res.ok) {
      toast.error(json.error ?? "사건 등록에 실패했습니다.");
      return null;
    }
    return json.data?.id ?? null;
  };

  const validateDetailSubmit = () => {
    const errs = validateQuickRegisterFields({
      caseNumber: form.caseNumber,
      courtName: simpleCourt,
      partyName: quickPartyName || getPrimaryClientName(parties),
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetailSubmit()) {
      toast.error("간편등록 필수 항목(사건번호·기관·당사자)을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const caseId = await createCaseOnServer();
      if (!caseId) return;
      toast.success("사건이 등록되었습니다.");
      const searchQ = quickPartyName.trim() || form.caseNumber.trim();
      setTimeout(() => router.push(`/cases?q=${encodeURIComponent(searchQ)}`), 600);
    } catch {
      toast.error("네트워크 오류로 사건을 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickRegister = async () => {
    const fields = {
      caseNumber: form.caseNumber,
      courtName: simpleCourt,
      partyName: quickPartyName,
    };
    const errs = validateQuickRegisterFields(fields);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("사건번호·기관·당사자를 입력해주세요.");
      return;
    }

    const job = buildQuickScourtJob(fields);
    if (!job) {
      toast.error("조회 파라미터를 만들 수 없습니다. 입력값을 확인해주세요.");
      return;
    }

    syncQuickPartyToParties(quickPartyName.trim());
    syncCourtToInstitutions(simpleCourt.trim());

    setQuickLoading(true);
    setQuickLoadingStage("saving");
    setSyncPreview(null);
    try {
      const caseId = await createCaseOnServer();
      if (!caseId) return;

      setQuickLoadingStage("polling");
      const enqueueRes = await fetch("/api/court-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ job, async: true }),
      });
      const enqueueJson = (await enqueueRes.json()) as { jobId?: string; error?: string };
      if (!enqueueRes.ok || !enqueueJson.jobId) {
        toast.error(enqueueJson.error ?? "법원 조회 작업 등록 실패");
        setTimeout(() => router.push(`/cases/${caseId}`), 1200);
        return;
      }

      const polled = await pollScourtJob(enqueueJson.jobId, {
        onTick: (status) => {
          if (status === "processing") setQuickLoadingStage("polling");
        },
      });
      if (polled.status !== "done") {
        const errMsg =
          polled.error ??
          polled.hint ??
          "법원 조회가 완료되지 않았습니다. 나의사건검색 연동을 이용해 주세요.";
        toast.error(`사건은 등록됐으나 기일 연동 실패: ${errMsg}`);
        setTimeout(() => router.push(`/cases/${caseId}`), 1200);
        return;
      }

      setQuickLoadingStage("applying");
      const linkRes = await fetch("/api/cases/scourt-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caseId, jobId: enqueueJson.jobId }),
      });
      const linkJson = (await linkRes.json()) as QuickSyncPreview & {
        ok?: boolean;
        error?: string;
        skipReason?: string;
      };

      if (linkJson.ok) {
        const preview: QuickSyncPreview = {
          eventsTotal: linkJson.eventsTotal,
          eventsAdded: linkJson.eventsAdded,
          eventsUpdated: linkJson.eventsUpdated,
          courtDivision: linkJson.courtDivision,
          receivedDate: linkJson.receivedDate,
          syncedCaseName: linkJson.syncedCaseName,
        };
        setSyncPreview(preview);
        if (linkJson.syncedCaseName) update("caseName", linkJson.syncedCaseName);
        if (linkJson.receivedDate) {
          const rd = linkJson.receivedDate.replace(/\./g, "-").slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(rd)) update("receivedDate", rd);
        }
        const detail = formatQuickSyncDetail(preview);
        toast.success(`간편등록 완료 · ${form.caseNumber} (${detail})`);
        setTimeout(() => router.push(`/cases/${caseId}`), 900);
        return;
      }

      const errMsg = linkJson.error ?? linkJson.skipReason ?? "기일 연동 실패";
      toast.error(`사건은 등록됐으나 기일 연동 실패: ${errMsg}`);
      setTimeout(() => router.push(`/cases/${caseId}`), 1200);
    } catch {
      toast.error("간편등록 중 오류가 발생했습니다.");
    } finally {
      setQuickLoading(false);
      setQuickLoadingStage(null);
    }
  };

  const update = (field: string, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "trialLevel" && typeof value === "string") {
        setActiveStage(trialLevelToCourtStage(value));
      }
      if (field === "caseNumber" && typeof value === "string") {
        setInstitutions((inst) => {
          const stage = trialLevelToCourtStage(next.trialLevel);
          const cur = inst[stage];
          if (!cur.caseNumber?.trim()) {
            return { ...inst, [stage]: { ...cur, caseNumber: value } };
          }
          return inst;
        });
      }
      if (field === "caseName" && typeof value === "string") {
        setInstitutions((inst) => {
          const stage = trialLevelToCourtStage(next.trialLevel);
          const cur = inst[stage];
          if (!cur.caseName?.trim()) {
            return { ...inst, [stage]: { ...cur, caseName: value } };
          }
          return inst;
        });
      }
      return next;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const toggleLawyer = (name: string) => {
    setSelectedLawyers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleStaffMember = (name: string) => {
    setSelectedStaff((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const openScourtSearchPopup = () => {
    const w = isMobile ? Math.min(window.screen.width - 16, 520) : 520;
    const h = isMobile ? Math.min(window.screen.height - 48, 640) : 560;
    const left = typeof window !== "undefined" ? (window.screen.width - w) / 2 : 0;
    const top = typeof window !== "undefined" ? (window.screen.height - h) / 2 : 0;
    const params = new URLSearchParams({
      caseNumber: form.caseNumber,
      partyName: quickPartyName || getPrimaryClientName(parties),
      court: simpleCourt,
    });
    window.open(
      `/cases/scourt-search?${params.toString()}`,
      "scourt-search",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`
    );
  };

  return (
    <div className={cn("mx-auto p-4 sm:p-6", isMobile ? "max-w-lg pb-28" : "max-w-3xl")}>
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <Link
          href="/cases"
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-primary-600 transition-colors"
        >
          <ArrowLeft size={15} /> 사건 목록
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700">신건등록</span>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-4 sm:space-y-6"
      >
        <CaseQuickRegisterSection
          caseNumber={form.caseNumber}
          caseType={form.caseType}
          caseName={form.caseName}
          courtName={simpleCourt}
          partyName={quickPartyName}
          errors={errors}
          quickLoading={quickLoading}
          quickLoadingLabel={
            quickLoadingStage ? QUICK_LOADING_LABELS[quickLoadingStage] : "등록·기일 연동 중…"
          }
          syncPreview={syncPreview}
          onCaseNumberChange={(v) => update("caseNumber", v)}
          onCaseTypeChange={(v) => update("caseType", v)}
          onCaseNameChange={(v) => update("caseName", v)}
          onCourtChange={(v) => {
            setSimpleCourt(v);
            syncCourtToInstitutions(v);
            if (errors.court) setErrors((prev) => ({ ...prev, court: "" }));
          }}
          onPartyChange={(v) => {
            setQuickPartyName(v);
            syncQuickPartyToParties(v);
            if (errors.partyName) setErrors((prev) => ({ ...prev, partyName: "" }));
          }}
          onOpenScourtSearch={openScourtSearchPopup}
          onQuickRegister={handleQuickRegister}
          inputClass={inputClass}
        />

        <CaseInstitutionSection
          institutions={institutions}
          activeStage={activeStage}
          onInstitutionsChange={setInstitutions}
          onActiveStageChange={setActiveStage}
          defaultCaseNumber={form.caseNumber}
          defaultCaseName={form.caseName}
          institutionOptional
        />

        <CasePartySection
          parties={parties}
          onPartiesChange={setParties}
          clientNameOptional
        />

        <FormSection title="라. 담당자">
          <p className="text-[11px] text-text-muted -mt-1 mb-2">
            변호사·직원은 선택 사항입니다. 기본값: {DEFAULT_QUICK_LAWYER} / {DEFAULT_QUICK_STAFF}
          </p>
          <StaffMultiPicker
            selectedLawyers={selectedLawyers}
            selectedStaff={selectedStaff}
            onToggleLawyer={toggleLawyer}
            onToggleStaff={toggleStaffMember}
            inputClass={inputClass}
          />
          <FormField label="수임일">
            <input
              type="date"
              value={form.receivedDate}
              onChange={(e) => update("receivedDate", e.target.value)}
              className={inputClass(false)}
            />
          </FormField>
        </FormSection>

        <FormSection title="비고 (선택)">
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="추가 메모나 특이사항"
            rows={3}
            className={cn(inputClass(false), "resize-none")}
          />
        </FormSection>

        <div
          className={cn(
            "flex gap-3 pt-2",
            isMobile && "fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 safe-area-pb"
          )}
        >
          <Button
            type="submit"
            disabled={submitting || quickLoading}
            leftIcon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            className="flex-1 sm:flex-none min-h-[44px]"
          >
            {submitting ? "등록 중…" : "상세 저장"}
          </Button>
          <Link href="/cases" className={isMobile ? "shrink-0" : ""}>
            <Button type="button" variant="outline" className="min-h-[44px]">
              취소
            </Button>
          </Link>
        </div>
      </motion.form>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="p-4 sm:p-5 space-y-4">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    "w-full px-3 py-2.5 text-sm border rounded-lg bg-white transition-all outline-none",
    "focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20",
    hasError ? "border-danger-400 bg-danger-50" : "border-slate-200 hover:border-slate-300"
  );
}
