/**
 * LawBoard Phase 3 — LawTopMail 대체 메일함 (Supabase mail_messages)
 */

import { getSupabaseAdmin } from "@/lib/supabaseClient";

export type MailDirection = "inbound" | "outbound";
export type MailStatus = "draft" | "sent" | "received" | "failed";

export interface MailMessage {
  id: string;
  direction: MailDirection;
  fromAddress: string;
  toAddress: string;
  subject: string;
  bodyText?: string;
  status: MailStatus;
  isRead: boolean;
  caseId?: string;
  clientId?: string;
  receivedAt?: string;
  sentAt?: string;
  createdAt: string;
}

function fromRow(row: Record<string, unknown>): MailMessage {
  return {
    id: String(row.id),
    direction: (row.direction as MailDirection) ?? "inbound",
    fromAddress: String(row.from_address ?? ""),
    toAddress: String(row.to_address ?? ""),
    subject: String(row.subject ?? ""),
    bodyText: row.body_text ? String(row.body_text) : undefined,
    status: (row.status as MailStatus) ?? "received",
    isRead: Boolean(row.is_read),
    caseId: row.case_id ? String(row.case_id) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    receivedAt: row.received_at ? String(row.received_at) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    createdAt: String(row.created_at),
  };
}

async function useDb(): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("mail_messages").select("id").limit(1);
  return !error;
}

export async function listMailMessages(options?: {
  direction?: MailDirection;
  managementNumber?: string;
  limit?: number;
}): Promise<MailMessage[]> {
  if (!(await useDb())) return [];
  const db = getSupabaseAdmin()!;
  let query = db
    .from("mail_messages")
    .select("*")
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(options?.limit ?? 50);

  if (options?.direction) query = query.eq("direction", options.direction);
  if (options?.managementNumber) query = query.eq("management_number", options.managementNumber);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
}

export async function getMailMessage(id: string): Promise<MailMessage | null> {
  if (!(await useDb())) return null;
  const db = getSupabaseAdmin()!;
  const { data, error } = await db.from("mail_messages").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data as Record<string, unknown>) : null;
}

export async function createMailMessage(input: {
  direction: MailDirection;
  fromAddress: string;
  toAddress: string;
  subject: string;
  bodyText?: string;
  status?: MailStatus;
  managementNumber?: string;
  caseId?: string;
  clientId?: string;
}): Promise<MailMessage> {
  if (!(await useDb())) throw new Error("Supabase가 설정되지 않았습니다.");
  const now = new Date().toISOString();
  const db = getSupabaseAdmin()!;
  const { data, error } = await db
    .from("mail_messages")
    .insert({
      direction: input.direction,
      from_address: input.fromAddress.trim(),
      to_address: input.toAddress.trim(),
      subject: input.subject.trim(),
      body_text: input.bodyText?.trim() || null,
      status: input.status ?? (input.direction === "outbound" ? "draft" : "received"),
      management_number: input.managementNumber ?? null,
      case_id: input.caseId ?? null,
      client_id: input.clientId ?? null,
      sent_at: input.direction === "outbound" ? now : null,
      received_at: input.direction === "inbound" ? now : null,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as Record<string, unknown>);
}

export async function markMailRead(id: string): Promise<boolean> {
  if (!(await useDb())) return false;
  const db = getSupabaseAdmin()!;
  const { error } = await db
    .from("mail_messages")
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}
