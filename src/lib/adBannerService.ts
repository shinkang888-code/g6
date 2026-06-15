/**
 * 사이트 배너광고 — DB CRUD
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdBannerRow = {
  id: string;
  management_number: string | null;
  placement: string;
  item_order: number;
  title: string;
  image_url: string;
  link_url: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdBanner = {
  id: string;
  placement: string;
  itemOrder: number;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
};

function fromRow(r: AdBannerRow): AdBanner {
  return {
    id: r.id,
    placement: r.placement,
    itemOrder: r.item_order,
    title: r.title,
    imageUrl: r.image_url,
    linkUrl: r.link_url,
    active: r.active,
  };
}

export async function isAdBannerDbReady(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from("site_ad_banners").select("id").limit(1);
  return !error;
}

export async function listActiveBanners(
  db: SupabaseClient,
  placement: string,
  managementNumber?: string | null
): Promise<AdBanner[]> {
  let query = db
    .from("site_ad_banners")
    .select("*")
    .eq("placement", placement)
    .eq("active", true)
    .order("item_order", { ascending: true });

  if (managementNumber) {
    query = query.or(`management_number.is.null,management_number.eq.${managementNumber}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[ad_banners] list", error.message);
    return [];
  }
  return (data ?? []).map((r) => fromRow(r as AdBannerRow));
}

export async function listAllBanners(db: SupabaseClient, placement?: string): Promise<AdBannerRow[]> {
  let query = db.from("site_ad_banners").select("*").order("item_order", { ascending: true });
  if (placement) query = query.eq("placement", placement);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AdBannerRow[];
}

export async function replaceAllBanners(
  db: SupabaseClient,
  rows: {
    management_number?: string | null;
    placement: string;
    item_order: number;
    title: string;
    image_url: string;
    link_url: string;
    active: boolean;
  }[]
): Promise<AdBannerRow[]> {
  const placement = rows[0]?.placement ?? "legal_encyclopedia";
  await db.from("site_ad_banners").delete().eq("placement", placement);

  if (rows.length === 0) return [];

  const payload = rows.map((r, i) => ({
    management_number: r.management_number ?? null,
    placement: r.placement,
    item_order: i,
    title: r.title ?? "",
    image_url: r.image_url,
    link_url: r.link_url ?? "",
    active: r.active ?? true,
  }));

  const { data, error } = await db.from("site_ad_banners").insert(payload).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdBannerRow[];
}

export async function deleteBanner(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("site_ad_banners").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
