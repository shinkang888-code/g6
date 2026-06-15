"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function PasswordResetPage() {
  const [loginId, setLoginId] = useState("");
  const [managementNumber, setManagementNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !managementNumber.trim() || !newPassword || !newPasswordConfirm) {
      toast.error("아이디, 관리번호, 새 비밀번호를 모두 입력하세요.");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginId.trim(),
          managementNumber: managementNumber.trim(),
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "비밀번호 변경에 실패했습니다.");
        return;
      }
      toast.success(data.message ?? "비밀번호가 변경되었습니다.");
      setLoginId("");
      setManagementNumber("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setTimeout(() => {}, 500);
    } catch {
      toast.error("요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/login" className="p-2 rounded-lg hover:bg-slate-200 text-slate-600" aria-label="로그인으로">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <KeyRound size={22} className="text-primary-500" />
            비밀번호 확인 / 재설정
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">아이디와 관리번호로 본인 확인 후 새 비밀번호를 설정하세요.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">아이디 *</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="아이디 입력"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">관리번호 *</label>
            <input
              type="text"
              value={managementNumber}
              onChange={(e) => setManagementNumber(e.target.value)}
              placeholder="관리번호 입력"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">새 비밀번호 *</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="4자 이상"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">새 비밀번호 확인 *</label>
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="새 비밀번호 다시 입력"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="w-full" leftIcon={<KeyRound size={16} />} disabled={loading} loading={loading}>
            비밀번호 변경
          </Button>
        </form>

        <p className="text-center mt-4">
          <Link href="/login" className="text-sm text-primary-600 hover:underline">로그인 화면으로</Link>
        </p>
      </div>
    </div>
  );
}
