/**
 * 관리자 배너광고 CRUD
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import {
  deleteBanner,
  isAdBannerDbReady,
  listAllBanners,
  replaceAllBanners,
  type AdBannerRow,
} from "@/lib/adBannerService";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 연결 실패" }, { status: 503 });
  if (!(await isAdBannerDbReady(db))) {
    return NextResponse.json({ error: "site_ad_banners 마이그레이션 필요" }, { status: 503 });
  }

  const placement = new URL(req.url).searchParams.get("placement") ?? undefined;
  const data = await listAllBanners(db, placement);
  return NextResponse.json({ data });
}

export async function PUT(req: Request) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 연결 실패" }, { status: 503 });
  if (!(await isAdBannerDbReady(db))) {
    return NextResponse.json({ error: "site_ad_banners 마이그레이션 필요" }, { status: 503 });
  }

  let body: { data?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const rows = (body.data ?? []) as Partial<AdBannerRow>[];
  const payload = rows.map((r, i) => ({
    management_number: r.management_number ?? null,
    placement: String(r.placement ?? "legal_encyclopedia"),
    item_order: i,
    title: String(r.title ?? ""),
    image_url: String(r.image_url ?? ""),
    link_url: String(r.link_url ?? ""),
    active: r.active !== false,
  }));

  for (const r of payload) {
    if (!r.image_url.trim()) {
      return NextResponse.json({ error: "이미지 URL이 필요합니다." }, { status: 400 });
    }
  }

  try {
    const data = await replaceAllBanners(db, payload);
    return NextResponse.json({ data, message: "배너가 저장되었습니다." });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 실패" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 연결 실패" }, { status: 503 });

  try {
    await deleteBanner(db, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 500 }
    );
  }
}
