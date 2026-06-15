"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserPlus, ArrowLeft } from "lucide-react";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { GoogleOAuthSetupForm } from "@/components/auth/GoogleOAuthSetupForm";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [managementNumber, setManagementNumber] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/auth/google/config")
      .then((r) => r.json().catch(() => ({ enabled: false })))
      .then((data: { enabled?: boolean }) => setGoogleEnabled(Boolean(data.enabled)));
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password || !managementNumber.trim()) {
      toast.error("아이디, 비밀번호, 관리번호를 모두 입력하세요.");
      return;
    }
    if (password.length < 4) {
      toast.error("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginId.trim(),
          password,
          managementNumber: managementNumber.trim(),
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "회원가입에 실패했습니다.");
        return;
      }
      if (data.pendingApproval) {
        toast.success("가입승인중입니다. 관리자 승인 후 로그인할 수 있습니다.");
      } else {
        toast.success(data.message ?? "회원가입이 완료되었습니다.");
      }
      router.push("/login");
    } catch {
      toast.error("회원가입 요청 중 오류가 발생했습니다.");
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
            <UserPlus size={22} className="text-primary-500" />
            회원가입
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">가입 후 관리자 승인 시 로그인할 수 있습니다.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">아이디 *</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="2자 이상"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호 *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="4자 이상"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호 확인 *</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 다시 입력"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="new-password"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">이름 (선택)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="name"
            />
          </div>

          <Button type="submit" className="w-full" leftIcon={<UserPlus size={16} />} disabled={loading} loading={loading}>
            회원가입
          </Button>
        </form>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex-1 h-px bg-slate-200" />
            <span>또는</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>
          <GoogleAuthButton mode="signup" disabled={loading} configured={googleEnabled} />
          {!googleEnabled && (
            <GoogleOAuthSetupForm
              onSaved={() => {
                fetch("/api/auth/google/config")
                  .then((r) => r.json().catch(() => ({ enabled: false })))
                  .then((data: { enabled?: boolean }) => setGoogleEnabled(Boolean(data.enabled)));
              }}
            />
          )}
          {googleEnabled && (
            <p className="text-xs text-slate-500 text-center">Google 가입 후 관리번호만 입력하면 됩니다.</p>
          )}
        </div>

        <p className="text-center mt-4">
          <Link href="/login" className="text-sm text-primary-600 hover:underline">로그인 화면으로</Link>
        </p>
      </div>
    </div>
  );
}
