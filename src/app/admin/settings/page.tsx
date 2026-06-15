"use client";

import Link from "next/link";
import { Settings, Palette, Bell, Database, Shield, ChevronRight, Cloud, ClipboardList, LogIn, Scale, CreditCard, Lock } from "lucide-react";
import { usePlatformSecretsAccess } from "@/components/admin/PlatformSecretsGate";

const cards = [
  { icon: CreditCard, title: "구독·결제", desc: "Stripe·다날 월 구독, 이용 정지/재개", href: "/admin/settings/billing", secretsOnly: false },
  { icon: Palette, title: "테마 및 표시", desc: "다크모드, 폰트, 색상 테마", href: "/admin/settings/theme", secretsOnly: false },
  { icon: Bell, title: "알림 설정", desc: "기일 알림 기준일, 이메일/SMS", href: "/admin/settings/notifications", secretsOnly: false },
  { icon: Database, title: "DB·API 연동", desc: "Supabase, 그누보드 G6 URL·키", href: "/admin/settings/integration", secretsOnly: true },
  { icon: LogIn, title: "Google OAuth", desc: "Google 계정 로그인·간편 회원가입", href: "/admin/settings/google-oauth", secretsOnly: true },
  { icon: Scale, title: "국가법령정보 API", desc: "법률검색 조문 원문 Open API (LAW_GO_KR_OC)", href: "/admin/settings/law-open-api", secretsOnly: true },
  { icon: Cloud, title: "Google Drive", desc: "사건 자료실 Drive 연동·서비스 계정", href: "/admin/settings/drive", secretsOnly: true },
  { icon: Shield, title: "권한 관리", desc: "역할별 메뉴·데이터 접근 범위", href: "/admin/settings/roles", secretsOnly: false },
];

export default function AdminSettingsPage() {
  const { allowed, loading } = usePlatformSecretsAccess();
  const visibleCards = cards.filter((item) => !item.secretsOnly || allowed);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings size={26} className="text-primary-600" />
          시스템 설정
        </h1>
        <p className="text-sm text-text-muted mt-1">
          테마, 알림, DB·API 연동, 권한 등 전체 시스템을 관리합니다.
        </p>
        {!loading && !allowed && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
            <Lock size={12} className="inline mr-1 -mt-0.5" />
            API 키·환경변수 설정은 <strong>shinkang</strong> / <strong>kangjunchul8@gmail.com</strong> 계정만 표시됩니다.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {visibleCards.map((item) => (
          <Link key={item.title} href={item.href}>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 flex items-center justify-between hover:border-primary-200 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                  <item.icon size={22} className="text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                    {item.title}
                    {item.secretsOnly && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        전체관리자
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-text-muted">{item.desc}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-400 shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">보안·감사</h2>
          <p className="text-xs text-text-muted mt-1">사건 데이터 변경 이력을 서버에 보관·조회합니다.</p>
        </div>
        {allowed && (
          <Link href="/admin/security">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 flex items-center justify-between hover:border-red-200 hover:shadow-card-hover transition-all mb-3">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
                  <Shield size={22} className="text-red-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">보안 관제 (SOC)</h3>
                  <p className="text-sm text-text-muted">위협 탐지 로그·공격 통계·접속 환경 점검</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-400 shrink-0" />
            </div>
          </Link>
        )}
        <Link href="/admin/settings/records">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 flex items-center justify-between hover:border-amber-200 hover:shadow-card-hover transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                <ClipboardList size={22} className="text-amber-700" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">기록 관리</h3>
                <p className="text-sm text-text-muted">사건 변경 로그 — 누가·언제·무엇을 수정했는지</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400 shrink-0" />
          </div>
        </Link>
      </div>
    </div>
  );
}
