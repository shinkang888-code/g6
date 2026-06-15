"use client";

import { useState, useEffect } from "react";

/**
 * 현재 로그인 사용자가 관리자(전체 게시판·이력·직원 아이디/비밀번호 관리 권한)인지 반환
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const role = data?.user?.role ?? "";
        setIsAdmin(role === "관리자");
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { isAdmin, loading };
}
