/**
 * 프론트엔드 메뉴 서비스 (서버 전용)
 * - DB(site_menus) 우선, 없으면 menuConfig 기본값 사용
 * - getSupabaseAdmin() 사용으로 RLS 우회, 로그인 연동과 무관하게 동작
 */

import { getSupabaseAdmin } from "@/lib/supabaseClient";
import type { MenuItem } from "@/lib/menuConfig";
import {
  LNB_MENU,
  MOBILE_MAIN_MENU,
  MOBILE_MORE_MENU,
} from "@/lib/menuConfig";

export type MenuType = "lnb" | "mobile_main" | "mobile_more";

export interface SiteMenuRow {
  id: string;
  type: MenuType;
  item_order: number;
  item_id: string;
  label: string;
  href: string;
  icon: string;
  badge: number | null;
  roles: string[] | null;
  lawtop_module: string | null;
  created_at?: string;
  updated_at?: string;
}

function rowToItem(row: SiteMenuRow): MenuItem {
  return {
    id: row.item_id,
    label: row.label,
    href: row.href,
    icon: row.icon,
    badge: row.badge ?? undefined,
    roles: row.roles && row.roles.length > 0 ? row.roles : undefined,
    lawtopModule: row.lawtop_module ?? undefined,
  };
}

const defaultByType: Record<MenuType, MenuItem[]> = {
  lnb: LNB_MENU,
  mobile_main: MOBILE_MAIN_MENU,
  mobile_more: MOBILE_MORE_MENU,
};

/** DB에서 메뉴 목록 조회 (타입별) */
export async function getMenusFromDb(): Promise<{
  lnb: MenuItem[];
  mobileMain: MenuItem[];
  mobileMore: MenuItem[];
} | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("site_menus")
    .select("*")
    .order("item_order", { ascending: true });
  if (error || !data || data.length === 0) return null;
  const byType = { lnb: [] as MenuItem[], mobile_main: [] as MenuItem[], mobile_more: [] as MenuItem[] };
  (data as SiteMenuRow[]).forEach((row) => {
    if (byType[row.type]) byType[row.type].push(rowToItem(row));
  });
  return {
    lnb: byType.lnb,
    mobileMain: byType.mobile_main,
    mobileMore: byType.mobile_more,
  };
}

/** 프론트용: DB 있으면 DB 값, 없으면 기본값 */
export async function getMenusForApp(): Promise<{
  lnb: MenuItem[];
  mobileMain: MenuItem[];
  mobileMore: MenuItem[];
}> {
  const fromDb = await getMenusFromDb();
  if (fromDb && (fromDb.lnb.length > 0 || fromDb.mobileMain.length > 0 || fromDb.mobileMore.length > 0)) {
    return {
      lnb: fromDb.lnb,
      mobileMain: fromDb.mobileMain,
      mobileMore: fromDb.mobileMore,
    };
  }
  return {
    lnb: defaultByType.lnb,
    mobileMain: defaultByType.mobile_main,
    mobileMore: defaultByType.mobile_more,
  };
}

/** 관리자용: 타입별 전체 행 (id 포함) */
export async function getMenuRowsForAdmin(): Promise<SiteMenuRow[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("site_menus")
    .select("*")
    .order("type")
    .order("item_order", { ascending: true });
  if (error) return null;
  return (data ?? []) as SiteMenuRow[];
}
