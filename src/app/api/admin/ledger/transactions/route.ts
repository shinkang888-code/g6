export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";

export async function GET(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") ?? 20)));
  const stream = sp.get("stream")?.trim();
  const status = sp.get("status")?.trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db
    .from("ledger_transactions")
    .select(
      "id, tenant_id, stream, source_table, source_id, status, tx_hash, prev_hash, seq, created_at, trans_data",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (stream) query = query.eq("stream", stream);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  });
}
