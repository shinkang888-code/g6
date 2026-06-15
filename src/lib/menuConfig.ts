/**
 * LawyGo 메뉴 구성 (LawTop GL 모듈 대응)
 * - LNB/Sidebar, 모바일 Bottom Nav, 권한별 노출
 */

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon: string; // Lucide icon name
  badge?: number;
  /** 권한: 이 중 하나라도 있으면 표시. 비어있으면 전체 */
  roles?: string[];
  /** LawTop GL 대응 모듈 */
  lawtopModule?: string;
}

/** 메인 LNB 메뉴 (PC 사이드바) */
export const LNB_MENU: MenuItem[] = [
  { id: "dashboard", label: "대시보드", href: "/", icon: "LayoutDashboard", lawtopModule: "메인/업무현황" },
  { id: "cases", label: "사건 관리", href: "/cases", icon: "FolderOpen", lawtopModule: "사건관리" },
  { id: "board", label: "게시판", href: "/board", icon: "LayoutList", lawtopModule: "게시판" },
  { id: "calendar", label: "기일 달력", href: "/calendar", icon: "Calendar", lawtopModule: "기일/일정" },
  { id: "consultation", label: "상담관리", href: "/consultation", icon: "MessageSquare", lawtopModule: "상담/회의실" },
  { id: "clients", label: "고객관리", href: "/clients", icon: "UserCircle", lawtopModule: "고객관리" },
  { id: "messenger", label: "메신저", href: "/messenger", icon: "Send", lawtopModule: "메신저" },
  { id: "internal-messenger", label: "사내 메신저", href: "/internal-messenger", icon: "MessageCircle", lawtopModule: "사내메신저" },
  { id: "approval", label: "전자결재", href: "/approval", icon: "FileText", badge: 0, lawtopModule: "LawTopProcess" },
  { id: "finance", label: "회계/수납", href: "/finance", icon: "CreditCard", lawtopModule: "LawTopCashReceipt" },
  { id: "stats", label: "통계/분석", href: "/stats", icon: "BarChart3", lawtopModule: "Reports" },
  { id: "staff", label: "직원 관리", href: "/staff", icon: "Users", roles: ["관리자", "변호사"], lawtopModule: "직원/조직" },
  { id: "notifications", label: "알림 설정", href: "/notifications", icon: "Bell", lawtopModule: "ChatNoti" },
  { id: "settings", label: "시스템 설정", href: "/settings", icon: "Settings", roles: ["관리자"], lawtopModule: "설정" },
];

/** 모바일 하단 5개 + 더보기 */
export const MOBILE_MAIN_MENU: MenuItem[] = [
  { id: "dashboard", label: "대시보드", href: "/", icon: "LayoutDashboard" },
  { id: "cases", label: "사건", href: "/cases", icon: "FolderOpen" },
  { id: "board", label: "게시판", href: "/board", icon: "LayoutList" },
  { id: "approval", label: "결재", href: "/approval", icon: "FileText", badge: 0 },
  { id: "more", label: "더보기", href: "#more", icon: "MoreHorizontal" },
];

/** 더보기 시트 안 메뉴 */
export const MOBILE_MORE_MENU: MenuItem[] = [
  { id: "calendar", label: "기일 달력", href: "/calendar", icon: "CalendarDays" },
  { id: "consultation", label: "상담관리", href: "/consultation", icon: "MessageSquare" },
  { id: "clients", label: "고객관리", href: "/clients", icon: "UserCircle" },
  { id: "messenger", label: "메신저", href: "/messenger", icon: "Send" },
  { id: "internal-messenger", label: "사내 메신저", href: "/internal-messenger", icon: "MessageCircle" },
  { id: "stats", label: "통계/분석", href: "/stats", icon: "BarChart3" },
  { id: "staff", label: "직원 관리", href: "/staff", icon: "Users" },
  { id: "notifications", label: "알림", href: "/notifications", icon: "Bell" },
  { id: "settings", label: "설정", href: "/settings", icon: "Settings" },
];

/** 사용자 권한에 따라 필터링 */
export function getMenuForRoles(menu: MenuItem[], userRoles: string[]): MenuItem[] {
  return menu.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some((r) => userRoles.includes(r));
  });
}
