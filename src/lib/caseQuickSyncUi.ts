export type QuickSyncPreview = {
  eventsTotal?: number;
  eventsAdded?: number;
  eventsUpdated?: number;
  courtDivision?: string;
  receivedDate?: string;
  syncedCaseName?: string;
};

export function formatQuickSyncDetail(link: QuickSyncPreview): string {
  const added = Number(link.eventsAdded ?? 0);
  const updated = Number(link.eventsUpdated ?? 0);
  const total = Number(link.eventsTotal ?? 0);
  const parts: string[] = [];

  if (added > 0) parts.push(`추가 ${added}`);
  if (updated > 0) parts.push(`수정 ${updated}`);
  if (parts.length) return parts.join(", ");

  if (total > 0) return `기일 ${total}건 반영`;
  if (link.courtDivision || link.receivedDate) {
    const meta = [link.receivedDate ? `접수 ${link.receivedDate}` : "", link.courtDivision ?? ""]
      .filter(Boolean)
      .join(" · ");
    return meta ? `법원 기일 없음 (${meta})` : "법원에 등록된 기일 없음";
  }
  return "법원에 등록된 기일 없음";
}

export const QUICK_LOADING_LABELS = {
  saving: "사건 저장 중…",
  polling: "법원 나의사건검색 조회 중…",
  applying: "기일·재판부 반영 중…",
} as const;

export type QuickLoadingStage = keyof typeof QUICK_LOADING_LABELS | null;
