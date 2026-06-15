"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FolderOpen, FileText, CreditCard,
  MoreHorizontal, X, CalendarDays, BarChart3, Users, Settings, Bell, LayoutList,
  Scale, Shield, MessageSquare, TrendingUp, Home, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMenus } from "@/hooks/useMenus";

const mobileIconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard, FolderOpen, FileText, CreditCard, MoreHorizontal,
  CalendarDays, BarChart3, Users, Settings, Bell, LayoutList,
  Scale, Shield, MessageSquare, TrendingUp, Home, Search,
};

function getMobileIcon(iconName: string, size: number) {
  const Icon = mobileIconMap[iconName] ?? FileText;
  return <Icon size={size} />;
}

export function MobileNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  const { mobileMain, mobileMore } = useMenus();

  const mainNav = mobileMain.map((item) => ({
    label: item.label,
    href: item.href,
    icon: getMobileIcon(item.icon, 20),
    badge: item.badge,
  }));
  const moreNav = mobileMore.map((item) => ({
    label: item.label,
    href: item.href,
    icon: getMobileIcon(item.icon, 18),
  }));

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-area-pb shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-around px-1 py-1.5">
          {mainNav.map((item) => {
            const isActive = item.href !== "#more" && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
            const isMore = item.href === "#more";

            if (isMore) {
              return (
                <button
                  key="more"
                  onClick={() => setSheetOpen(true)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-2 rounded-xl min-w-[56px] min-h-[52px]",
                    "text-slate-500 hover:text-slate-800 transition-colors"
                  )}
                >
                  <span className="relative">
                    {item.icon}
                  </span>
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2 rounded-xl min-w-[56px] min-h-[52px] transition-colors relative",
                  isActive ? "text-primary-600" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <span className="relative">
                  {item.icon}
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className={cn("text-2xs font-medium", isActive && "font-semibold")}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary-50 rounded-xl -z-10"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 lg:hidden"
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl lg:hidden"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-slate-200 rounded-full" />
              </div>

              <div className="px-5 pb-8 pt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900">더보기</h3>
                  <button
                    onClick={() => setSheetOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {moreNav.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSheetOpen(false)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                          isActive
                            ? "bg-primary-50 border-primary-200 text-primary-700"
                            : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {item.icon}
                        <span className="text-xs font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Quick actions */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">빠른 작업</div>
                  <Link
                    href="/cases/new"
                    onClick={() => setSheetOpen(false)}
                    className="flex items-center gap-3 p-3 bg-primary-600 text-white rounded-xl font-medium text-sm"
                  >
                    <FolderOpen size={16} />
                    새 사건 등록
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
