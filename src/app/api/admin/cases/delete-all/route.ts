import { NextResponse } from "next/server";
import { applyTenantFilter, requireTenantSession } from "@/lib/tenantScope";

export async function DELETE() {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let totalDeleted = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await applyTenantFilter(db.from("cases").select("id"), managementNumber).range(
      0,
      pageSize - 1
    );
    if (error) {
      return NextResponse.json({ error: error.message, deleted: totalDeleted }, { status: 400 });
    }
    const ids = (data ?? []).map((r) => r.id as string).filter(Boolean);
    if (ids.length === 0) break;
    const { error: delError } = await applyTenantFilter(db.from("cases").delete(), managementNumber).in(
      "id",
      ids
    );
    if (delError) {
      return NextResponse.json({ error: delError.message, deleted: totalDeleted }, { status: 400 });
    }
    totalDeleted += ids.length;
    if (ids.length < pageSize) break;
  }

  return NextResponse.json({
    message: `회사 사건 ${totalDeleted}건을 삭제했습니다.`,
    deleted: totalDeleted,
  });
}
