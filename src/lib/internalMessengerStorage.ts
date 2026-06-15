/**
 * 사내 메신저 메시지 저장소 (직원 간 문자·첨부 송수신)
 * localStorage 키: lawygo_internal_messages
 */

import type { InternalMessage } from "@/lib/types";

const STORAGE_KEY = "lawygo_internal_messages";

function loadRaw(): InternalMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRaw(items: InternalMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** id 비교 시 문자열로 통일 (API/DB 타입 불일치 방지) */
function sameId(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  return String(a ?? "") === String(b ?? "");
}

/** 내가 보낸 메시지 목록 (최신순) */
export function loadSentMessages(senderId: string): InternalMessage[] {
  const sid = String(senderId ?? "").trim();
  if (!sid) return [];
  return loadRaw()
    .filter((m) => sameId(m.senderId, sid))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** 내가 받은 메시지 목록 (최신순) - recipientId 또는 recipientLoginId로 매칭 */
export function loadReceivedMessages(recipientId: string, recipientLoginId?: string): InternalMessage[] {
  const rid = String(recipientId ?? "").trim();
  const rLoginId = String(recipientLoginId ?? "").trim().toLowerCase();
  return loadRaw()
    .filter((m) => {
      if (rid && sameId(m.recipientId, rid)) return true;
      if (rLoginId && sameId((m as InternalMessage & { recipientLoginId?: string }).recipientLoginId, rLoginId)) return true;
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** 메시지 저장 (발송) - senderId/recipientId 문자열로 저장, recipientLoginId 있으면 저장 */
export function saveMessage(message: Omit<InternalMessage, "id" | "createdAt">): InternalMessage {
  const raw = loadRaw();
  const now = new Date().toISOString();
  const newMsg: InternalMessage = {
    ...message,
    senderId: String(message.senderId ?? ""),
    recipientId: String(message.recipientId ?? ""),
    recipientLoginId: message.recipientLoginId != null ? String(message.recipientLoginId).trim().toLowerCase() : undefined,
    id: `im-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
  };
  saveRaw([...raw, newMsg]);
  return newMsg;
}

/** 수신 메시지 읽음 처리 */
export function markAsRead(messageId: string): void {
  const raw = loadRaw();
  const now = new Date().toISOString();
  saveRaw(
    raw.map((m) => (m.id === messageId ? { ...m, readAt: m.readAt ?? now } : m))
  );
}

/** id로 메시지 조회 */
export function getMessageById(id: string): InternalMessage | undefined {
  return loadRaw().find((m) => m.id === id);
}

/** 두 사용자 간 1:1 스레드 메시지 (채팅창용, 시간순) */
export function getThreadMessages(myId: string, otherId: string): InternalMessage[] {
  const me = String(myId ?? "").trim();
  const other = String(otherId ?? "").trim();
  if (!me || !other) return [];
  return loadRaw()
    .filter(
      (m) =>
        (sameId(m.senderId, me) && sameId(m.recipientId, other)) ||
        (sameId(m.senderId, other) && sameId(m.recipientId, me))
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
