"use client";

import Link from "next/link";
import { LayoutDashboard, Menu, Settings, ExternalLink, Database, Server, FolderOpen, Users, Building2, Shield, Megaphone, Link2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

const cards = [
  {
    title: "회사·조직 관리",
    desc: "관리번호(00000, 00001…) 목록·등록, 조직 폴더, 구성원 배치, Google 가입 승인.",
    href: "/admin/company-groups",
    icon: Building2,
    cta: "그룹 관리",
  },
  {
    title: "사용자 관리",
    desc: "LawTop 스타일 사용자·권한·퇴사 lifecycle 관리 (3탭 통합 화면).",
    href: "/admin/users",
    icon: Users,
    cta: "사용자 관리",
  },
  {
    title: "보안 관제 (SOC)",
    desc: "Enterprise_Log_Monitoring 기반 — 위협 탐지 로그, 공격 유형 통계, 접속 환경 점검.",
    href: "/admin/security",
    icon: Shield,
    cta: "관제 대시보드",
  },
  {
    title: "분산원장 관리 (HDL)",
    desc: "신원-거래 강결합 해시체인 · Merkle 블록 · 외부 앵커 — 무결성 실시간 감시.",
    href: "/admin/ledger",
    icon: Link2,
    cta: "원장 콘솔",
  },
  {
    title: "배너광고 관리",
    desc: "법률백과 우측 광고판 — 이미지·URL 등록, 드래그 순서 변경, WYSIWYG 미리보기.",
    href: "/admin/banners",
    icon: Megaphone,
    cta: "배너 관리",
  },
  {
    title: "메뉴 관리",
    desc: "법무관리시스템 이용자 화면의 LNB·모바일 메뉴를 등록·편집·삭제하고 순서를 변경합니다.",
    href: "/admin/menus",
    icon: Menu,
    cta: "메뉴 관리하기",
  },
  {
    title: "시스템 설정",
    desc: "테마, 알림, 그누보드 연동, 권한 등 전체 시스템 설정을 관리합니다.",
    href: "/admin/settings",
    icon: Settings,
    cta: "설정하기",
  },
  {
    title: "G6(그누보드6) 관리",
    desc: "G6 관리자 콘솔(회원·게시판·환경설정·테마·메뉴 등) 기능을 열어 사용합니다. 연동 URL 설정 시 바로가기 제공.",
    href: "/admin/g6",
    icon: Server,
    cta: "G6 관리",
  },
  {
    title: "사건관리",
    desc: "대량 엑셀 등록, 전체 사건 목록 검색·필터, 진행사건 종결·일괄 삭제 등 사건을 편집·관리합니다.",
    href: "/admin/cases",
    icon: FolderOpen,
    cta: "사건관리하기",
  },
  {
    title: "자료관리",
    desc: "Google Drive에 올라간 회사·사건·백과 자료를 검색·업로드·파일명 수정·다운로드·삭제합니다.",
    href: "/admin/materials",
    icon: HardDrive,
    cta: "자료관리하기",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">관리 대시보드</h1>
        <p className="text-sm text-text-muted mt-1">
          프론트엔드(법무관리시스템) 메뉴와 전체 시스템을 관리합니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover:shadow-card-hover hover:border-primary-200 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <card.icon size={22} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{card.title}</h3>
                  <p className="text-sm text-text-muted mt-0.5">{card.desc}</p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <span>{card.cta}</span>
                  </Button>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-100 border border-slate-200">
        <LayoutDashboard size={20} className="text-slate-500" />
        <div>
          <p className="text-sm font-medium text-slate-700">이용자 대시보드</p>
          <p className="text-xs text-text-muted">메뉴 변경 사항은 이용자 화면의 사이드바·하단 네비에 반영됩니다.</p>
        </div>
        <Link href="/" className="ml-auto">
          <Button variant="ghost" size="sm" rightIcon={<ExternalLink size={14} />}>
            미리보기
          </Button>
        </Link>
      </div>
    </div>
  );
}
