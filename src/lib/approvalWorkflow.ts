/**
 * LawTop Process / ElectronicApproval 순차 결재 로직
 * - 동일 order 내 병렬 결재(전원 승인 후 다음 order)
 * - 결재자1~4 단계와 동일한 order 체인
 */

import type { ApprovalDoc, ApprovalMetadata, ApprovalStep, ApprovalStatus } from "./types";

export type ApprovalPermissionContext = {
  isCompanyAdmin?: boolean;
};

/** 최종 결재 차수(order 최대) 결재자 ID 목록 */
export function getFinalApproverStaffIds(line: ApprovalStep[]): string[] {
  if (!line.length) return [];
  const maxOrder = Math.max(...line.map((s) => s.order));
  return [
    ...new Set(
      line
        .filter((s) => s.order === maxOrder)
        .map((s) => String(s.staffId).trim())
        .filter(Boolean)
    ),
  ];
}

export function isFinalApprover(doc: ApprovalDoc, userId: string): boolean {
  const uid = String(userId ?? "").trim();
  if (!uid) return false;
  return getFinalApproverStaffIds(doc.approvalLine).includes(uid);
}

function isDrafter(doc: ApprovalDoc, userId: string): boolean {
  return String(doc.requesterId) === String(userId ?? "").trim();
}

/** 결재선 전원 대기(미승인) */
export function isApprovalLineAllPending(line: ApprovalStep[]): boolean {
  return line.length > 0 && line.every((s) => s.status === "대기");
}

export function getMinPendingOrder(line: ApprovalStep[]): number | null {
  const orders = [...new Set(line.map((s) => s.order))].sort((a, b) => a - b);
  for (const order of orders) {
    const steps = line.filter((s) => s.order === order);
    if (steps.some((s) => s.status === "반려")) return null;
    if (steps.some((s) => s.status === "대기")) return order;
  }
  return null;
}

/** 현재 결재 가능한 단계 (동일 order의 대기 중 결재자) */
export function getActiveApprovalSteps(line: ApprovalStep[]): ApprovalStep[] {
  const minOrder = getMinPendingOrder(line);
  if (minOrder == null) return [];
  return line.filter((s) => s.order === minOrder && s.status === "대기");
}

export function canUserActOnApproval(
  line: ApprovalStep[],
  userId: string,
  docStatus: ApprovalStatus
): boolean {
  if (docStatus !== "결재요청" && docStatus !== "결재중") return false;
  const uid = String(userId ?? "").trim();
  if (!uid) return false;
  return getActiveApprovalSteps(line).some((s) => String(s.staffId) === uid);
}

/** 기안자 수정 — 결재완료 불가, 결재요청(전원 대기) 또는 반려 */
export function canUserEditApprovalDoc(doc: ApprovalDoc, userId: string): boolean {
  const uid = String(userId ?? "").trim();
  if (!uid || doc.deletedAt) return false;
  if (doc.status === "결재완료") return false;
  if (!isDrafter(doc, uid)) return false;
  if (doc.status === "반려") return true;
  if (doc.status !== "결재요청") return false;
  return isApprovalLineAllPending(doc.approvalLine);
}

/**
 * 삭제 권한
 * - 진행 중(결재요청·결재중·반려): 기안자 1차 소프트삭제
 * - 결재완료: 사내관리자·기안자·최종결재자만 (수정 불가)
 * - 삭제대기: 동일 권한으로 2차 영구삭제
 */
export function canUserDeleteApprovalDoc(
  doc: ApprovalDoc,
  userId: string,
  ctx: ApprovalPermissionContext = {}
): boolean {
  const uid = String(userId ?? "").trim();
  if (!uid) return false;

  if (doc.deletedAt) {
    return canUserDeleteApprovalDoc({ ...doc, deletedAt: undefined }, userId, ctx);
  }

  if (doc.status === "결재완료") {
    return Boolean(ctx.isCompanyAdmin) || isDrafter(doc, uid) || isFinalApprover(doc, uid);
  }

  if (!isDrafter(doc, uid)) return false;
  return doc.status === "결재요청" || doc.status === "결재중" || doc.status === "반려";
}

