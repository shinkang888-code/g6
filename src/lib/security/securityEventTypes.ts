/** Enterprise_Log_Monitoring SecurityLog 필드 + LawyGo 확장 */

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type SecurityEventStatus = "MONITORED" | "WARNING" | "BLOCKED" | "RESOLVED";

export type SecurityEventSource = "api" | "auth" | "upload" | "ai" | "admin" | "rule" | "scan";

export type SecurityEventRow = {
  id: string;
  tenant_id: string | null;
  ip_address: string;
  user_agent: string | null;
  attack_type: string;
  severity_level: SecuritySeverity;
  status: SecurityEventStatus;
  source: SecurityEventSource;
  route_path: string | null;
  actor_login_id: string | null;
  metadata: Record<string, unknown> | null;
  detected_at: string;
};

export type LogSecurityEventInput = {
  ipAddress: string;
  userAgent?: string | null;
  attackType: string;
  severityLevel: SecuritySeverity;
  status?: SecurityEventStatus;
  source?: SecurityEventSource;
  routePath?: string | null;
  actorLoginId?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AttackTypeStat = {
  attackType: string;
  count: number;
};
