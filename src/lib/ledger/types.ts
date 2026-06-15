export type LedgerStream =
  | "case_audit"
  | "approval"
  | "user_admin"
  | "finance"
  | "security"
  | "identity";

export type LedgerTxStatus = "pending" | "chained" | "block_assigned" | "tampered";

export const LEDGER_STREAM_LABELS: Record<LedgerStream, string> = {
  case_audit: "사건 감사",
  approval: "전자결재",
  user_admin: "회원·권한",
  finance: "재무",
  security: "보안",
  identity: "신원 확인",
};

export interface LedgerEnqueueInput {
  tenantId: string;
  stream: LedgerStream;
  sourceTable: string;
  sourceId?: string | null;
  transData: Record<string, unknown>;
  hVId: string;
  actorUserId?: string;
  actorLoginId?: string;
}

export interface LedgerOverviewStats {
  enabled: boolean;
  identityCount: number;
  txPending: number;
  txChained: number;
  txBlockAssigned: number;
  txTampered: number;
  blockCount: number;
  anchorCount: number;
  alertOpen: number;
  lastBlockAt: string | null;
  lastAnchorAt: string | null;
  streams: { stream: string; pending: number; chained: number; blocks: number }[];
  health: "healthy" | "degraded" | "critical" | "disabled";
  healthMessage: string;
}