export function isApprovalSoftDeleted(doc: ApprovalDoc): boolean {
  return Boolean(doc.deletedAt?.trim());
}

export function computeApprovalStatus(line: ApprovalStep[]): ApprovalStatus {
  if (line.some((s) => s.status === "반려")) return "반려";
  if (line.length > 0 && line.every((s) => s.status === "승인")) return "결재완료";
  const anyApproved = line.some((s) => s.status === "승인");
  return anyApproved ? "결재중" : "결재요청";
}

export function applyApproveStep(
  line: ApprovalStep[],
  userId: string,
  now = new Date().toISOString()
): ApprovalStep[] {
  return line.map((s) =>
    String(s.staffId) === String(userId) && s.status === "대기"
      ? { ...s, status: "승인" as const, signedAt: now }
      : s
  );
}

export function applyRejectStep(
  line: ApprovalStep[],
  userId: string,
  comment?: string,
  now = new Date().toISOString()
): ApprovalStep[] {
  return line.map((s) =>
    String(s.staffId) === String(userId) && s.status === "대기"
      ? { ...s, status: "반려" as const, signedAt: now, comment }
      : s
  );
}

export function applyRevertStep(line: ApprovalStep[], userId: string): ApprovalStep[] {
  return line.map((s) =>
    String(s.staffId) === String(userId)
      ? { ...s, status: "대기" as const, signedAt: undefined, comment: undefined }
      : s
  );
}

function parseApprovalLine(raw: unknown): ApprovalStep[] {
  if (Array.isArray(raw)) return raw as ApprovalStep[];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ApprovalStep[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function approvalDocFromRow(r: Record<string, unknown>): ApprovalDoc {
  const line = parseApprovalLine(r.approval_line);
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    type: (r.doc_type as ApprovalDoc["type"]) ?? "기타",
    status: (r.status as ApprovalStatus) ?? "결재요청",
    caseId: r.case_id ? String(r.case_id) : "",
    caseNumber: String(r.case_number ?? ""),
    requesterId: String(r.requester_id ?? r.requester_login_id ?? ""),
    requesterName: String(r.requester_name ?? ""),
    approvalLine: Array.isArray(line) ? line : [],
    createdAt: String(r.created_at ?? new Date().toISOString()),
    completedAt: r.completed_at ? String(r.completed_at) : undefined,
    amount: r.amount != null ? Number(r.amount) : undefined,
    notes: r.notes ? String(r.notes) : undefined,
    attachmentNames: Array.isArray(r.attachment_names)
      ? (r.attachment_names as string[])
      : undefined,
    referrerNames: Array.isArray(r.referrer_names)
      ? (r.referrer_names as string[])
      : undefined,
    referrerIds: Array.isArray(r.referrer_ids)
      ? (r.referrer_ids as string[]).map(String)
      : undefined,
    metadata:
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as ApprovalMetadata)
        : undefined,
    deletedAt: r.deleted_at ? String(r.deleted_at) : undefined,
  };
}

export function approvalRowFromDoc(
  doc: ApprovalDoc,
  requesterLoginId?: string
): Record<string, unknown> {
  return {
    title: doc.title,
    doc_type: doc.type,
    status: doc.status,
    case_id: doc.caseId || null,
    case_number: doc.caseNumber || null,
    requester_id: doc.requesterId || null,
    requester_login_id: requesterLoginId ?? null,
    requester_name: doc.requesterName,
    amount: doc.amount ?? null,
    notes: doc.notes ?? null,
    approval_line: doc.approvalLine,
    referrer_names: doc.referrerNames ?? [],
    referrer_ids: doc.referrerIds ?? [],
    attachment_names: doc.attachmentNames ?? [],
    metadata: doc.metadata ?? {},
    completed_at: doc.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}
