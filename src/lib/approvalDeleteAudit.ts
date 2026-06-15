/**
 * 결재완료 문서 — 사내관리자 삭제 감사 로그
 */
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import type { ApprovalDoc } from "@/lib/types";
import type { SessionPayload } from "@/lib/authSession";
import { sessionAdminRoleLabel } from "@/lib/adminRoles";
import { resolveActiveManagementNumber } from "@/lib/platformTenantSwitch";

export function buildApprovalDocSnapshot(
  doc: ApprovalDoc,
  extra?: { attachmentNames?: string[] }
): string {
  const lines = [
    `제목: ${doc.title}`,
    `유형: ${doc.type}`,
    `상태: ${doc.status}`,
    `기안자: ${doc.requesterName} (${doc.requesterId})`,
    `사건번호: ${doc.caseNumber || "-"}`,
    `금액: ${doc.amount != null ? doc.amount : "-"}`,
    `작성일: ${doc.createdAt}`,
    `완료일: ${doc.completedAt ?? "-"}`,
    "",
    "[본문]",
    doc.notes?.trim() || "(본문 없음)",
    "",
    "[결재선]",
    ...doc.approvalLine.map(
      (s) =>
        `${s.order}차 ${s.staffName} — ${s.status}${s.signedAt ? ` (${s.signedAt})` : ""}${s.comment ? ` / ${s.comment}` : ""}`
    ),
  ];

  if (doc.referrerNames?.length) {
    lines.push("", `[참조] ${doc.referrerNames.join(", ")}`);
  }
  if (extra?.attachmentNames?.length) {
    lines.push("", `[첨부] ${extra.attachmentNames.join(", ")}`);
  }
  if (doc.metadata && Object.keys(doc.metadata).length > 0) {
    lines.push("", `[메타] ${JSON.stringify(doc.metadata)}`);
  }

  return lines.join("\n").slice(0, 32000);
}

export async function logApprovalAdminDelete(params: {
  session: SessionPayload;
  doc: ApprovalDoc;
  action: "soft_delete" | "permanent_delete";
  attachmentNames?: string[];
}): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;

  const tenantId = resolveActiveManagementNumber(params.session) || params.session.managementNumber || "";
  if (!tenantId) return;

  const snapshot = buildApprovalDocSnapshot(params.doc, {
    attachmentNames: params.attachmentNames,
  });

  const { error } = await db.from("approval_delete_audit_logs").insert({
    tenant_id: tenantId,
    approval_id: params.doc.id,
    action: params.action,
    actor_id: params.session.userId,
    actor_login_id: params.session.loginId,
    actor_name: params.session.name,
    actor_role: sessionAdminRoleLabel(params.session) ?? params.session.role ?? null,
    doc_title: params.doc.title,
    doc_type: params.doc.type,
    doc_status: params.doc.status,
    doc_snapshot: snapshot,
  });

  if (error) {
    console.error("[approval_delete_audit]", error.message);
  }
}
