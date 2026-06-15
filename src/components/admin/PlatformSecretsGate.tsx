"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type AccessState = "loading" | "allowed" | "denied";

export function usePlatformSecretsAccess() {
  const [state, setState] = useState<AccessState>("loading");
  const [loginId, setLoginId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      const data = (await res.json()) as {
        user?: { loginId?: string; canManagePlatformSecrets?: boolean };
      };
      setLoginId(data.user?.loginId ?? null);
      setState(data.user?.canManagePlatformSecrets ? "allowed" : "denied");
    } catch {
      setState("denied");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading: state === "loading",
    allowed: state === "allowed",
    denied: state === "denied",
    loginId,
    refresh,
  };
}

type GateProps = {
  children: React.ReactNode;
  title?: string;
};

export function PlatformSecretsGate({ children, title = "보안 설정" }: GateProps) {
  const { loading, allowed, denied } = usePlatformSecretsAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-text-muted">
        권한 확인 중…
      </div>
    );
  }

  if (denied) {
    return (
      <div className="max-w-lg mx-auto py-12 space-y-4 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <Shield size={28} className="text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title} — 접근 제한</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          이 페이지는 API 키·환경변수 등 민감 설정을 다룹니다.
          <br />
          <strong className="text-slate-800">전체관리자(shinkang)</strong> 또는{" "}
          <strong className="text-slate-800">전체부관리자(kangjunchul8@gmail.com)</strong> 계정으로
          로그인해야 합니다.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/admin/settings">
            <Button variant="outline">시스템 설정으로</Button>
          </Link>
          <Link href="/admin">
            <Button variant="ghost" leftIcon={<ArrowLeft size={16} />}>
              관리자 홈
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

type UnlockBarProps = {
  visible: boolean;
  unlocked: boolean;
  onUnlock: () => void;
  onCancel?: () => void;
  envLabel?: string;
};

/** Vercel/env에 고정된 키를 UI에서 교체할 때 사용 */
export function EnvCredentialsUnlockBar({
  visible,
  unlocked,
  onUnlock,
  onCancel,
  envLabel = "환경 변수",
}: UnlockBarProps) {
  if (!visible) return null;

  if (unlocked) {
    return (
      <div className="rounded-lg border border-primary-200 bg-primary-50/60 p-3 text-sm text-primary-900 flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>{envLabel}</strong> 키 교체 모드입니다. 새 JSON·값을 입력한 뒤 저장하면 DB에 반영되며
          기존 env보다 우선 적용됩니다.
        </span>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            취소
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
      <span>
        현재 <strong>{envLabel}</strong>에 키가 고정되어 있습니다. 교체하려면 아래 버튼을 누르세요.
      </span>
      <Button type="button" size="sm" variant="outline" onClick={onUnlock}>
        환경 변수 키 교체
      </Button>
    </div>
  );
}
