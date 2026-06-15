/** 결재선 단계 (결재자1~4) */
export const APPROVER_ORDERS = [1, 2, 3, 4] as const;

export type ApproverOrder = (typeof APPROVER_ORDERS)[number];

/** 결재선 UI 라벨 — REVIEWER → 결재자 */
export function getApproverLabel(order: number): string {
  return `결재자${order} (${order}차)`;
}

/** 1차 결재자만 필수, 2~4차는 선택 */
export function isRequiredApproverOrder(order: number): boolean {
  return order === 1;
}

export function getApproverRoleHint(order: number): "필수결재자" | "선택결재자" {
  return isRequiredApproverOrder(order) ? "필수결재자" : "선택결재자";
}
