/** 사건 감사 로그 — 클라이언트·서버 공용 타입·라벨 */

export type CaseAuditAction =
  | "create"
  | "update"
  | "delete"
  | "bulk_status"
  | "bulk_import"
  | "institutions_update"
  | "parties_update";

export const CASE_AUDIT_ACTION_LABELS: Record<CaseAuditAction, string> = {
  create: "등록",
  update: "수정",
  delete: "삭제",
  bulk_status: "일괄상태변경",
  bulk_import: "엑셀등록",
  institutions_update: "계속기관변경",
  parties_update: "당사자변경",
};

export const CASE_FIELD_LABELS: Record<string, string> = {
  case_number: "사건번호",
  case_type: "사건종류",
  case_name: "사건명",
  court: "계속기관",
  client_name: "의뢰인",
  client_position: "의뢰인 지위",
  opponent_name: "상대방",
  status: "진행상태",
  assigned_staff_name: "담당 변호사",
  assistants: "보조",
  received_date: "수임일",
  registered_date: "등록일",
  created_by_name: "등록인",
  amount: "수임료",
  is_electronic: "전자사건",
  is_urgent: "긴급",
  is_immutable_deadline: "기일고정",
  notes: "비고",
  court_division: "재판부·연락처",
  trial_level: "심급",
  management_key: "관리키",
  active_stage: "현재 진행단계",
};

export type CaseAuditChange = { from: unknown; to: unknown };

export type CaseAuditLog = {
  id: string;
  caseId: string | null;
  caseNumber: string;
  clientName: string;
  action: CaseAuditAction;
  actorId: string | null;
  actorName: string;
  actorLoginId: string | null;
  summary: string;
  changes: Record<string, CaseAuditChange>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};
