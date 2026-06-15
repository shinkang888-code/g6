"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, Settings, Shield, Server, Building2, Megaphone, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformSecretsAccess } from "@/components/admin/PlatformSecretsGate";

const adminNav = [
  { label: "관리 대시보드", href: "/admin", icon: LayoutDashboard },
  { label: "회사·조직", href: "/admin/company-groups", icon: Building2 },
  { label: "보안 관제", href: "/admin/security", icon: Shield, secretsOnly: true },
  { label: "분산원장 관리", href: "/admin/ledger", icon: Link2 },
  { label: "메뉴 관리", href: "/admin/menus", icon: Menu },
  { label: "배너광고", href: "/admin/banners", icon: Megaphone },
  { label: "시스템 설정", href: "/admin/settings", icon: Settings },
  { label: "G6 관리", href: "/admin/g6", icon: Server },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { allowed: secretsAllowed } = usePlatformSecretsAccess();
  const navItems = adminNav.filter((item) => !item.secretsOnly || secretsAllowed);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold text-slate-900">
              <Shield size={20} className="text-primary-600" />
              프론트엔드 관리자
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link href="/" className="text-sm text-text-muted hover:text-primary-600">
            이용자 화면으로
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
