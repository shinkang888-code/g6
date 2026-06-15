import type { InternalMessage } from "./types";

export function messageFromRow(r: Record<string, unknown>): InternalMessage {
  return {
    id: String(r.id),
    senderId: String(r.sender_id ?? ""),
    senderName: String(r.sender_name ?? ""),
    recipientId: String(r.recipient_id ?? ""),
    recipientName: String(r.recipient_name ?? ""),
    recipientLoginId: r.recipient_login_id ? String(r.recipient_login_id) : undefined,
    body: String(r.body ?? ""),
    attachmentNames: Array.isArray(r.attachment_names)
      ? (r.attachment_names as string[])
      : [],
    attachmentData: Array.isArray(r.attachment_data)
      ? (r.attachment_data as { name: string; data: string }[])
      : undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    readAt: r.read_at ? String(r.read_at) : undefined,
  };
}

export function threadKeyForUsers(a: string, b: string): string {
  return [String(a), String(b)].sort().join(":");
}
