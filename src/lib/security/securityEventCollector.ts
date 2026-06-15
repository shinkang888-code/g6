/**
 * 보안 이벤트 수집·저장 (Enterprise_Log_Monitoring SecurityLogRepository.save)
 */

import { getSupabaseAdmin } from "@/lib/supabaseClient";
import type { LogSecurityEventInput, SecurityEventRow, AttackTypeStat } from "./securityEventTypes";

export async function logSecurityEvent(input: LogSecurityEventInput): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) {
    console.error("[security_event] Supabase admin unavailable");
    return;
  }

  const { error } = await db.from("security_events").insert({
    tenant_id: input.tenantId ?? null,
    ip_address: input.ipAddress,
    user_agent: input.userAgent ?? null,
    attack_type: input.attackType,
    severity_level: input.severityLevel,
    status: input.status ?? "MONITORED",
    source: input.source ?? "api",
    route_path: input.routePath ?? null,
    actor_login_id: input.actorLoginId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("[security_event]", error.message);
  }
}

/** Enterprise scanMyPc / analyzeAndSaveLog — 요청 헤더 분석 후 저장 */
export async function analyzeAndLogRequest(
  request: Request,
  options?: {
    tenantId?: string;
    actorLoginId?: string;
    routePath?: string;
    source?: LogSecurityEventInput["source"];
  }
): Promise<SecurityEventRow | null> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent");

  const { analyzeHttpThreat } = await import("./threatAnalyzer");
  const threat = analyzeHttpThreat(userAgent);

  await logSecurityEvent({
    ipAddress: ip,
    userAgent,
    attackType: threat.attackType,
    severityLevel: threat.severityLevel,
    status: threat.status,
    source: options?.source ?? "scan",
    routePath: options?.routePath ?? new URL(request.url).pathname,
    actorLoginId: options?.actorLoginId,
    tenantId: options?.tenantId,
  });

  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data } = await db
    .from("security_events")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as SecurityEventRow | null) ?? null;
}

export async function listSecurityEvents(params: {
  page?: number;
  pageSize?: number;
  severity?: string;
  status?: string;
  attackType?: string;
  source?: string;
  ip?: string;
  routePath?: string;
  actorLoginId?: string;
  search?: string;
  unresolved?: boolean;
  from?: string;
  to?: string;
}): Promise<{ data: SecurityEventRow[]; total: number }> {
  const db = getSupabaseAdmin();
  if (!db) return { data: [], total: 0 };

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 30));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  let query = db.from("security_events").select("*", { count: "exact" });

  if (params.severity) query = query.eq("severity_level", params.severity);
  if (params.unresolved) query = query.neq("status", "RESOLVED");
  else if (params.status) query = query.eq("status", params.status);
  if (params.source) query = query.eq("source", params.source);
  if (params.attackType) query = query.ilike("attack_type", `%${params.attackType}%`);
  if (params.ip) query = query.ilike("ip_address", `%${params.ip}%`);
  if (params.routePath) query = query.ilike("route_path", `%${params.routePath}%`);
  if (params.actorLoginId) query = query.ilike("actor_login_id", `%${params.actorLoginId}%`);
  if (params.from) query = query.gte("detected_at", params.from);
  if (params.to) query = query.lte("detected_at", params.to);
  if (params.search?.trim()) {
    const q = params.search.trim().replace(/[%_]/g, "");
    if (q) {
      query = query.or(
        `attack_type.ilike.%${q}%,route_path.ilike.%${q}%,ip_address.ilike.%${q}%,actor_login_id.ilike.%${q}%`
      );
    }
  }

  const { data, count, error } = await query
    .order("detected_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as SecurityEventRow[], total: count ?? 0 };
}

/** Enterprise SecurityLogRepository.countByAttackType */
export async function getAttackTypeStats(): Promise<AttackTypeStat[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db.from("security_events").select("attack_type");
  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data as { attack_type: string }[]) {
    counts.set(row.attack_type, (counts.get(row.attack_type) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([attackType, count]) => ({ attackType, count }))
    .sort((a, b) => b.count - a.count);
}

export type SecuritySummary = {
  total: number;
  last24h: number;
  last7d: number;
  unresolved: number;
  bySource: { source: string; count: number }[];
  topIps: { ip: string; count: number }[];
  severityCounts: Record<string, number>;
};

export async function getSecuritySummary(): Promise<SecuritySummary> {
  const empty: SecuritySummary = {
    total: 0,
    last24h: 0,
    last7d: 0,
    unresolved: 0,
    bySource: [],
    topIps: [],
    severityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  };

  const db = getSupabaseAdmin();
  if (!db) return empty;

  const now = Date.now();
  const iso24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const iso7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await db
    .from("security_events")
    .select("detected_at, status, source, ip_address, severity_level");

  if (error || !rows) return empty;

  const sourceMap = new Map<string, number>();
  const ipMap = new Map<string, number>();
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let last24h = 0;
  let last7d = 0;
  let unresolved = 0;

  for (const row of rows as {
    detected_at: string;
    status: string;
    source: string;
    ip_address: string;
    severity_level: keyof typeof severityCounts;
  }[]) {
    const t = new Date(row.detected_at).getTime();
    if (t >= now - 24 * 60 * 60 * 1000) last24h += 1;
    if (t >= now - 7 * 24 * 60 * 60 * 1000) last7d += 1;
    if (row.status !== "RESOLVED") unresolved += 1;
    sourceMap.set(row.source, (sourceMap.get(row.source) ?? 0) + 1);
    ipMap.set(row.ip_address, (ipMap.get(row.ip_address) ?? 0) + 1);
    if (row.severity_level in severityCounts) severityCounts[row.severity_level] += 1;
  }

  return {
    total: rows.length,
    last24h,
    last7d,
    unresolved,
    bySource: [...sourceMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    topIps: [...ipMap.entries()]
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    severityCounts,
  };
}

export async function updateSecurityEventStatus(
  id: string,
  status: SecurityEventRow["status"]
): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("security_events").update({ status }).eq("id", id);
  return !error;
}
