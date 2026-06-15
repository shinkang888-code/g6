import type { NoticeRecord } from "@/lib/noticeService";
import type { NoticeItem } from "@/lib/types";

type ApiJson<T> = { success?: boolean; data?: T; total?: number; error?: string };

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiJson<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "요청에 실패했습니다.");
  }
  return json.data as T;
}

/** Supabase NoticeRecord → UI NoticeItem */
export function noticeRecordToItem(n: NoticeRecord): NoticeItem {
  const attachments = (n as NoticeRecord & { attachments?: { name: string; data: string }[] }).attachments;
  return {
    id: String(n.numId),
    title: n.title,
    content: n.content,
    authorName: n.authorName,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    deletedAt: n.deletedAt ?? undefined,
    attachmentNames: attachments?.map((a) => a.name),
    attachmentData: attachments,
  };
}

export async function fetchNotices(options?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: NoticeRecord[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.q?.trim()) params.set("q", options.q.trim());
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("page_size", String(options.pageSize));

  const res = await fetch(`/api/notices?${params.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ApiJson<NoticeRecord[]>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "공지 목록을 불러올 수 없습니다.");
  }
  return {
    items: Array.isArray(json.data) ? json.data : [],
    total: typeof json.total === "number" ? json.total : 0,
  };
}

export async function fetchNoticeById(numId: string): Promise<NoticeItem> {
  const res = await fetch(`/api/notices/${numId}`, { credentials: "include" });
  const record = await parseJson<NoticeRecord>(res);
  return noticeRecordToItem(record);
}

export async function createNoticeApi(input: {
  title: string;
  content: string;
  authorName: string;
  attachments?: { name: string; data: string }[];
}): Promise<NoticeItem> {
  const res = await fetch("/api/notices", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const record = await parseJson<NoticeRecord>(res);
  return noticeRecordToItem(record);
}

export async function updateNoticeApi(
  numId: string,
  input: {
    title?: string;
    content?: string;
    authorName?: string;
    attachments?: { name: string; data: string }[];
  }
): Promise<NoticeItem> {
  const res = await fetch(`/api/notices/${numId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const record = await parseJson<NoticeRecord>(res);
  return noticeRecordToItem(record);
}

export async function deleteNoticeApi(numId: string): Promise<void> {
  const res = await fetch(`/api/notices/${numId}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJson<{ ok: boolean }>(res);
}
