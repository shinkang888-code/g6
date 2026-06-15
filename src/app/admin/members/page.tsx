"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** LawTop 스타일 통합 화면으로 리다이렉트 */
export default function AdminMembersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/users");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[200px] text-sm text-text-muted">
      사용자 관리로 이동 중…
    </div>
  );
}
