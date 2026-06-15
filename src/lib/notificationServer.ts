import type { Notification } from "./types";

export function notificationFromRow(r: Record<string, unknown>): Notification {
  const meta = (r.metadata as Record<string, unknown> | null) ?? {};
  return {
    id: String(r.id),
    type: (r.type as Notification["type"]) ?? "memo",
    title: String(r.title ?? ""),
    message: String(r.message ?? ""),
    isRead: Boolean(r.is_read),
    caseId: r.case_id ? String(r.case_id) : undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    link: r.link ? String(r.link) : undefined,
    approvalDocId: r.approval_id
      ? String(r.approval_id)
      : meta.approvalDocId
        ? String(meta.approvalDocId)
        : undefined,
  };
}

export async function createNotification(
  db: ReturnType<typeof import("@/lib/supabaseClient").getSupabaseAdmin>,
  input: {
    userId?: string | null;
    recipientLoginId?: string | null;
    type: Notification["type"];
    title: string;
    message: string;
    link?: string;
    approvalId?: string;
    caseId?: string;
    managementNumber?: string | null;
  }
) {
  if (!db) return null;
  const { data, error } = await db
    .from("notifications")
    .insert({
      user_id: input.userId || null,
      recipient_login_id: input.recipientLoginId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      approval_id: input.approvalId ?? null,
      case_id: input.caseId ?? null,
      management_number: input.managementNumber ?? null,
      is_read: false,
      metadata: input.approvalId ? { approvalDocId: input.approvalId } : null,
    })
    .select("id")
    .single();
  if (error) return null;
  return data;
}
