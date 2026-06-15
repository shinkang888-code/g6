"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Plus, Pencil, Trash2, Save, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { DeadlineItem, DeadlineFormFieldConfig } from "@/lib/types";
import {
  getDeadlinesForDate,
  saveDeadline,
  softDeleteDeadline,
  loadFormSchema,
  saveFormSchema,
  DEFAULT_FORM_SCHEMA,
} from "@/lib/deadlineStorage";
import { cn } from "@/lib/utils";
import {
  formatCourtDeadlineDateDot,
  getDeadlineLocation,
  parseTimeFromDeadlineMemo,
} from "@/lib/deadlineDisplay";
import { dedupeDeadlinesForDisplay } from "@/lib/deadlineDedup";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDefaultValues(schema: DeadlineFormFieldConfig[]): Record<string, string> {
  const out: Record<string, string> = {};
  schema.forEach((f) => {
    if (f.type === "date") out[f.key] = toDateStr(new Date());
    else if (f.type === "select" && f.options?.length) out[f.key] = f.options[0].value;
    else out[f.key] = "";
  });
  return out;
}

export default function CalendarManagePage() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") ?? toDateStr(new Date());
  const editIdParam = searchParams.get("editId") ?? "";

  const [apiDeadlines, setApiDeadlines] = useState<DeadlineItem[]>([]);
  const [localDeadlines, setLocalDeadlines] = useState<DeadlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<DeadlineFormFieldConfig[]>(DEFAULT_FORM_SCHEMA);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [schemaEditOpen, setSchemaEditOpen] = useState(false);
  const [schemaDraft, setSchemaDraft] = useState<DeadlineFormFieldConfig[]>([]);
  const [editIdHandled, setEditIdHandled] = useState(false);

  const deadlinesSource = [
    ...apiDeadlines.filter((d) => !localDeadlines.some((l) => l.id === d.id)),
    ...localDeadlines,
  ];
  const deadlines = dedupeDeadlinesForDisplay(deadlinesSource);

  const fetchDeadlines = useCallback(() => {
    setLoading(true);
    fetch(`/api/deadlines?dateFrom=${dateParam}&dateTo=${dateParam}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: {
        data?: Array<{
          id: string;
          date: string;
          type?: string;
          caseNumber?: string;
          clientName?: string;
          court?: string;
          memo?: string;
        }>;
      }) => {
        const list = (json.data ?? []).map((d) => ({
          id: d.id,
          date: d.date,
          caseNumber: d.caseNumber ?? "",
          clientName: d.clientName ?? "",
          type: d.type ?? "기일",
          court: d.court,
          memo: d.memo,
          status: "active" as const,
          createdAt: "",
          updatedAt: "",
        }));
        setApiDeadlines(list);
      })
      .catch(() => setApiDeadlines([]))
      .finally(() => setLoading(false));
  }, [dateParam]);

  const refresh = useCallback(() => {
    setSchema(loadFormSchema());
    setLocalDeadlines(getDeadlinesForDate(dateParam));
    fetchDeadlines();
  }, [dateParam, fetchDeadlines]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${dateParam} 기일 · LawyGo`;
    }
  }, [dateParam]);

  const totalCount = deadlines.length;

  const openNewForm = () => {
    const s = loadFormSchema();
    const defaults = getDefaultValues(s);
    defaults.date = dateParam;
    setSchema(s);
    setFormValues(defaults);
    setEditingId(null);
    setFormOpen(true);
  };

  const openEditForm = (item: DeadlineItem) => {
    setSchema(loadFormSchema());
    const vals: Record<string, string> = {
      date: item.date,
      caseNumber: item.caseNumber ?? "",
      type: item.type ?? "",
      court: item.court ?? "",
      assignedStaff: item.assignedStaff ?? "",
      memo: item.memo ?? "",
    };
    setFormValues(vals);
    setEditingId(item.id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    refresh();
    if (typeof window !== "undefined" && window.opener) {
      try {
        window.close();
      } catch {
        // ignore
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = loadFormSchema();
    const date = formValues.date || dateParam;
    const caseNumber = (formValues.caseNumber ?? "").trim() || "(사건번호 없음)";
    const type = (formValues.type ?? "").trim() || "기타";
    const payload = {
      id: editingId ?? "",
      date,
      caseNumber,
      type,
      court: (formValues.court ?? "").trim() || undefined,
      assignedStaff: (formValues.assignedStaff ?? "").trim() || undefined,
      memo: (formValues.memo ?? "").trim() || undefined,
    };
    saveDeadline(payload);
    toast.success(editingId ? "기일이 수정되었습니다." : "기일이 등록되었습니다.");
    closeForm();
  };

  const handleSoftDelete = (id: string) => {
    if (!confirm("이 기일을 삭제하시겠습니까? (삭제 대기 상태로 전환됩니다.)")) return;
    softDeleteDeadline(id);
    toast.success("기일이 삭제 대기 상태로 변경되었습니다.");
    refresh();
  };

  const openSchemaEdit = () => {
    setSchemaDraft(JSON.parse(JSON.stringify(loadFormSchema())));
    setSchemaEditOpen(true);
  };
  const openEditPopup = (item: DeadlineItem) => {
    if (typeof window === "undefined") return;
    const url = `/calendar/manage?date=${encodeURIComponent(dateParam)}&editId=${encodeURIComponent(item.id)}`;
    const w = 520;
    const h = 720;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(url, "_blank", `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
  };

  useEffect(() => {
    if (!editIdParam || formOpen || editIdHandled) return;
    const target = deadlinesSource.find((d) => d.id === editIdParam);
    if (target) {
      openEditForm(target);
      setEditIdHandled(true);
    }
  }, [editIdParam, formOpen, deadlinesSource, editIdHandled]);


  const saveSchemaEdit = () => {
    saveFormSchema(schemaDraft);
    setSchema(schemaDraft);
    setSchemaEditOpen(false);
    toast.success("폼 양식이 저장되었습니다.");
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto min-h-screen bg-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays size={22} className="text-primary-600" />
            {dateParam} 기일
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {loading ? "로딩 중…" : `기일 ${totalCount}건`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={openSchemaEdit} leftIcon={<Settings2 size={14} />}>
            폼 양식 수정
          </Button>
          <Button type="button" size="sm" onClick={openNewForm} leftIcon={<Plus size={14} />}>
            기일 등록
          </Button>
        </div>
      </div>

      {/* 기일 목록 (DB + 로컬) */}
      <div className="space-y-2 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <CalendarDays size={14} />
          기일 ({deadlines.length}건)
        </h2>
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 py-8 text-center text-sm text-text-muted">
            기일 목록을 불러오는 중…
          </div>
        ) : deadlines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center text-sm text-text-muted">
            이 날짜에 등록된 기일이 없습니다. &quot;엑셀으로 기일 반영&quot;으로 datelist 엑셀을 올리거나 &quot;기일 등록&quot;으로 추가하세요.
          </div>
        ) : (
          deadlines.map((d) => {
            const isLocal = localDeadlines.some((l) => l.id === d.id);
            const time = parseTimeFromDeadlineMemo(d.memo);
            const location = getDeadlineLocation(
              { id: d.id, date: d.date, court: d.court, memo: d.memo },
              d.court ?? ""
            );
            const clientLabel = d.clientName?.trim() || "의뢰인 미등록";
            const caseLabel = d.caseNumber?.trim() || "사건번호 없음";
            const typeLabel = d.type?.trim() || "기일";
            const dateLine = formatCourtDeadlineDateDot(d.date);
            const timePart = time !== "미정" ? time : "";
            const placePart = location !== "미정" ? location : d.court?.trim() || "";
            return (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm cursor-pointer"
              onDoubleClick={() => openEditPopup(d)}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium text-slate-800 leading-snug">
                  {caseLabel} {clientLabel} [{typeLabel}]
                </p>
                <p className="text-xs text-slate-600 tabular-nums whitespace-pre-wrap break-words">
                  {[dateLine, timePart, placePart].filter(Boolean).join("    ")}
                </p>
                {(d.assignedStaff || (d.memo && !d.memo.includes("[court_sync]"))) && (
                  <p className="text-[11px] text-text-muted truncate">
                    {d.assignedStaff && `담당: ${d.assignedStaff}`}
                    {d.assignedStaff && d.memo && !d.memo.includes("[court_sync]") && " · "}
                    {d.memo && !d.memo.includes("[court_sync]") ? d.memo : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isLocal && (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditForm(d)}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleSoftDelete(d.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* 등록/수정 폼 모달 */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "기일 수정" : "기일 등록"}
              </h2>
              <button type="button" onClick={closeForm} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {loadFormSchema().map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-danger-500 ml-0.5">*</span>}
                  </label>
                  {field.type === "text" && (
                    <input
                      type="text"
                      value={formValues[field.key] ?? ""}
                      onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  )}
                  {field.type === "date" && (
                    <input
                      type="date"
                      value={formValues[field.key] ?? dateParam}
                      onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  )}
                  {field.type === "select" && (
                    <select
                      value={formValues[field.key] ?? ""}
                      onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    >
                      <option value="">선택</option>
                      {field.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                  {field.type === "textarea" && (
                    <textarea
                      value={formValues[field.key] ?? ""}
                      onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none"
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" leftIcon={<Save size={14} />}>
                  {editingId ? "수정" : "등록"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={closeForm}>
                  취소
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 폼 양식 수정 모달 */}
      {schemaEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">폼 양식 수정</h2>
              <button
                type="button"
                onClick={() => setSchemaEditOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-text-muted">필드 순서와 라벨·타입을 수정할 수 있습니다. 저장 시 기일 등록 폼에 반영됩니다.</p>
              {schemaDraft.map((f, idx) => (
                <div key={f.key} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2">
                  <span className="text-xs text-slate-400 w-8 shrink-0">{idx + 1}</span>
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) =>
                      setSchemaDraft((s) => s.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                    }
                    placeholder="라벨"
                    className="flex-1 min-w-0 px-2 py-1.5 text-sm rounded border border-slate-200"
                  />
                  <select
                    value={f.type}
                    onChange={(e) =>
                      setSchemaDraft((s) =>
                        s.map((x, i) =>
                          i === idx ? { ...x, type: e.target.value as DeadlineFormFieldConfig["type"] } : x
                        )
                      )
                    }
                    className="shrink-0 px-2 py-1.5 text-sm rounded border border-slate-200 w-24"
                  >
                    <option value="text">텍스트</option>
                    <option value="date">날짜</option>
                    <option value="select">선택</option>
                    <option value="textarea">긴 글</option>
                  </select>
                  <label className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={f.required ?? false}
                      onChange={(e) =>
                        setSchemaDraft((s) => s.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)))
                      }
                    />
                    필수
                  </label>
                  <button
                    type="button"
                    onClick={() => setSchemaDraft((s) => s.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-danger-500"
                    title="필드 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed border-slate-200 text-slate-600 hover:border-primary-300 hover:text-primary-600"
                leftIcon={<Plus size={14} />}
                onClick={() =>
                  setSchemaDraft((s) => [
                    ...s,
                    {
                      key: `field_${Date.now()}`,
                      label: "새 필드",
                      type: "text" as const,
                      required: false,
                    },
                  ])
                }
              >
                필드 추가
              </Button>
              <div className="flex gap-2 pt-2">
                <Button type="button" size="sm" onClick={saveSchemaEdit} leftIcon={<Save size={14} />}>
                  양식 저장
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSchemaDraft(JSON.parse(JSON.stringify(DEFAULT_FORM_SCHEMA)))}
                >
                  기본값 복원
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSchemaEditOpen(false)}>
                  취소
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
