/** fireauto security-guard 8카테고리 감사 결과 타입 */

export type AuditSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AuditCategoryId =
  | "CAT-1"
  | "CAT-2"
  | "CAT-3"
  | "CAT-4"
  | "CAT-5"
  | "CAT-6"
  | "CAT-7"
  | "CAT-8";

export type AuditFinding = {
  id: string;
  category: AuditCategoryId;
  categoryName: string;
  severity: AuditSeverity;
  title: string;
  location?: string;
  description: string;
  recommendation?: string;
};

export type AuditCategoryResult = {
  id: AuditCategoryId;
  name: string;
  findings: AuditFinding[];
  passed: boolean;
};

export type SecurityAuditReport = {
  projectRoot: string;
  scannedAt: string;
  categories: AuditCategoryResult[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  findings: AuditFinding[];
};

export type SecurityAuditRunRow = {
  id: string;
  triggered_by: string;
  summary: SecurityAuditReport["summary"];
  findings: AuditFinding[];
  report_markdown: string | null;
  created_at: string;
};
