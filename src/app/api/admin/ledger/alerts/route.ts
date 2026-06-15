export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";

export async function GET(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const unresolvedOnly = request.nextUrl.searchParams.get("open") === "1";

  let query = db
    .from("ledger_integrity_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (unresolvedOnly) query = query.is("resolved_at", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data: data ?? [] });
}
