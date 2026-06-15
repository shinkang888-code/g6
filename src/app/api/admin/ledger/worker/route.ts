export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { runAllLedgerWorkers } from "@/lib/ledger/ledgerWorker";
import { runIntegrityScan, runReplayForAlert } from "@/lib/ledger/integrityScanner";

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  let body: { action?: string; alertId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = body.action ?? "worker";

  if (action === "scan") {
    const scan = await runIntegrityScan(db);
    return NextResponse.json({ ok: true, scan });
  }

  if (action === "replay" && body.alertId) {
    const replay = await runReplayForAlert(db, body.alertId);
    return NextResponse.json(replay);
  }

  const result = await runAllLedgerWorkers(db, { includeIntegrityScan: false });
  return NextResponse.json({ ok: true, ...result });
}
