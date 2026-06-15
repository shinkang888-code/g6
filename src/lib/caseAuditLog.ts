/**
 * 사건 변경 감사 로그 — 서버 전용 기록·조회
 */

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession, type SessionPayload } from "@/lib/authSession";
import {
  CASE_AUDIT_ACTION_LABELS,
  CASE_FIELD_LABELS,
  type CaseAuditAction,
  type CaseAuditChange,
  type CaseAuditLog,
} from "@/lib/caseAuditLogShared";
import { recordLedgerEvent } from "@/lib/ledger/ledgerRecord";

export type { CaseAuditAction, CaseAuditChange, CaseAuditLog };
export { CASE_AUDIT_ACTION_LABELS, CASE_FIELD_LABELS };

export type InsertCaseAuditInput = {
  caseId?: string | null;
  caseNumber?: string;
  clientName?: string;
  action: CaseAuditAction;
  summary?: string;
  changes?: Record<string, CaseAuditChange>;
  session?: SessionPayload | null;
  request?: NextRequest;
};

function auditFromRow(r: Record<string, unknown>): CaseAuditLog {
  return {
    id: String(r.id ?? ""),
    caseId: r.case_id ? String(r.case_id) : null,
    caseNumber: String(r.case_number ?? ""),
    clientName: String(r.client_name ?? ""),
    action: r.action as CaseAuditAction,
    actorId: r.actor_id ? String(r.actor_id) : null,
    actorName: String(r.actor_name ?? "알 수 없음"),
    actorLoginId: r.actor_login_id ? String(r.actor_login_id) : null,
    summary: String(r.summary ?? ""),
    changes: (r.changes as Record<string, CaseAuditChange>) ?? {},
    ipAddress: r.ip_address ? String(r.ip_address) : null,
    userAgent: r.user_agent ? String(r.user_agent) : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

export function getRequestMeta(request?: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  if (!request) return { ipAddress: null, userAgent: null };
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return {
    ipAddress: ip ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

export async function resolveAuditActor(
  session?: SessionPayload | null
): Promise<SessionPayload | null> {
  if (session) return session;
  return getSession();
}

export function diffCaseRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys?: string[]
): Record<string, CaseAuditChange> {
  const fields =
    keys ??
    Object.keys(CASE_FIELD_LABELS).filter(
      (k) => before[k] !== undefined || after[k] !== undefined
    );
  const changes: Record<string, CaseAuditChange> = {};
  for (const key of fields) {
    const fromVal = before[key];
    const toVal = after[key];
    const fromStr = normalizeAuditValue(fromVal);
    const toStr = normalizeAuditValue(toVal);
    if (fromStr !== toStr) {
      changes[key] = { from: fromVal ?? null, to: toVal ?? null };
    }
  }
  return changes;
}

function normalizeAuditValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Y" : "N";
  return String(v).trim();
}

export function formatChangesSummary(changes: Record<string, CaseAuditChange>): string {
  const parts = Object.entries(changes).map(([key, ch]) => {
    const label = CASE_FIELD_LABELS[key] ?? key;
    return `${label}: ${normalizeAuditValue(ch.from) || "(없음)"} → ${normalizeAuditValue(ch.to) || "(없음)"}`;
  });
  return parts.join(" | ");
}

export async function insertCaseAuditLog(
  db: SupabaseClient,
  input: InsertCaseAuditInput
): Promise<void> {
  try {
    const session = await resolveAuditActor(input.session);
    const { ipAddress, userAgent } = getRequestMeta(input.request);
    const changes = input.changes ?? {};
    const summary =
      input.summary?.trim() ||
      (Object.keys(changes).length > 0
        ? formatChangesSummary(changes)
        : CASE_AUDIT_ACTION_LABELS[input.action]);

    const row = {
      case_id: input.caseId ?? null,
      case_number: input.caseNumber?.trim() || null,
      client_name: input.clientName?.trim() || null,
      action: input.action,
      actor_id: session?.userId ?? null,
      actor_name: session?.name ?? session?.loginId ?? "알 수 없음",
      actor_login_id: session?.loginId ?? null,
      summary: summary.slice(0, 2000),
      changes,
      ip_address: ipAddress,
      user_agent: userAgent?.slice(0, 500) ?? null,
    };

    const { data: inserted, error } = await db
      .from("case_audit_logs")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("[case_audit_log]", error.message);
      return;
    }

    const tenantId = session?.managementNumber?.trim();
    if (tenantId && inserted?.id) {
      await recordLedgerEvent(db, {
        tenantId,
        stream: "case_audit",
        sourceTable: "case_audit_logs",
        sourceId: String(inserted.id),
        session,
        transData: {
          action: input.action,
          caseId: input.caseId ?? null,
          caseNumber: input.caseNumber,
          clientName: input.clientName,
          summary,
          changes,
          actorName: row.actor_name,
        },
      });
    }
  } catch (e) {
    console.error("[case_audit_log]", e);
  }
}

export async function fetchCaseSnapshot(
  db: SupabaseClient,
  caseId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export type CaseAuditListParams = {
  q?: string;
  caseNumber?: string;
  clientName?: string;
  action?: string;
  actorLoginId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export async function listCaseAuditLogs(
  db: SupabaseClient,
  params: CaseAuditListParams
): Promise<{ data: CaseAuditLog[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 30));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  let query = db
    .from("case_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  const q = params.q?.trim();
  if (q) {
    query = query.or(
      `case_number.ilike.%${q}%,client_name.ilike.%${q}%,actor_name.ilike.%${q}%,actor_login_id.ilike.%${q}%,summary.ilike.%${q}%`
    );
  }
  if (params.caseNumber?.trim()) {
    query = query.ilike("case_number", `%${params.caseNumber.trim()}%`);
  }
  if (params.clientName?.trim()) {
    query = query.ilike("client_name", `%${params.clientName.trim()}%`);
  }
  if (params.action?.trim()) {
    query = query.eq("action", params.action.trim());
  }
  if (params.actorLoginId?.trim()) {
    query = query.ilike("actor_login_id", `%${params.actorLoginId.trim()}%`);
  }
  if (params.from?.trim()) {
    query = query.gte("created_at", `${params.from.trim()}T00:00:00`);
  }
  if (params.to?.trim()) {
    query = query.lte("created_at", `${params.to.trim()}T23:59:59`);
  }

  const { data, error, count } = await query.range(fromIdx, toIdx);
  if (error) throw new Error(error.message);

  return {
    data: (data ?? []).map((r) => auditFromRow(r as Record<string, unknown>)),
    total: typeof count === "number" ? count : (data ?? []).length,
    page,
    pageSize,
  };
}
