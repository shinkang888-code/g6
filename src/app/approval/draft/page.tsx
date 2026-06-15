"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Paperclip, X, Send, Eye } from "lucide-react";
import type { ApprovalDocType, ApprovalMetadata, StaffMember, ApprovalStep } from "@/lib/types";
import { createApprovalDoc, fetchApprovalDetail, updateApprovalDoc } from "@/lib/approvalApi";
import { ApproverOrderPicker } from "@/components/approval/ApproverOrderPicker";
import { CaseSearchPicker } from "@/components/approval/CaseSearchPicker";
import {
  LAWTOP_DRAFT_TYPES,
  defaultTitleForType,
  buildNotesWithMetadata,
  type LawtopDraftType,
} from "@/lib/approvalConfig";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import {
  APPROVER_ORDERS,
  getApproverLabel,
  getApproverRoleHint,
  isRequiredApproverOrder,
} from "@/lib/approvalLineConfig";

const LEAVE_TYPES = ["출장", "휴가", "외근", "교육", "기타"] as const;

function getCurrentAccountNameFromCookie(): string {
  if (typeof window === "undefined") return "";
  try {
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("lawygo_session="));
    if (!cookie) return "";
    const payload = cookie.split("=")[1]?.split(".")[0];
    if (!payload) return "";
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.name ?? decoded.loginId ?? "";
  } catch {
    return "";
  }
}

function parseInitialType(raw: string | null): LawtopDraftType {
  if (raw && LAWTOP_DRAFT_TYPES.some((t) => t.value === raw)) {
    return raw as LawtopDraftType;
  }
  return "기안서";
}

