"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Users,
  LayoutGrid,
  FileText,
  Settings,
  Mail,
  BarChart3,
  Palette,
  Shield,
  Zap,
  FolderOpen,
  MessageCircle,
  HelpCircle,
  SquareStack,
  Archive,
  Puzzle,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { getG6AdminBaseUrl } from "@/lib/gnuboardConfig";

function getG6BaseUrl(): string | null {
  return getG6AdminBaseUrl();
}

const G6_ADMIN_SECTIONS = [
  {
    title: "관리자 메인",
    desc: "대시보드, 신규회원·최근글·포인트 요약",
    path: "/admin",
    icon: BarChart3,
  },
  {
    title: "기본환경설정",
    desc: "사이트 제목, 에디터, 쿠키 등",
    path: "/admin/config_form",
    icon: Settings,
  },
  {
    title: "회원 관리",
    desc: "회원 목록·등록·수정·삭제",
    path: "/admin/member_list",
    icon: Users,
  },
  {
    title: "포인트",
    desc: "포인트 목록, 지급/차감",
    path: "/admin/point_list",
    icon: Zap,
  },
  {
    title: "게시판 그룹",
    desc: "그룹 목록·등록·수정",
    path: "/admin/boardgroup_list",
    icon: FolderOpen,
  },
  {
    title: "게시판",
    desc: "게시판 목록·등록·수정·복사",
    path: "/admin/board_list",
    icon: LayoutGrid,
  },
  {
    title: "그룹별 접근 회원",
    desc: "그룹별 접근 가능 회원 설정",
    path: "/admin/boardgroup_list",
    icon: Shield,
  },
  {
    title: "내용(컨텐츠)",
    desc: "내용 목록·등록·수정",
    path: "/admin/content_list",
    icon: FileText,
  },
  {
    title: "FAQ",
    desc: "FAQ 마스터·항목 관리",
    path: "/admin/faq_master_list",
    icon: HelpCircle,
  },
  {
    title: "테마",
    desc: "테마 목록·미리보기·적용",
    path: "/admin/theme",
    icon: Palette,
  },
  {
    title: "접속자",
    desc: "접속자 검색·집계·로그 삭제",
    path: "/admin/visit_search",
    icon: BarChart3,
  },
  {
    title: "1:1 문의 설정",
    desc: "1:1 문의 게시판 설정",
    path: "/admin/qa_config",
    icon: MessageCircle,
  },
  {
    title: "메일 테스트",
    desc: "메일 발송 테스트",
    path: "/admin/sendmail_test",
    icon: Mail,
  },
  {
    title: "메뉴",
    desc: "사이트 메뉴 목록·수정",
    path: "/admin/menu_list",
    icon: LayoutGrid,
  },
  {
    title: "관리자 권한",
    desc: "관리자 권한 목록·등록·수정",
    path: "/admin/auth_list",
    icon: Shield,
  },
  {
    title: "인기 검색어",
    desc: "인기 검색어 목록·순위·삭제",
    path: "/admin/popular_list",
    icon: BarChart3,
  },
  {
    title: "설문조사",
    desc: "설문 목록·등록·수정",
    path: "/admin/poll_list",
    icon: BarChart3,
  },
  {
    title: "팝업(레이어)",
    desc: "팝업 목록·등록·수정",
    path: "/admin/newwin_list",
    icon: SquareStack,
  },
  {
    title: "회원 메일 발송",
    desc: "회원 대상 메일 발송 목록·작성",
    path: "/admin/mail_list",
    icon: Mail,
  },
  {
    title: "글/댓글 현황",
    desc: "글·댓글 현황 그래프",
    path: "/admin/write_count",
    icon: BarChart3,
  },
  {
    title: "플러그인",
    desc: "플러그인 목록·활성/비활성",
    path: "/admin/plugin_list",
    icon: Puzzle,
  },
  {
    title: "캐시",
    desc: "캐시 파일 삭제",
    path: "/admin/cache_file_delete",
    icon: Archive,
  },
  {
    title: "부가서비스",
    desc: "부가서비스 안내",
    path: "/admin/service",
    icon: Server,
  },
] as const;

export default function AdminG6Page() {
  const g6Base = useMemo(() => getG6BaseUrl(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          G6(그누보드6) 관리
        </h1>
        <p className="text-sm text-text-muted mt-1">
          G6 관리자 콘솔 기능을 LawyGo 관리자에서 바로 열 수 있습니다. 연동 URL이 설정되어 있으면 각 메뉴를 G6 관리자 페이지로 이동합니다.
        </p>
      </div>

      {!g6Base ? (
        <div className="rounded-xl border border-warning-200 bg-warning-50 p-5">
          <p className="text-sm font-medium text-warning-800">G6 연동 URL이 설정되지 않았습니다.</p>
          <p className="text-xs text-warning-700 mt-1">
            <code className="bg-white/60 px-1 rounded">.env.local</code>에{" "}
            <code className="bg-white/60 px-1 rounded">NEXT_PUBLIC_GNUBOARD_API_URL</code>을 설정하면
            (예: <code className="bg-white/60 px-1 rounded">http://localhost:8000/api</code>) 아래 버튼으로 G6 관리자 콘솔을 열 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-primary-50 border border-primary-200">
          <ExternalLink size={20} className="text-primary-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary-900">G6 관리자 콘솔</p>
            <p className="text-xs text-primary-700 truncate">{g6Base}/admin</p>
          </div>
          <a
            href={`${g6Base}/admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button size="sm" rightIcon={<ExternalLink size={14} />}>
              콘솔 열기
            </Button>
          </a>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">G6 관리자 메뉴별 바로가기</h2>
        <p className="text-xs text-text-muted mb-4">
          아래 항목은 G6 관리자 콘솔에 있는 기능 전체 목록입니다. 연동 URL이 설정된 경우 클릭 시 해당 G6 관리 페이지가 새 탭에서 열립니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {G6_ADMIN_SECTIONS.map((section) => {
            const href = g6Base ? `${g6Base}${section.path}` : undefined;
            const Icon = section.icon;
            return (
              <div
                key={section.path + section.title}
                className="bg-white rounded-xl border border-slate-200 shadow-card p-4 flex flex-col"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-slate-900 text-sm">{section.title}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{section.desc}</p>
                  </div>
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                  >
                    <ExternalLink size={12} />
                    G6에서 열기
                  </a>
                ) : (
                  <span className="mt-3 text-xs text-slate-400">연동 후 사용 가능</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-text-muted">
          전체 기능 목록 및 경로는 <code className="bg-white px-1 rounded">docs/g6-admin-features.md</code>를 참고하세요.
          LawyGo 프론트에서 G6 관리 화면을 100% 재구현하려면 G6 측에 관리자용 JSON API가 필요합니다.
        </p>
      </div>
    </div>
  );
}
