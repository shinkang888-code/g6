"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type Props = {
  mode: "login" | "signup";
  className?: string;
  disabled?: boolean;
  /** false면 클릭 시 설정 안내 (버튼은 항상 표시) */
  configured?: boolean;
};

/**
 * Google 브랜드 가이드 기반 버튼 → 서버 OAuth 리다이렉트
 * (Google 호스팅 계정 선택·2단계 인증 화면은 hl=ko 로 한국어 표시)
 */
export function GoogleAuthButton({ mode, className, disabled, configured = true }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (!configured) {
      toast.error(
        "Google 로그인이 설정되지 않았습니다. DEMO 로그인 후 관리자 > Google OAuth 설정에서 등록하거나, 로컬에서는 .env.local에 Client ID/Secret을 넣으세요."
      );
      return;
    }
    setLoading(true);
    window.location.href = `/api/auth/google?mode=${mode}&hl=ko`;
  };

  const label =
    mode === "signup" ? "Google 계정으로 가입하기" : "Google 계정으로 로그인";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label={label}
      className={cn(
        "w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-md",
        "border border-[#747775] bg-white text-sm font-medium text-[#1f1f1f]",
        "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
        "hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)]",
        "active:bg-[#f1f3f4] transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <GoogleIcon />
      <span>{loading ? "Google로 이동 중…" : label}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-5.523 0-10-4.477-10-10s4.477-10 10-10c2.52 0 4.817.93 6.593 2.457l6.082-6.082C33.446 9.313 28.976 7 24 7 12.954 7 4 15.954 4 27s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.52 0 4.817.93 6.593 2.457l6.082-6.082C33.446 9.313 28.976 7 24 7 16.318 7 9.656 11.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 47c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 37.091 26.715 38 24 38c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 42.556 16.227 47 24 47z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.194 8-11.303 8-5.523 0-10-4.477-10-10s4.477-10 10-10c2.52 0 4.817.93 6.593 2.457l6.082-6.082C33.446 9.313 28.976 7 24 7 12.954 7 4 15.954 4 27s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
