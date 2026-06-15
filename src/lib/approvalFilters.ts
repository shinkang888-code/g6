/**
 * 나의 전자결재 목록 필터 (LawTop ElectronicApproval 검색·탭)
 */

import type { ApprovalDoc } from "@/lib/types";
import type { ApprovalListTab } from "@/lib/approvalConfig";
import {
  canUserActOnApproval,
  canUserDeleteApprovalDoc,
} from "@/lib/approvalWorkflow";

export type ApprovalFilterContext = {
  isCompanyAdmin?: boolean;
};

function isDrafter(doc: ApprovalDoc, userId: string): boolean {
  return String(doc.requesterId) === String(userId ?? "").trim();
}

/** 삭제대기 문서 — 영구삭제 권한자에게만 목록 노출 */
function canSeeSoftDeletedApproval(
  doc: ApprovalDoc,
  userId: string,
  ctx: ApprovalFilterContext
): boolean {
  return canUserDeleteApprovalDoc(doc, userId, { isCompanyAdmin: ctx.isCompanyAdmin });
}

function isCompletedTabStatus(doc: ApprovalDoc): boolean {
  return doc.status === "결재완료" || doc.status === "반려";
}

export type ApprovalSearchParams = {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  docType?: string;
};

export function isUserReferrer(doc: ApprovalDoc, userId: string, userName: string): boolean {
  const ids = doc.referrerIds ?? [];
  const uid = userId.trim();
  if (uid && ids.some((id) => String(id) === uid)) return true;

  const names = doc.referrerNames ?? [];
  const uname = userName.trim();
  if (!names.length || !uname) return false;
  return names.some((n) => n.trim() === uname);
}

export function hasUserCompletedStep(doc: ApprovalDoc, userId: string): boolean {
  const uid = String(userId ?? "").trim();
  if (!uid) return false;
  return doc.approvalLine.some(
    (s) => String(s.staffId) === uid && (s.status === "승인" || s.status === "반려")
  );
}

export function filterByListTab(
  docs: ApprovalDoc[],
  tab: ApprovalListTab,
  userId: string,
  userName: string,
  ctx: ApprovalFilterContext = {}
): ApprovalDoc[] {
  const uid = String(userId ?? "").trim();

  switch (tab) {
    case "나의작성":
      return docs.filter((d) => isDrafter(d, uid));
    case "미결재":
      return docs.filter(
        (d) =>
          !d.deletedAt &&
          (d.status === "결재요청" || d.status === "결재중") &&
          canUserActOnApproval(d.approvalLine, uid, d.status)
      );
    case "기결재":
      return docs.filter((d) => !d.deletedAt && hasUserCompletedStep(d, uid));
    case "참조협조":
      return docs.filter((d) => !d.deletedAt && isUserReferrer(d, uid, userName));
    case "결재중":
      return docs.filter(
        (d) =>
          (!d.deletedAt && (d.status === "결재중" || d.status === "결재요청")) ||
          (d.deletedAt &&
            (d.status === "결재요청" || d.status === "결재중") &&
            isDrafter(d, uid))
      );
    case "완료":
      return docs.filter((d) => {
        if (!isCompletedTabStatus(d)) return false;
        if (!d.deletedAt) return true;
        return canSeeSoftDeletedApproval(d, uid, ctx);
      });
    default:
      return docs.filter((d) => {
        if (!d.deletedAt) return true;
        return canSeeSoftDeletedApproval(d, uid, ctx);
      });
  }
}

export function filterBySearch(docs: ApprovalDoc[], params: ApprovalSearchParams): ApprovalDoc[] {
  let out = docs;
  const q = params.q?.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.caseNumber.toLowerCase().includes(q) ||
        d.requesterName.toLowerCase().includes(q) ||
        (d.notes ?? "").toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q)
    );
  }
  if (params.docType && params.docType !== "전체") {
    out = out.filter((d) => d.type === params.docType);
  }
  if (params.dateFrom) {
    const from = params.dateFrom.slice(0, 10);
    out = out.filter((d) => d.createdAt.slice(0, 10) >= from);
  }
  if (params.dateTo) {
    const to = params.dateTo.slice(0, 10);
    out = out.filter((d) => d.createdAt.slice(0, 10) <= to);
  }
  return out;
}

export function countByTab(
  docs: ApprovalDoc[],
  userId: string,
  userName: string,
  ctx: ApprovalFilterContext = {}
): Record<ApprovalListTab, number> {
  const tabs: ApprovalListTab[] = [
    "전체",
    "나의작성",
    "미결재",
    "기결재",
    "참조협조",
    "결재중",
    "완료",
  ];
  return Object.fromEntries(
    tabs.map((tab) => [tab, filterByListTab(docs, tab, userId, userName, ctx).length])
  ) as Record<ApprovalListTab, number>;
}
