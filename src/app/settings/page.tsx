"use client";

import Link from "next/link";
import { Bell, Shield, Database, Palette, ShieldCheck, Sparkles, MessageSquare, Users, Cloud, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

const cards: { href: string; icon: React.ReactNode; title: string; desc: string; action: string; primary?: boolean }[] = [
  {
    href: "/admin",
    icon: <ShieldCheck size={20} className="text-white" />,
    title: "프론트엔드 관리자",
    desc: "메뉴 등록·편집·삭제, 전체 시스템 관리",
    action: "관리자 페이지",
    primary: true,
  },
  {
    href: "/admin/settings/theme",
    icon: <Palette size={16} className="text-primary-600" />,
    title: "테마 및 표시",
    desc: "다크모드, 폰트 크기, 색상 테마를 설정합니다.",
    action: "설정",
  },
  {
    href: "/admin/settings/notifications",
    icon: <Bell size={16} className="text-warning-500" />,
    title: "알림 설정",
    desc: "기일 알림 기준일, 이메일/SMS 알림 연동을 설정합니다.",
    action: "설정",
  },
  {
    href: "/admin/settings/integration",
    icon: <Database size={16} className="text-success-500" />,
    title: "그누보드 연동",
    desc: "그누보드 6 API 엔드포인트 및 인증 키를 설정합니다.",
    action: "연동 설정",
  },
  {
    href: "/admin/settings/drive",
    icon: <Cloud size={16} className="text-sky-500" />,
    title: "Google Drive 자료실",
    desc: "사건 자료실용 서비스 계정 JSON 키를 업로드·등록합니다.",
    action: "Drive 설정",
  },
  {
    href: "/admin/settings/ai",
    icon: <Sparkles size={16} className="text-primary-500" />,
    title: "AI 연동관리",
    desc: "Gemini API 키를 설정하면 전문 게시판 AI 기능이 동작합니다.",
    action: "연동 설정",
  },
  {
    href: "/admin/settings/law-open-api",
    icon: <Scale size={16} className="text-primary-600" />,
    title: "국가법령정보 API",
    desc: "법률검색 조문 원문 Open API OC를 등록하고 Vercel에 반영합니다.",
    action: "연동 설정",
  },
  {
    href: "/admin/settings/messenger",
    icon: <MessageSquare size={16} className="text-primary-500" />,
    title: "메신저 연동관리",
    desc: "알리고, 카카오톡, 텔레그램, 라인, WhatsApp, 틱톡 API 키를 설정하면 메시지 발송이 가능합니다.",
    action: "연동 설정",
  },
  {
    href: "/admin/settings/roles",
    icon: <Shield size={16} className="text-violet-500" />,
    title: "권한 관리",
    desc: "역할별 메뉴 접근 권한과 데이터 접근 범위를 설정합니다.",
    action: "관리",
  },
  {
    href: "/admin/members",
    icon: <Users size={16} className="text-slate-600" />,
    title: "회원 관리",
    desc: "가입 신청 회원 승인·삭제, 아이디로 일괄 승인·삭제.",
    action: "관리",
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-slate-900">시스템 설정</h1>

      {cards.map((item) => (
        <Link key={item.title} href={item.href}>
          <div
            className={
              item.primary
                ? "bg-primary-50 border border-primary-200 rounded-2xl p-5 flex items-center justify-between hover:bg-primary-100/80 transition-colors"
                : "bg-white rounded-2xl border border-slate-200 shadow-card p-5 flex items-center justify-between hover:border-primary-200 hover:shadow-card-hover transition-all"
            }
          >
            <div className="flex items-center gap-4">
              <div
                className={
                  item.primary
                    ? "w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center"
                    : "w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center"
                }
              >
                {item.icon}
              </div>
              <div>
                <div className={`text-sm font-semibold ${item.primary ? "text-primary-900" : "text-slate-800"}`}>
                  {item.title}
                </div>
                <div className={`text-xs mt-0.5 ${item.primary ? "text-primary-700" : "text-text-muted"}`}>
                  {item.desc}
                </div>
              </div>
            </div>
            <Button variant={item.primary ? "primary" : "outline"} size="sm">
              {item.action}
            </Button>
          </div>
        </Link>
      ))}
    </div>
  );
}
