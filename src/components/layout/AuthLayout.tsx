"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { isCaseDetailPopupWindow } from "@/lib/caseDetailPopup";
import { isCaseEditPopupWindow } from "@/lib/caseEditPopup";
import { cn } from "@/lib/utils";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [caseDetailPopup, setCaseDetailPopup] = useState(false);
  const [caseEditPopup, setCaseEditPopup] = useState(false);

  const isLoginRoute = pathname?.startsWith("/login") ?? false;
  const isLandingRoute = pathname?.startsWith("/landing") ?? false;
  const isWwwRoute = pathname?.startsWith("/www") ?? false;
  const isCasesRoute = pathname === "/cases" || pathname?.startsWith("/cases?");
  const isLegalEncyclopediaRoute = pathname?.startsWith("/board/ai/legal_encyclopedia") ?? false;
  const isPopupRoute =
    pathname === "/cases/deadline-info" ||
    pathname === "/cases/memo-popup" ||
    pathname === "/cases/memo-view-popup" ||
    pathname === "/cases/files-popup" ||
    pathname === "/cases/popup" ||
    pathname === "/cases/edit-popup" ||
    pathname === "/viewer" ||
    pathname === "/board/precedent-viewer" ||
    pathname?.startsWith("/calendar/manage") === true ||
    pathname === "/approval/draft" ||
    pathname === "/approval/reject";

  useEffect(() => {
    setCaseDetailPopup(isCaseDetailPopupWindow(pathname));
    setCaseEditPopup(isCaseEditPopupWindow(pathname));
  }, [pathname]);

  useEffect(() => {
    if (isLoginRoute || isLandingRoute || isWwwRoute) {
      setChecked(true);
      return;
    }
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.user) {
          router.replace("/login");
          return;
        }
        setChecked(true);
      })
      .catch(() => {
        router.replace("/login");
        setChecked(true);
      });
  }, [isLoginRoute, isLandingRoute, isWwwRoute, router]);

  if (isLoginRoute || isLandingRoute || isWwwRoute || isPopupRoute || caseDetailPopup || caseEditPopup) {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-slate-500">로그인 확인 중...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main
          className={cn(
            "flex-1 overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0",
            (isCasesRoute || isLegalEncyclopediaRoute) &&
              "flex flex-col min-h-0 overflow-hidden lg:overflow-hidden max-lg:pb-0"
          )}
        >
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
