"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { User, Building2, Smartphone, Save, Trash2, KeyRound, Loader2 } from "lucide-react";
import type { StaffMember, StaffRoleOption, JobTitleOption } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const ROLE_OPTIONS: StaffRoleOption[] = ["관리자", "임원", "변호사", "사무장", "국장", "직원"];
const JOB_TITLE_OPTIONS: JobTitleOption[] = ["부장", "팀장", "과장", "대리", "주임", "인턴"];

export default function StaffEditPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<Partial<StaffMember> & { managementNumber?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [credentialLoginId, setCredentialLoginId] = useState("");
  const [newLoginId, setNewLoginId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const { isAdmin } = useIsAdmin();
  const loadedRef = useRef(false);

  const setField = useCallback(<K extends keyof StaffMember>(key: K, value: StaffMember[K] | undefined) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setManagementNumber = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, managementNumber: value }));
  }, []);

  const applyStaff = useCallback((found: StaffMember & { managementNumber?: string }) => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setStaff(found);
    setForm({
      id: found.id,
      name: found.name,
      role: found.role,
      department: found.department,
      email: found.email,
      phone: found.phone,
      level: found.level ?? 1,
      jobTitle: found.jobTitle,
      companyPhone: found.companyPhone,
      personalPhone: found.personalPhone,
      loginId: found.loginId,
      managementNumber: found.managementNumber ?? "",
    });
    setCredentialLoginId(found.loginId ?? "");
    setNewLoginId(found.loginId ?? "");
  }, []);

  // 1) 부모 창에서 데이터 받기 (postMessage)
  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    if (!window.opener) return;
    const requestData = () => {
      window.opener.postMessage({ type: "STAFF_EDIT_GET_DATA" }, window.location.origin);
    };
    requestData();
    const t1 = setTimeout(requestData, 150);
    const t2 = setTimeout(requestData, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [id]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "STAFF_DATA" && Array.isArray(e.data?.payload)) {
        const list = e.data.payload as (StaffMember & { managementNumber?: string })[];
        const found = id ? list.find((s) => s.id === id) : null;
        if (found) {
          applyStaff(found);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [id, applyStaff]);

  // 2) API로 직원 목록 조회 후 해당 id로 채우기 (opener 없거나 데이터 미도착 시)
  const loadFromApi = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch("/api/staff", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({})) as { staff?: (StaffMember & { managementNumber?: string })[] };
      const list = data?.staff ?? [];
      const found = list.find((s) => s.id === id);
      if (found) {
        applyStaff(found);
      } else {
        toast.error("해당 직원을 찾을 수 없습니다.");
      }
    } catch {
      toast.error("직원 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id, applyStaff]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      if (loadedRef.current) {
        setLoading(false);
        return;
      }
      loadFromApi();
    }, 500);
    return () => clearTimeout(timer);
  }, [id, loadFromApi]);

  // 부모 창이 있으면 로드 후에도 loading 해제
  useEffect(() => {
    if (loadedRef.current) setLoading(false);
  }, [staff]);

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error("이름을 입력하세요.");
      return;
    }
    if (!form.id) {
      toast.error("직원 정보가 없습니다.");
      return;
    }

    setSaving(true);
    try {
      // 회원 DB(site_users)에 반영: 이름, 역할, 관리번호
      const updateRes = await fetch("/api/admin/members/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: form.id,
          name: form.name.trim(),
          role: form.role ?? "직원",
          managementNumber: (form as { managementNumber?: string }).managementNumber?.trim() || undefined,
          department: form.department?.trim() ?? "",
          email: form.email?.trim() ?? "",
          jobTitle: form.jobTitle ?? "",
          companyPhone: form.companyPhone?.trim() ?? "",
          personalPhone: form.personalPhone?.trim() ?? "",
        }),
      });
      const updateData = await updateRes.json().catch(() => ({}));
      if (!updateRes.ok) {
        toast.error(updateData.error ?? "저장에 실패했습니다.");
        setSaving(false);
        return;
      }

      // 관리자만: 로그인 아이디/비밀번호 변경
      if (isAdmin && (newLoginId.trim() || newPassword)) {
        const targetLoginId = credentialLoginId.trim() || form.loginId?.trim();
        if (newPassword && newPassword !== newPasswordConfirm) {
          toast.error("새 비밀번호가 일치하지 않습니다.");
          setSaving(false);
          return;
        }
        if (newPassword && newPassword.length < 4) {
          toast.error("새 비밀번호는 4자 이상이어야 합니다.");
          setSaving(false);
          return;
        }
        if (targetLoginId) {
          const credRes = await fetch("/api/admin/members/credentials", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              loginId: targetLoginId,
              newLoginId: newLoginId.trim() || undefined,
              newPassword: newPassword || undefined,
            }),
          });
          const credData = await credRes.json().catch(() => ({}));
          if (!credRes.ok) {
            toast.error(credData.error ?? "아이디/비밀번호 수정에 실패했습니다.");
            setSaving(false);
            return;
          }
          if (newLoginId.trim()) setField("loginId", newLoginId.trim());
        }
      }

      const updated: StaffMember = {
        id: form.id,
        name: form.name!,
        role: form.role!,
        department: form.department ?? "",
        email: form.email ?? "",
        phone: form.phone ?? form.companyPhone ?? form.personalPhone ?? "",
        level: form.level ?? 1,
        jobTitle: form.jobTitle,
        companyPhone: form.companyPhone,
        personalPhone: form.personalPhone,
        loginId: form.loginId,
        managementNumber: (form as { managementNumber?: string }).managementNumber,
      };

      if (typeof window !== "undefined" && window.opener) {
        window.opener.postMessage({ type: "STAFF_UPDATE", payload: updated }, window.location.origin);
        window.opener.postMessage({ type: "STAFF_REFRESH" }, window.location.origin);
      }
      setStaff(updated);
      toast.success("DB에 저장되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("이 직원을 제외하시겠습니까?\n계정이 삭제되며, 해당 회원은 새 관리번호로 다시 가입할 수 있습니다.")) return;
    if (!form.id) return;
    try {
      const res = await fetch("/api/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: form.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "제외 처리에 실패했습니다.");
        return;
      }
      if (typeof window !== "undefined" && window.opener) {
        window.opener.postMessage({ type: "STAFF_DELETE", payload: form.id }, window.location.origin);
        window.opener.postMessage({ type: "STAFF_REFRESH" }, window.location.origin);
      }
      toast.success(data.message ?? "직원에서 제외했습니다. 새 관리번호로 재가입할 수 있습니다.");
      window.close();
    } catch {
      toast.error("제외 처리 중 오류가 발생했습니다.");
    }
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-600">직원을 선택해 주세요.</p>
      </div>
    );
  }

  if (loading && !form.id) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 p-6">
        <Loader2 size={32} className="animate-spin text-primary-600" />
        <p className="text-slate-600 text-sm">직원 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-lg font-bold text-slate-900">직원 정보 편집</h1>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              leftIcon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              onClick={handleSave}
              disabled={saving || !form.id}
            >
              {saving ? "저장 중…" : "저장"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => window.close()}
              className="text-slate-500"
            >
              닫기
            </Button>
          </div>
        </div>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <User size={14} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">기본 정보</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">이름 *</label>
              <input
                type="text"
                value={form.name ?? ""}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="이름 입력"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">역할</label>
                <select
                  value={form.role ?? ""}
                  onChange={(e) => setField("role", e.target.value as StaffMember["role"])}
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
                  onChange={(e) => setField("jobTitle", (e.target.value || undefined) as JobTitleOption | undefined)}
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
                value={form.department ?? ""}
                onChange={(e) => setField("department", e.target.value)}
                placeholder="예: 형사부, 민사부, 행정팀"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">이메일</label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setField("email", e.target.value)}
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
                  onChange={(e) => setField("companyPhone", e.target.value)}
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
                  onChange={(e) => setField("personalPhone", e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <KeyRound size={12} /> 로그인 계정 (회원 DB 연동)
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">로그인 아이디</label>
                <input
                  type="text"
                  value={form.loginId ?? ""}
                  readOnly
                  placeholder="미설정"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">회원 관리 승인 계정과 동일합니다.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">관리번호 (로그인 시 입력)</label>
                <input
                  type="text"
                  value={form.managementNumber ?? ""}
                  onChange={(e) => setManagementNumber(e.target.value)}
                  placeholder="로그인 화면에서 사용하는 관리번호"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                />
              </div>
            </div>
            {isAdmin && (
              <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <KeyRound size={12} /> 로그인 계정 변경 (관리자)
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">현재 로그인 아이디</label>
                  <input
                    type="text"
                    value={credentialLoginId}
                    onChange={(e) => setCredentialLoginId(e.target.value)}
                    placeholder="수정 대상 계정의 아이디"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none bg-slate-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">새 로그인 아이디</label>
                    <input
                      type="text"
                      value={newLoginId}
                      onChange={(e) => setNewLoginId(e.target.value)}
                      placeholder="변경 시에만 입력"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">새 비밀번호 (4자 이상)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="변경 시에만 입력"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                    />
                  </div>
                </div>
                {newPassword && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="동일하게 입력"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 하단 고정 저장/취소/삭제 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg safe-area-pb">
        <div className="max-w-lg mx-auto px-4 py-3 flex gap-3">
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
            variant="ghost"
            className="text-danger-600 flex-1"
            leftIcon={<Trash2 size={14} />}
            onClick={handleDelete}
          >
            목록에서 제외
          </Button>
          <Button
            type="button"
            leftIcon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
