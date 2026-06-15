/** 관리자 메뉴 편집용 아이콘 목록 (Lucide 이름) */
export const MENU_ICON_OPTIONS = [
  "LayoutDashboard",
  "FolderOpen",
  "FileText",
  "CreditCard",
  "Users",
  "Settings",
  "BarChart3",
  "Calendar",
  "CalendarDays",
  "Bell",
  "MoreHorizontal",
  "LayoutList",
  "Scale",
  "Shield",
  "MessageSquare",
  "TrendingUp",
  "Home",
  "Search",
] as const;

export type MenuIconName = (typeof MENU_ICON_OPTIONS)[number];
