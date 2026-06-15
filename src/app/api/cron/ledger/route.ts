export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { isCronAuthorized } from "@/lib/ledger/cronAuth";
import { runAllLedgerWorkers } from "@/lib/ledger/ledgerWorker";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const includeIntegrity = request.nextUrl.searchParams.get("scan") === "1";
  const result = await runAllLedgerWorkers(db, { includeIntegrityScan: includeIntegrity });

  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
