/**
 * 사내 메신저 클라이언트 API (LawTop MessageSend/Receive 대응)
 */

import type { InternalMessage } from "./types";

export async function fetchInternalMessages(
  box: "all" | "sent" | "received" | "thread" = "all",
  withUser?: string
): Promise<{ data: InternalMessage[]; unreadCount: number }> {
  const params = new URLSearchParams({ box });
  if (withUser) params.set("with", withUser);
  const res = await fetch(`/api/internal-messages?${params}`, { credentials: "include" });
  const json = (await res.json()) as {
    data?: InternalMessage[];
    unreadCount?: number;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? "메시지 조회 실패");
  return { data: json.data ?? [], unreadCount: json.unreadCount ?? 0 };
}

export async function sendInternalMessage(
  input: {
    body: string;
    attachmentNames?: string[];
    attachmentData?: { name: string; data: string }[];
  } & (
    | {
        recipientId: string;
        recipientName: string;
        recipientLoginId?: string;
        recipients?: never;
      }
    | {
        recipients: Array<{
          recipientId: string;
          recipientName: string;
          recipientLoginId?: string;
        }>;
        recipientId?: never;
        recipientName?: never;
      }
  )
): Promise<InternalMessage[]> {
  const res = await fetch("/api/internal-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as { data?: InternalMessage[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? "전송 실패");
  return json.data ?? [];
}

export async function markMessageRead(id: string): Promise<void> {
  const res = await fetch(`/api/internal-messages/${id}`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) {
    const json = (await res.json()) as { error?: string };
    throw new Error(json.error ?? "읽음 처리 실패");
  }
}
