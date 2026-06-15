/**
 * 나의사건검색 보조창 ↔ 부모(사건 목록·모바일 시트) 기일연동 결과 전달
 * - postMessage (팝업 opener)
 * - BroadcastChannel (동일 출처 탭·창 간)
 * - localStorage 이벤트 (모바일 새 탭 복귀 보조)
 */

export const SCOURT_SYNC_MESSAGE_TYPE = "lawygo:scourt-sync" as const;
export const SCOURT_SYNC_CHANNEL_NAME = "lawygo-scourt-sync" as const;
export const SCOURT_SYNC_STORAGE_KEY = "lawygo:scourt-sync:last" as const;

export type ScourtSyncPayload = {
  caseId?: string;
  ok?: boolean;
  error?: string;
  result?: {
    ok?: boolean;
    caseNumber?: string;
    eventsAdded?: number;
    eventsUpdated?: number;
    eventsRemoved?: number;
    skippedNoChange?: boolean;
  };
};

export function publishScourtSync(payload: ScourtSyncPayload): void {
  if (typeof window === "undefined") return;

  const message = { type: SCOURT_SYNC_MESSAGE_TYPE, ...payload, at: Date.now() };

  try {
    window.opener?.postMessage(message, window.location.origin);
  } catch {
    /* ignore */
  }

  try {
    window.parent?.postMessage(message, window.location.origin);
  } catch {
    /* ignore */
  }

  try {
    const channel = new BroadcastChannel(SCOURT_SYNC_CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(SCOURT_SYNC_STORAGE_KEY, JSON.stringify(message));
    localStorage.removeItem(SCOURT_SYNC_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function subscribeScourtSync(
  handler: (payload: ScourtSyncPayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { type?: string } & ScourtSyncPayload;
    if (data?.type !== SCOURT_SYNC_MESSAGE_TYPE) return;
    handler(data);
  };

  window.addEventListener("message", onMessage);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(SCOURT_SYNC_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } & ScourtSyncPayload;
      if (data?.type !== SCOURT_SYNC_MESSAGE_TYPE) return;
      handler(data);
    };
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== SCOURT_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue) as { type?: string } & ScourtSyncPayload;
      if (data?.type !== SCOURT_SYNC_MESSAGE_TYPE) return;
      handler(data);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}
