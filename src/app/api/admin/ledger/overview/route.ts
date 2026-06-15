export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { getLedgerOverview } from "@/lib/ledger/ledgerOverview";
import { isLedgerEnabled } from "@/lib/ledger/ledgerConfig";

export async function GET() {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const stats = await getLedgerOverview(db);

  return NextResponse.json({
    ...stats,
    viewer: {
      loginId: admin.session.loginId,
      name: admin.session.name,
      role: admin.session.role,
    },
    config: {
      enabled: isLedgerEnabled(),
      anchorProvider: process.env.LEDGER_ANCHOR_PROVIDER ?? "lawygo_timestamp_v1",
      blockThreshold: process.env.LEDGER_BLOCK_TX_THRESHOLD ?? "50",
    },
  });
}
