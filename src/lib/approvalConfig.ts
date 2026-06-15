/**
 * LawTop GL ElectronicApproval 대응 — 문서 유형·목록 탭 정의
 */

import type { ApprovalDoc } from "@/lib/types";

/** LawTop 기안 팝업 문서 유형 */
export const LAWTOP_DRAFT_TYPES = [
  { value: "기안서", label: "기안서", description: "일반 기안·보고" },
  { value: "지급품의서", label: "지급품의서", description: "지급·비용 품의" },
  { value: "청구서", label: "청구서", description: "수임료·청구 결재" },
  { value: "근태행선지", label: "근태행선지", description: "출장·휴가·행선 신고" },
] as const;

export const LEGACY_APPROVAL_TYPES = ["청구서", "보고서", "위임장", "계약서", "기타"] as const;

export type LawtopDraftType = (typeof LAWTOP_DRAFT_TYPES)[number]["value"];

/** 나의 전자결재 목록 탭 (LawTop 라디오 필터) */
export type ApprovalListTab =
  | "전체"
  | "나의작성"
  | "미결재"
  | "기결재"
  | "참조협조"
  | "결재중"
  | "완료";

export const APPROVAL_LIST_TABS: { value: ApprovalListTab; label: string; lawtopLabel?: string }[] = [
  { value: "전체", label: "전체", lawtopLabel: "모두" },
  { value: "나의작성", label: "나의작성", lawtopLabel: "나의작성" },
  { value: "미결재", label: "미결재", lawtopLabel: "미결재" },
  { value: "기결재", label: "기결재", lawtopLabel: "기결재" },
  { value: "참조협조", label: "참조/협조", lawtopLabel: "참조/협조" },
  { value: "결재중", label: "결재중" },
  { value: "완료", label: "완료" },
];

export const APPROVAL_DOC_TYPE_OPTIONS = [
  ...LAWTOP_DRAFT_TYPES.map((t) => ({ value: t.value, label: t.label })),
  ...LEGACY_APPROVAL_TYPES.map((v) => ({ value: v, label: v })),
];

export function defaultTitleForType(type: ApprovalDoc["type"]): string {
  const today = new Date().toLocaleDateString("ko-KR");
  return `${type} · ${today}`;
}

export function buildNotesWithMetadata(
  type: ApprovalDoc["type"],
  content: string,
  meta: ApprovalDoc["metadata"]
): string {
  const lines: string[] = [];
  if (content.trim()) lines.push(content.trim());

  if (type === "지급품의서") {
    if (meta?.paymentPurpose) lines.push(`[지급목적] ${meta.paymentPurpose}`);
    if (meta?.payee) lines.push(`[지급대상] ${meta.payee}`);
  }
  if (type === "근태행선지") {
    if (meta?.leaveType) lines.push(`[구분] ${meta.leaveType}`);
    if (meta?.travelFrom || meta?.travelTo) {
      lines.push(`[기간] ${meta.travelFrom ?? ""} ~ ${meta.travelTo ?? ""}`.trim());
    }
    if (meta?.destination) lines.push(`[행선지] ${meta.destination}`);
  }

  return lines.join("\n\n");
}
