/**
 * 공개 배너 목록
 * GET ?placement=legal_encyclopedia
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import { resolveManagementNumber } from "@/lib/tenantScope";
import { isAdBannerDbReady, listActiveBanners } from "@/lib/adBannerService";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placement = searchParams.get("placement")?.trim() || "legal_encyclopedia";

  const db = getSupabaseAdmin();
  if (!db || !(await isAdBannerDbReady(db))) {
    return NextResponse.json({ data: [] });
  }

  const session = await getSession();
  const managementNumber = session ? await resolveManagementNumber(session, db) : null;

  const data = await listActiveBanners(db, placement, managementNumber);
  return NextResponse.json({ data });
}
