"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function GoogleSignupCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromLogin = searchParams.get("from") === "login";
  const fromRejoin = searchParams.get("from") === "rejoin";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [managementNumber, setManagementNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/google/complete-signup", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { pending?: boolean; email?: string; name?: string }) => {
        if (!data.pending) {
          toast.error("Google 가입 정보가 없습니다. 다시 시도해 주세요.");
          router.replace("/login/signup");
          return;
        }
        setEmail(data.email ?? "");
        setName(data.name ?? "");
      })
      .catch(() => {
        toast.error("Google 가입 정보를 불러오지 못했습니다.");
        router.replace("/login/signup");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managementNumber.trim()) {
      toast.error("관리번호를 입력하세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/google/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ managementNumber: managementNumber.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "가입에 실패했습니다.");
        return;
      }
      const isPending = Boolean(data.pendingApproval) || data.user?.status === "pending" || data.user?.status === "on_hold";
      setPendingApproval(isPending);
      setResultMessage(
        isPending
          ? "가입승인중입니다."
          : (data.message ?? "가입이 완료되었습니다.")
      );
      setCompleted(true);
      if (!isPending) {
        toast.success(data.message ?? "가입이 완료되었습니다.");
      }
    } catch {
      toast.error("가입 요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md text-center text-sm text-slate-500">Google 계정 확인 중…</div>
    );
  }

  if (completed) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center space-y-4">
          <div
            className={cn(
              "w-14 h-14 rounded-full mx-auto flex items-center justify-center",
              pendingApproval ? "bg-amber-50 text-amber-600" : "bg-success-50 text-success-600"
            )}
          >
            {pendingApproval ? <Clock size={28} /> : <CheckCircle2 size={28} />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{resultMessage}</h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {pendingApproval
                ? "관리자가 가입을 검토한 뒤 승인하면 로그인할 수 있습니다. 승인 결과는 등록하신 Google 계정으로 안내될 수 있습니다."
                : "가입이 완료되었습니다. 로그인 페이지에서 Google 로그인 또는 아이디로 접속하세요."}
            </p>
          </div>
          {email && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-left">
              <p className="text-slate-500 text-xs mb-1">Google 계정</p>
              <p className="font-medium text-slate-800">{email}</p>
              {managementNumber && (
                <p className="text-xs text-slate-500 mt-1">관리번호 {managementNumber}</p>
              )}
            </div>
          )}
          <Button className="w-full" onClick={() => router.push("/login")}>
            로그인 화면으로
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/login/signup" className="p-2 rounded-lg hover:bg-slate-200 text-slate-600" aria-label="회원가입으로">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserPlus size={22} className="text-primary-500" />
            Google 가입 마무리
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {fromRejoin
              ? "이전 회사에서 퇴사·제외된 계정입니다. 새 관리번호를 입력하면 다른 회사로 다시 가입할 수 있습니다."
              : fromLogin
              ? "가입되지 않은 Google 계정입니다. 관리번호를 입력하면 가입 신청이 완료됩니다."
              : "Google 계정이 확인되었습니다. 소속 관리번호를 입력해 주세요."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-sm">
          <p className="text-slate-500 text-xs mb-1">Google 계정</p>
          <p className="font-medium text-slate-800">{email}</p>
          {name ? <p className="text-slate-600 text-xs mt-0.5">{name}</p> : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">관리번호 *</label>
            <input
              type="text"
              value={managementNumber}
              onChange={(e) => setManagementNumber(e.target.value)}
              placeholder="소속 법인 관리번호 (예: 00000)"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              )}
              autoComplete="off"
            />
            <p className="text-xs text-slate-500 mt-1">입력한 관리번호 조직의 관리자가 가입을 승인합니다.</p>
          </div>
          <Button
            type="submit"
            className="w-full"
            leftIcon={<UserPlus size={16} />}
            disabled={submitting}
            loading={submitting}
          >
            관리자 가입승인요청
          </Button>
        </form>
      </div>
    </div>
  );
}
