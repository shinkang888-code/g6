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
  const pageSize = Math.min(30, Math.max(1, Number(sp.get("pageSize") ?? 15)));
  const stream = sp.get("stream")?.trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db
    .from("ledger_blocks")
    .select(
      "id, tenant_id, stream, block_height, prev_block_hash, merkle_root, block_hash, tx_count, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (stream) query = query.eq("stream", stream);

  const { data: blocks, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const blockIds = (blocks ?? []).map((b) => b.id);
  let anchors: Record<string, unknown>[] = [];
  if (blockIds.length) {
    const { data: anchorRows } = await db
      .from("ledger_anchors")
      .select("block_id, anchor_hash, external_network, external_tx_id, anchored_at")
      .in("block_id", blockIds);
    anchors = anchorRows ?? [];
  }

  const anchorByBlock = new Map(anchors.map((a) => [String(a.block_id), a]));

  return NextResponse.json({
    data: (blocks ?? []).map((b) => ({
      ...b,
      anchor: anchorByBlock.get(String(b.id)) ?? null,
    })),
    total: count ?? 0,
    page,
    pageSize,
  });
}