export default function ApprovalDraftPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id")?.trim() || "";
  const isEditMode = Boolean(editId);
  const initialType = parseInitialType(searchParams.get("type"));

  const [docType, setDocType] = useState<LawtopDraftType>(initialType);
  const [title, setTitle] = useState(() => defaultTitleForType(initialType));
  const [caseId, setCaseId] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [caseName, setCaseName] = useState("");
  const [amount, setAmount] = useState("");
  const [financeEntryId, setFinanceEntryId] = useState("");
  const [paymentPurpose, setPaymentPurpose] = useState("");
  const [payee, setPayee] = useState("");
  const [leaveType, setLeaveType] = useState<string>(LEAVE_TYPES[0]);
  const [travelFrom, setTravelFrom] = useState("");
  const [travelTo, setTravelTo] = useState("");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    const t = searchParams.get("type");
    if (t) {
      const parsed = parseInitialType(t);
      setDocType(parsed);
      setTitle(defaultTitleForType(parsed));
    }
    const cid = searchParams.get("caseId");
    const cnum = searchParams.get("caseNumber");
    const amt = searchParams.get("amount");
    const eid = searchParams.get("financeEntryId");
    if (cid) setCaseId(cid);
    if (cnum) setCaseNumber(cnum);
    if (amt) setAmount(amt);
    if (eid) setFinanceEntryId(eid);
  }, [searchParams]);

  const [drafterName, setDrafterName] = useState<string>("");
  const [drafterId, setDrafterId] = useState<string>("");
  const [drafterLoginId, setDrafterLoginId] = useState<string>("");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [approversByOrder, setApproversByOrder] = useState<Record<number, StaffMember[]>>({
    1: [],
    2: [],
    3: [],
    4: [],
  });
  const [searchByOrder, setSearchByOrder] = useState<Record<number, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
  });
  const [referrers, setReferrers] = useState<StaffMember[]>([]);
  const [referrerSearch, setReferrerSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<{ name: string; data: string }[]>([]);
  const [loadingDoc, setLoadingDoc] = useState(Boolean(editId));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function apply(u: { name?: string; loginId?: string; id?: string; userId?: string } | null) {
      if (!u) return;
      setDrafterName(u.name || u.loginId || "");
      setDrafterId(u.id ?? u.userId ?? "me");
      setDrafterLoginId(u.loginId ?? "");
    }
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) return apply(d.user);
        return fetch("/api/auth/session", { credentials: "include" })
          .then((r) => r.json())
          .then((s) => s?.user && apply(s.user));
      })
      .catch(() => {
        setDrafterName(getCurrentAccountNameFromCookie() || "기안자");
      });
  }, []);

  useEffect(() => {
    fetch("/api/staff", { credentials: "include", cache: "no-store" })
      .then((r) => r.json().catch(() => ({})) as Promise<{ staff?: StaffMember[] }>)
      .then((d) => {
        setStaffLoaded(true);
        setStaffList(Array.isArray(d?.staff) ? d.staff : []);
      })
      .catch(() => setStaffLoaded(true));
  }, []);

  useEffect(() => {
    if (!editId || !staffLoaded) return;
    let cancelled = false;
    setLoadingDoc(true);
    fetchApprovalDetail(editId)
      .then((detail) => {
        if (cancelled) return;
        const doc = detail.data;
        setDocType(
          LAWTOP_DRAFT_TYPES.some((t) => t.value === doc.type)
            ? (doc.type as LawtopDraftType)
            : "기안서"
        );
        setTitle(doc.title);
        setCaseId(doc.caseId ?? "");
        setCaseNumber(doc.caseNumber ?? "");
        if (doc.amount != null) setAmount(String(doc.amount));
        const meta = doc.metadata ?? {};
        setPaymentPurpose(meta.paymentPurpose ?? "");
        setPayee(meta.payee ?? "");
        if (meta.leaveType) setLeaveType(meta.leaveType);
        setTravelFrom(meta.travelFrom ?? "");
        setTravelTo(meta.travelTo ?? "");
        setDestination(meta.destination ?? "");
        setNotes(doc.notes ?? "");

        const byOrder: Record<number, StaffMember[]> = { 1: [], 2: [], 3: [], 4: [] };
        for (const step of doc.approvalLine) {
          const matched =
            staffList.find((s) => s.id === step.staffId) ??
            ({
              id: step.staffId,
              name: step.staffName,
              role: step.role,
              department: "",
              email: "",
              phone: "",
              level: 1,
            } as StaffMember);
          if (byOrder[step.order]) byOrder[step.order].push(matched);
        }
        setApproversByOrder(byOrder);

        const refs: StaffMember[] = [];
        for (const refId of doc.referrerIds ?? []) {
          const matched = staffList.find((s) => s.id === refId);
          if (matched) refs.push(matched);
        }
        if (!refs.length && doc.referrerNames?.length) {
          for (const name of doc.referrerNames) {
            const matched = staffList.find((s) => s.name === name);
            if (matched) refs.push(matched);
          }
        }
        setReferrers(refs);
        setExistingAttachments(detail.attachmentData ?? []);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "결재 문서를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDoc(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, staffLoaded, staffList]);

  const handleTypeChange = (next: LawtopDraftType) => {
    setDocType(next);
    setTitle(defaultTitleForType(next));
  };

  const insertCaseInfo = async () => {
    if (!caseId) {
      toast.error("관련사건을 먼저 선택하세요.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/cases?id=${encodeURIComponent(caseId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      const item = Array.isArray(json.data) ? json.data[0] : null;
      if (!item) {
        toast.error("사건 정보를 불러오지 못했습니다.");
        return;
      }
      const block = [
        "[사건정보]",
        `사건번호: ${item.caseNumber ?? caseNumber}`,
        `사건명: ${item.caseName ?? ""}`,
        `의뢰인: ${item.clientName ?? ""}`,
        `법원: ${item.court ?? ""}`,
        `담당: ${item.assignedStaff ?? ""}`,
        item.notes ? `비고: ${item.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${block}` : block));
      toast.success("사건 정보를 내용에 삽입했습니다.");
    } catch {
      toast.error("사건 정보 조회 실패");
    }
  };

  const currentUser: StaffMember = useMemo(() => {
    const name = drafterName || getCurrentAccountNameFromCookie() || "기안자";
    return {
      id: drafterId || "me",
      name,
      role: "직원",
      department: "",
      email: "",
      phone: "",
      level: 1,
      loginId: drafterLoginId || undefined,
    };
  }, [drafterName, drafterId, drafterLoginId]);

  const isCurrentUser = useCallback(
    (s: StaffMember) => s.id === currentUser.id || (currentUser.loginId && s.loginId === currentUser.loginId),
    [currentUser.id, currentUser.loginId]
  );

  const staffWithoutSelf = useMemo(
    () => staffList.filter((s) => !isCurrentUser(s)),
    [staffList, isCurrentUser]
  );

  const departments = useMemo(
    () => Array.from(new Set(staffList.map((s) => s.department).filter(Boolean))).sort(),
    [staffList]
  );

  const filterStaff = useCallback((list: StaffMember[], q: string) => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(t)) ||
        (s.department && s.department.toLowerCase().includes(t)) ||
        (s.role && s.role.toLowerCase().includes(t))
    );
  }, []);

  const allApproverIds = useMemo(
    () => new Set(APPROVER_ORDERS.flatMap((o) => approversByOrder[o].map((s) => s.id))),
    [approversByOrder]
  );
  const referrerIds = useMemo(() => new Set(referrers.map((s) => s.id)), [referrers]);

  const candidatesForOrder = useCallback(
    (order: number) => {
      const blocked = new Set([
        ...APPROVER_ORDERS.filter((o) => o !== order).flatMap((o) => approversByOrder[o].map((s) => s.id)),
        ...referrers.map((s) => s.id),
      ]);
      return filterStaff(
        staffWithoutSelf.filter((s) => !blocked.has(s.id)),
        searchByOrder[order] ?? ""
      );
    },
    [approversByOrder, referrers, staffWithoutSelf, searchByOrder, filterStaff]
  );

  const referrerFiltered = useMemo(
    () => filterStaff(staffWithoutSelf.filter((s) => !allApproverIds.has(s.id)), referrerSearch),
    [staffWithoutSelf, allApproverIds, referrerSearch, filterStaff]
  );

  const referrerDepartmentsFiltered = useMemo(() => {
    const q = referrerSearch.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.toLowerCase().includes(q));
  }, [departments, referrerSearch]);

  const addApprover = (order: number, s: StaffMember) => {
    setApproversByOrder((prev) => ({
      ...prev,
      [order]: prev[order].some((x) => x.id === s.id) ? prev[order] : [...prev[order], s],
    }));
    setSearchByOrder((prev) => ({ ...prev, [order]: "" }));
  };
  const removeApprover = (order: number, staffId: string) => {
    setApproversByOrder((prev) => ({
      ...prev,
      [order]: prev[order].filter((x) => x.id !== staffId),
    }));
  };
  const addReferrer = (s: StaffMember) => {
    if (referrerIds.has(s.id)) return;
    setReferrers((prev) => [...prev, s]);
    setReferrerSearch("");
  };
  const addReferrersByDepartment = (department: string) => {
    const toAdd = staffWithoutSelf.filter(
      (s) => s.department === department && !referrerIds.has(s.id) && !allApproverIds.has(s.id)
    );
    if (toAdd.length === 0) return;
    setReferrers((prev) => [...prev, ...toAdd]);
    setReferrerSearch("");
    toast.success(`${department} ${toAdd.length}명이 참조자로 추가되었습니다.`);
  };
  const removeReferrer = (staffId: string) => {
    setReferrers((prev) => prev.filter((x) => x.id !== staffId));
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    const newFiles = Array.from(selected).map((file) => ({
      id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2)}`,
      file,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("제목을 입력하세요.");
      return;
    }
    if (approversByOrder[1].length === 0) {
      toast.error("결재자1(1차) 필수결재자를 1명 이상 선택하세요.");
      return;
    }
    if (docType === "지급품의서" && !amount.trim()) {
      toast.error("지급품의서는 지급금액을 입력하세요.");
      return;
    }

    setSubmitting(true);

    const approvalLine: ApprovalStep[] = APPROVER_ORDERS.flatMap((order) =>
      approversByOrder[order].map((s) => ({
        order: order as ApprovalStep["order"],
        staffId: s.id,
        staffName: s.name,
        role: s.role,
        status: "대기" as const,
      }))
    );

    const metadata: ApprovalMetadata = {};
    if (docType === "지급품의서") {
      metadata.paymentPurpose = paymentPurpose.trim() || undefined;
      metadata.payee = payee.trim() || undefined;
    }
    if (docType === "근태행선지") {
      metadata.leaveType = leaveType;
      metadata.travelFrom = travelFrom || undefined;
      metadata.travelTo = travelTo || undefined;
      metadata.destination = destination.trim() || undefined;
    }

    const fullNotes = buildNotesWithMetadata(docType, notes, metadata);

    try {
      const newAttachmentData = files.length
        ? await Promise.all(
            files.map(
              (f) =>
                new Promise<{ name: string; data: string }>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () =>
                    resolve({ name: f.file.name, data: reader.result as string });
                  reader.readAsDataURL(f.file);
                })
            )
          )
        : [];

      const attachmentData =
        newAttachmentData.length > 0
          ? [...existingAttachments, ...newAttachmentData]
          : existingAttachments;

      const attachmentNames = attachmentData.map((a) => a.name);

      const payload = {
        title: title.trim(),
        type: docType as ApprovalDocType,
        caseId: caseId || undefined,
        caseNumber: caseNumber || undefined,
        amount:
          docType === "지급품의서" || docType === "청구서"
            ? Number(amount.replace(/,/g, "")) || 0
            : undefined,
        financeEntryId: financeEntryId || undefined,
        metadata,
        approvalLine,
        notes: fullNotes || undefined,
        attachmentNames: attachmentNames.length ? attachmentNames : undefined,
        attachmentData: attachmentData.length ? attachmentData : undefined,
        keepExistingAttachments: attachmentData.length > 0,
        referrerNames: referrers.length > 0 ? referrers.map((s) => s.name) : undefined,
        referrerIds: referrers.length > 0 ? referrers.map((s) => s.id) : undefined,
      };

      const saved = isEditMode
        ? await updateApprovalDoc(editId, payload)
        : await createApprovalDoc(payload);

      if (typeof window !== "undefined") {
        sessionStorage.setItem("lawygo_approval_pending_refresh", "1");
        sessionStorage.setItem("lawygo_approval_select_id", saved.id);
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: isEditMode ? "APPROVAL_DRAFT_UPDATE" : "APPROVAL_DRAFT_SUBMIT", payload: saved },
            window.location.origin
          );
        }
      }
      toast.success(isEditMode ? "결재 문서를 저장했습니다." : "결재 요청을 전송했습니다.", {
        description: isEditMode ? "수정 내용이 반영되었습니다." : "결재선 순서대로 알림이 발송됩니다.",
      });
      setTimeout(() => window.close(), 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {loadingDoc ? (
        <div className="max-w-2xl mx-auto py-16 text-center text-sm text-text-muted">
          결재 문서 불러오는 중…
        </div>
      ) : (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">
            {isEditMode ? "전자결재 수정" : "전자결재 기안"}
          </h1>
          <span className="text-xs text-text-muted">
            기안인: {drafterName || "—"} · {new Date().toLocaleDateString("ko-KR")}
          </span>
        </div>

        {/* 문서 유형 (LawTop 드롭다운) */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <label className="block text-xs font-medium text-slate-600">문서 유형</label>
          <select
            value={docType}
            onChange={(e) => handleTypeChange(e.target.value as LawtopDraftType)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
          >
            {LAWTOP_DRAFT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.description}
              </option>
            ))}
          </select>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
            />
          </div>
          <CaseSearchPicker
            caseId={caseId}
            caseNumber={caseNumber}
            caseName={caseName}
            onSelect={(hit) => {
              if (!hit) {
                setCaseId("");
                setCaseNumber("");
                setCaseName("");
                return;
              }
              setCaseId(hit.id);
              setCaseNumber(hit.caseNumber);
              setCaseName(hit.caseName);
            }}
          />
          {caseId && (
            <p className="text-xs text-text-muted truncate">
              {caseName ? `${caseName} · ` : ""}
              {caseNumber}
            </p>
          )}
        </section>

        {/* 유형별 필드 */}
        {docType === "지급품의서" && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">지급금액 (원)</label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="예: 1500000"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">지급목적</label>
              <input
                type="text"
                value={paymentPurpose}
                onChange={(e) => setPaymentPurpose(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">지급대상</label>
              <input
                type="text"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </section>
        )}

        {docType === "청구서" && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">청구금액 (원)</label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 3000000"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            {financeEntryId && (
              <p className="text-xs text-text-muted mt-2">연결된 청구 항목 ID: {financeEntryId}</p>
            )}
          </section>
        )}

        {docType === "근태행선지" && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">구분</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              >
                {LEAVE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">행선지</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">시작일</label>
              <input
                type="date"
                value={travelFrom}
                onChange={(e) => setTravelFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">종료일</label>
              <input
                type="date"
                value={travelTo}
                onChange={(e) => setTravelTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </section>
        )}

        {/* 결재선 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-700">결재선</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {APPROVER_ORDERS.map((order) => (
                <ApproverOrderPicker
                  key={order}
                  label={getApproverLabel(order)}
                  required={isRequiredApproverOrder(order)}
                  roleHint={getApproverRoleHint(order)}
                  search={searchByOrder[order] ?? ""}
                  onSearchChange={(v) => setSearchByOrder((prev) => ({ ...prev, [order]: v }))}
                  selected={approversByOrder[order]}
                  onAdd={(s) => addApprover(order, s)}
                  onRemove={(id) => removeApprover(order, id)}
                  candidates={candidatesForOrder(order)}
                  staffLoaded={staffLoaded}
                />
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                참조/협조 (부서 일괄·개별 선택 — 해당 직원은 참조/협조 탭에서 열람)
              </label>
              <input
                type="text"
                value={referrerSearch}
                onChange={(e) => setReferrerSearch(e.target.value)}
                placeholder="부서명·이름 검색"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-2 focus:border-primary-400 outline-none"
              />
              {referrers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {referrers.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm"
                    >
                      <Eye size={14} className="text-slate-400" />
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <button type="button" onClick={() => removeReferrer(s.id)} className="text-slate-400 hover:text-danger-500 p-0.5">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="max-h-[7rem] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {!staffLoaded ? (
                  <div className="px-3 py-3 text-xs text-text-muted text-center">직원 목록 불러오는 중…</div>
                ) : (
                  <>
                    {referrerDepartmentsFiltered.map((dept) => {
                      const count = staffWithoutSelf.filter(
                        (s) => s.department === dept && !referrerIds.has(s.id) && !allApproverIds.has(s.id)
                      ).length;
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => addReferrersByDepartment(dept)}
                          disabled={count === 0}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                          <span className="font-medium text-slate-800">{dept}</span>
                          <span className="text-xs text-primary-600 shrink-0">
                            {count > 0 ? `전체 ${count}명 참조` : "선택됨"}
                          </span>
                        </button>
                      );
                    })}
                    {referrerSearch.trim() &&
                      referrerFiltered.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => addReferrer(s)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <Eye size={14} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800">{s.name}</span>
                          <span className="text-xs text-text-muted">{s.department}</span>
                        </button>
                      ))}
                    {referrerDepartmentsFiltered.length === 0 && !referrerFiltered.length && (
                      <div className="px-3 py-3 text-xs text-text-muted text-center">검색 결과가 없습니다.</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 내용 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">내용</h2>
            </div>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => void insertCaseInfo()} className="text-primary-600 hover:underline">
                사건정보
              </button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="결재 요청 내용을 입력하세요..."
              rows={12}
              className={cn(
                "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none",
                "focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
              )}
            />
          </div>
        </section>

        {/* 첨부 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Paperclip size={14} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">첨부파일</h2>
          </div>
          <div className="p-4 space-y-3">
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-primary-300 hover:bg-primary-50/50 transition-colors">
              <Paperclip size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">파일 선택 (여러 개 가능)</span>
              <input type="file" multiple className="hidden" onChange={onFileChange} />
            </label>
            {existingAttachments.length > 0 && (
              <ul className="space-y-1.5">
                {existingAttachments.map((att) => (
                  <li
                    key={att.name}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm"
                  >
                    <span className="truncate text-slate-800">{att.name}</span>
                    <span className="text-[10px] text-emerald-700 shrink-0">기존 첨부</span>
                  </li>
                ))}
              </ul>
            )}
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map(({ id, file }) => (
                  <li key={id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <span className="truncate text-slate-800">{file.name}</span>
                    <button type="button" onClick={() => removeFile(id)} className="p-1 text-slate-400 hover:text-danger-500">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => window.close()} className="flex-1">
            취소
          </Button>
          <Button type="button" className="flex-1" leftIcon={<Send size={14} />} onClick={handleSubmit} disabled={submitting}>
            {isEditMode ? "저장" : "결재 요청"}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
