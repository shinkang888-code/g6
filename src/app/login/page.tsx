"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus, KeyRound, Play, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { GoogleOAuthSetupForm } from "@/components/auth/GoogleOAuthSetupForm";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type DbStatus = {
  ok: boolean;
  connected?: boolean;
  missing?: string[];
  hint?: string;
  offlineDemoAvailable?: boolean;
} | null;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginId, setLoginId] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [managementNumber, setManagementNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus>(null);

  useEffect(() => {
    fetch("/api/auth/status", { credentials: "include" })
      .then((r) => r.json().catch(() => ({ ok: false })))
      .then((data: DbStatus) => setDbStatus(data));
    fetch("/api/auth/google/config")
      .then((r) => r.json().catch(() => ({ enabled: false })))
      .then((data: { enabled?: boolean }) => setGoogleEnabled(Boolean(data.enabled)));
  }, []);

  useEffect(() => {
    const err = searchParams.get("google_error");
    const msg = searchParams.get("google_message");
    if (msg) toast.error(msg);
    else if (err === "denied") toast.error("Google 로그인이 취소되었습니다.");
  }, [searchParams]);

  useEffect(() => {
    if (loginId.trim().toLowerCase() === "shinkang" && !managementNumber.trim()) {
      setManagementNumber("00000");
    }
  }, [loginId, managementNumber]);

  const dbNotConfigured = dbStatus && !dbStatus.ok;

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 503 && data.hint
          ? `${data.error} ${data.hint}`
          : data.error ?? "데모 로그인에 실패했습니다.";
        toast.error(msg);
        if (data.missing?.length) setDbStatus((s) => (s ? { ...s, ok: false, missing: data.missing, hint: data.hint } : s));
        return;
      }
      if (data.offline) {
        toast.success("로컬 오프라인 데모로 로그인되었습니다. (UI 체험용)");
      } else {
        toast.success(`체험판(관리번호 10000 · 사내관리자)으로 로그인되었습니다.`);
      }
      router.push("/");
      router.refresh();
    } catch {
      toast.error("데모 로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password || !managementNumber.trim()) {
      toast.error("아이디, 비밀번호, 관리번호를 모두 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginId.trim(),
          password,
          managementNumber: managementNumber.trim(),
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 503 && data.hint
          ? `${data.error} ${data.hint}`
          : data.error ?? "로그인에 실패했습니다.";
        toast.error(msg);
        if (data.missing?.length) setDbStatus((s) => (s ? { ...s, ok: false, missing: data.missing, hint: data.hint } : s));
        return;
      }
      toast.success("로그인되었습니다.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {dbNotConfigured && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex gap-2">
            <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">DB가 연결되지 않았습니다</p>
              <p className="text-amber-700 mt-1">{dbStatus?.hint ?? "환경 변수를 확인해 주세요."}</p>
              {dbStatus?.offlineDemoAvailable ? (
                <p className="text-amber-700 mt-2">
                  로컬 개발 환경에서는 아래 <strong>DEMO</strong> 버튼으로 UI를 체험할 수 있습니다.
                  실제 데이터 연동은 Supabase 키 설정이 필요합니다.
                </p>
              ) : null}
              {dbStatus?.missing?.length ? (
                <p className="text-amber-600 mt-1">누락: {dbStatus.missing.join(", ")}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">LawyGo</h1>
        <p className="text-sm text-slate-600 mt-1">법무 관리 시스템 로그인</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">아이디</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="아이디 입력"
              className={cn(
                "w-full px-3 py-3 min-h-[48px] rounded-xl border border-slate-200 text-base",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className={cn(
                "w-full px-3 py-3 min-h-[48px] rounded-xl border border-slate-200 text-base",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">관리번호</label>
            <input
              type="text"
              value={managementNumber}
              onChange={(e) => setManagementNumber(e.target.value)}
              placeholder={loginId.trim().toLowerCase() === "shinkang" ? "00000 (전체관리자 기본)" : "관리번호 입력"}
              className={cn(
                "w-full px-3 py-3 min-h-[48px] rounded-xl border border-slate-200 text-base",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="off"
            />
          </div>

          <Button
            type="submit"
            className="w-full min-h-[48px] text-base"
            size="lg"
            leftIcon={<LogIn size={16} />}
            disabled={loading}
            loading={loading}
          >
            로그인
          </Button>
        </form>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex-1 h-px bg-slate-200" />
            <span>또는</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>
          <GoogleAuthButton
            mode="login"
            disabled={loading || demoLoading}
            configured={googleEnabled}
          />
          {!googleEnabled && (
            <GoogleOAuthSetupForm
              className="mt-2"
              onSaved={() => {
                fetch("/api/auth/google/config")
                  .then((r) => r.json().catch(() => ({ enabled: false })))
                  .then((data: { enabled?: boolean }) => setGoogleEnabled(Boolean(data.enabled)));
              }}
            />
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
          <Link href="/login/signup" className="min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<UserPlus size={14} />}
              className="w-full min-h-[44px] text-sm"
            >
              회원가입
            </Button>
          </Link>
          <Link href="/login/password" className="min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<KeyRound size={14} />}
              className="w-full min-h-[44px] text-sm"
            >
              비밀번호 확인
            </Button>
          </Link>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            leftIcon={<Play size={16} />}
            disabled={demoLoading}
            loading={demoLoading}
            onClick={handleDemoLogin}
          >
            DEMO
          </Button>
          <p className="text-center text-xs text-slate-500 mt-2">
            체험판 관리번호 {`10000`} · shinkang888@gmail.com 계정으로 로그인
          </p>
        </div>
      </div>

      <div className="text-left text-xs text-slate-600 mt-6 space-y-2 leading-relaxed max-w-md mx-auto">
        <p className="font-semibold text-slate-800">
          [공지] [체험판 관리번호 10000] [베타테스터 관리번호 1****]
        </p>
        <p>
          0) 법원기일연동과 AI 워크스페이스 기능은 꼭 써보시길 바랍니다.
        </p>
        <p>
          1) 구글 회원의 연동 가입시 관리자 승인 후 로그인 됩니다. 또한 체험판의 경우 테스트계정의
          사건정보가 체험자들에게 공개되므로, 테스트 입력 후 반드시 직접 삭제하시고, 해당 정보
          노출에 관하여 직접 입력한 당사자에게 모든 책임이 있습니다. (마스킹처리함)
        </p>
        <p>
          2) 베타테스터 신청의 경우 사무소별로 별도로 1개의 관리번호를 부여합니다. 원칙은 관리번호는
          1****(본인 전화번호 뒷자리 4자리)로 승인 요청해 주세요. 중복되지 않으면 승인하겠습니다.
        </p>
        <p>
          3) 만일 별도 연락 없이 거절된 경우에는 전화번호 뒷자리 중복입니다. 묻지 마시고, 다시
          앞자리를 2나 3, 4, 5로 바꿔서 승인 요청해 주세요. 첫 가입 계정만 사내관리자이고,
          사내관리자는 해당 관리번호의 권한으로 다른 구성원들을 초대하고 직접 승인할 수 있습니다.
        </p>
        <p>
          4) 관리번호는 회사당 1개이므로 전화번호 뒷자리가 중복되면, 먼저 승인된 분이 우선권이
          있으며, 거절된 회원은 2****(전화번호 뒷자리 4자리) 앞자리를 2나 3으로 바꿔서 다시
          신청해 주세요.
        </p>
        <p>
          5) 문의사항은{" "}
          <a href="mailto:shinkang888@gmail.com" className="text-primary-600 hover:underline">
            shinkang888@gmail.com
          </a>
          으로 연락 주시면 빠른 시일 내 답신하겠습니다.
        </p>
      </div>
    </div>
  );
}
