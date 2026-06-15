"use client";

import { useState, useCallback } from "react";
import { User, Phone, Building2, Smartphone, Pencil, Trash2, Plus, Save, KeyRound } from "lucide-react";
import type { StaffMember, StaffRoleOption, JobTitleOption } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: StaffRoleOption[] = ["관리자", "임원", "변호사", "사무장", "국장", "직원"];
const JOB_TITLE_OPTIONS: JobTitleOption[] = ["부장", "팀장", "과장", "대리", "주임", "인턴"];

/** 폼/목록에서 다루는 직원 항목 (id는 임시 가능, 비밀번호·관리번호는 전송용) */
type StaffDraft = Omit<StaffMember, "level"> & {
  level: number;
  _tempId?: string;
  password?: string;
  managementNumber?: string;
};

const emptyForm = (): StaffDraft => ({
  id: "",
  name: "",
  role: "직원",
  department: "",
  email: "",
  phone: "",
  level: 1,
  companyPhone: "",
  personalPhone: "",
  jobTitle: "주임",
  loginId: "",
  password: "",
  managementNumber: "",
});

function toDisplayPhone(m: StaffDraft): string {
  return [m.companyPhone, m.personalPhone].filter(Boolean).join(" / ") || m.phone || "-";
}

export default function StaffAddPage() {
  const [formSections, setFormSections] = useState<StaffDraft[]>([emptyForm()]);
  const [list, setList] = useState<StaffDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const setField = useCallback((sectionIndex: number, key: keyof StaffDraft, value: StaffDraft[keyof StaffDraft]) => {
    setFormSections((prev) => {
      const next = [...prev];
      if (!next[sectionIndex]) return prev;
      next[sectionIndex] = { ...next[sectionIndex], [key]: value };
      return next;
    });
  }, []);

  const handleAddFromSection = (sectionIndex: number) => {
    const form = formSections[sectionIndex];
    if (!form.name?.trim()) {
      toast.error("이름을 입력하세요.");
      return;
    }
    if (form.loginId && (!form.password || form.password.length < 4)) {
      toast.error("로그인 아이디를 입력한 경우 비밀번호는 4자 이상 입력하세요.");
      return;
    }
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setList((prev) => [...prev, { ...form, id: tempId, _tempId: tempId }]);
    setFormSections((prev) => {
      const next = [...prev];
      next[sectionIndex] = emptyForm();
      return next;
    });
    if (editingId && list.some((x) => x.id === editingId)) setEditingId(null);
    toast.success("목록에 추가했습니다. 하단 등록으로 저장하세요.");
  };

  const handleAddFormSection = () => {
    setFormSections((prev) => [...prev, emptyForm()]);
    toast.success("폼을 추가했습니다.");
  };

  const handleEdit = (item: StaffDraft) => {
    setFormSections((prev) => {
      const next = [...prev];
      next[0] = { ...item };
      return next;
    });
    setEditingId(item.id);
    toast.success("편집할 수 있게 첫 번째 폼에 불러왔습니다.");
  };

  const handleDelete = (id: string) => {
    setList((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) {
      setFormSections((prev) => {
        const next = [...prev];
        next[0] = emptyForm();
        return next;
      });
      setEditingId(null);
    }
    toast.success("목록에서 제거했습니다.");
  };

  const handleRegister = async () => {
    const toSend: StaffMember[] = list.map((item, idx) => {
      const id = item._tempId ? `s${Date.now()}-${idx}` : item.id;
      const { _tempId, password: _pw, ...rest } = item;
      const phone = rest.phone || rest.companyPhone || rest.personalPhone || "";
      return { ...rest, id, level: rest.level || 1, phone, loginId: rest.loginId || undefined } as StaffMember;
    });
    if (toSend.length === 0) {
      toast.error("추가 버튼으로 직원을 먼저 목록에 넣은 뒤 등록하세요.");
      return;
    }
    for (const item of list) {
      if (item.loginId?.trim() && item.password && item.password.length >= 4) {
        try {
          const res = await fetch("/api/admin/members/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              loginId: item.loginId.trim().toLowerCase(),
              password: item.password,
              name: item.name.trim() || undefined,
              role: item.role || undefined,
              managementNumber: (item as StaffDraft).managementNumber?.trim() || undefined,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast.error(data.error ?? "계정 생성 실패: " + item.name);
            return;
          }
        } catch {
          toast.error("계정 생성 요청 실패: " + item.name);
          return;
        }
      }
    }
    try {
      if (typeof window !== "undefined" && window.opener) {
        window.opener.postMessage(
          { type: "STAFF_ADD", payload: toSend },
          window.location.origin
        );
      }
      toast.success(`${toSend.length}명을 등록했습니다.`);
      setTimeout(() => window.close(), 600);
    } catch {
      toast.error("등록에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-lg font-bold text-slate-900">직원 추가</h1>

        {/* 폼 (여러 개 추가 가능) */}
        {formSections.map((form, sectionIndex) => (
          <section key={sectionIndex} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User size={14} className="text-slate-500" />
                직원 정보 {formSections.length > 1 ? `(${sectionIndex + 1})` : ""}
              </h2>
              <Button
                type="button"
                variant="outline"
                size="xs"
                leftIcon={<Plus size={12} />}
                onClick={() => handleAddFromSection(sectionIndex)}
              >
                이 폼 추가
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField(sectionIndex, "name", e.target.value)}
                  placeholder="이름 입력"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">역할</label>
                  <select
                    value={form.role}
                    onChange={(e) => setField(sectionIndex, "role", e.target.value as StaffDraft["role"])}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="사무원">사무원</option>
                    <option value="인턴">인턴</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">직급</label>
                  <select
                    value={form.jobTitle ?? ""}
                    onChange={(e) => setField(sectionIndex, "jobTitle", (e.target.value || undefined) as JobTitleOption | undefined)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                  >
                    <option value="">선택</option>
                    {JOB_TITLE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">부서</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setField(sectionIndex, "department", e.target.value)}
                  placeholder="예: 형사부, 민사부, 행정팀"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField(sectionIndex, "email", e.target.value)}
                  placeholder="email@lawfirm.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                    <Building2 size={12} /> 회사폰
                  </label>
                  <input
                    type="tel"
                    value={form.companyPhone ?? ""}
                    onChange={(e) => setField(sectionIndex, "companyPhone", e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                    <Smartphone size={12} /> 개인폰
                  </label>
                  <input
                    type="tel"
                    value={form.personalPhone ?? ""}
                    onChange={(e) => setField(sectionIndex, "personalPhone", e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                  />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <KeyRound size={12} /> 로그인 계정 (선택) · 회원 DB와 연동
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">로그인 아이디</label>
                    <input
                      type="text"
                      value={form.loginId ?? ""}
                      onChange={(e) => setField(sectionIndex, "loginId", e.target.value)}
                      placeholder="영문/숫자"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">비밀번호 (4자 이상)</label>
                    <input
                      type="password"
                      value={form.password ?? ""}
                      onChange={(e) => setField(sectionIndex, "password", e.target.value as string)}
                      placeholder="비밀번호"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">관리번호 (로그인 시 입력)</label>
                  <input
                    type="text"
                    value={form.managementNumber ?? ""}
                    onChange={(e) => setField(sectionIndex, "managementNumber", e.target.value)}
                    placeholder="로그인 화면에서 사용하는 관리번호"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                  />
                </div>
              </div>
            </div>
          </section>
        ))}

        <div className="flex justify-center">
          <Button type="button" variant="outline" leftIcon={<Plus size={14} />} onClick={handleAddFormSection}>
            폼추가
          </Button>
        </div>

        {/* 목록 (추가/편집/삭제) */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">추가된 직원 ({list.length}명)</h2>
          </div>
          <div className="p-4">
            {list.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">
                위 폼에 입력 후 &quot;추가&quot;를 누르면 여기에 표시됩니다.
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm",
                      editingId === item.id
                        ? "border-primary-300 bg-primary-50"
                        : "border-slate-200 bg-slate-50/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className="text-slate-500 ml-2">{item.role}</span>
                      {item.jobTitle && (
                        <span className="text-slate-400 ml-1">· {item.jobTitle}</span>
                      )}
                      <div className="text-xs text-text-muted mt-0.5">
                        {item.department && `${item.department} · `}
                        {toDisplayPhone(item)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                        title="편집"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-danger-100 hover:text-danger-600"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.close()}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            type="button"
            leftIcon={<Save size={14} />}
            onClick={handleRegister}
            className="flex-1"
          >
            등록 후 닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
