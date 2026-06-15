/**
 * 백과 프로젝트 — 사건 선택 옵션
 */

import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { applyTenantFilter, resolveManagementNumber } from "@/lib/tenantScope";

export async function GET() {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ cases: [] });

  const mn = await resolveManagementNumber(auth.session, db);
  if (!mn) return NextResponse.json({ cases: [] });

  const { data } = await applyTenantFilter(
    db.from("cases").select("id, client_name, case_name, case_number, status").order("updated_at", { ascending: false }).limit(80),
    mn
  );

  return NextResponse.json({
    cases: (data ?? []).map((c) => ({
      id: c.id,
      clientName: c.client_name ?? "",
      caseTitle: c.case_name ?? "",
      caseNumber: c.case_number ?? "",
      status: c.status ?? "",
      label: `${c.client_name ?? "의뢰인"} · ${c.case_name ?? c.case_number ?? c.id}`,
    })),
  });
}
