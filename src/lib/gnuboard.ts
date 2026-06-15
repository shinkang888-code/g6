/**
 * 그누보드 6 REST API v1 연동 유틸리티
 * G6 엔드포인트: /api/v1/boards/{bo_table}/writes
 */

import { getG6AccessToken } from "./gnuboardAuth";
import { getG6ApiV1Base, isG6Configured, resolveG6BoardId } from "./gnuboardConfig";

export interface GnuboardPost {
  wr_id: number;
  wr_subject: string;
  wr_content: string;
  wr_name: string;
  wr_datetime: string;
  wr_last: string;
  wr_hit: number;
  wr_comment: number;
  wr_good?: number;
  wr_option?: string;
  ca_name?: string;
  wr_1?: string;
  wr_2?: string;
  wr_3?: string;
  wr_4?: string;
  wr_5?: string;
  files?: GnuboardFile[];
}

export interface GnuboardFile {
  bf_id: number;
  bf_source: string;
  bf_file: string;
  bf_filesize: number;
  bf_content_type: string;
  bf_download: number;
}

export interface GnuboardComment {
  wr_id: number;
  wr_parent: number;
  co_content: string;
  co_name: string;
  co_datetime: string;
  save_content?: string;
}

export interface GnuboardResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
  page?: number;
  per_page?: number;
}

interface G6ListResponse {
  writes?: GnuboardPost[];
  notice_writes?: GnuboardPost[];
  total_records?: number;
  current_page?: number;
}

interface G6WriteResponse extends GnuboardPost {
  comments?: GnuboardComment[];
}

function normalizePost(raw: Partial<GnuboardPost>): GnuboardPost {
  const dt = String(raw.wr_datetime ?? "");
  return {
    wr_id: Number(raw.wr_id ?? 0),
    wr_subject: String(raw.wr_subject ?? ""),
    wr_content: String(raw.wr_content ?? ""),
    wr_name: String(raw.wr_name ?? ""),
    wr_datetime: dt,
    wr_last: String(raw.wr_last ?? dt),
    wr_hit: Number(raw.wr_hit ?? 0),
    wr_comment: Number(raw.wr_comment ?? 0),
    wr_good: Number(raw.wr_good ?? 0),
    wr_option: String(raw.wr_option ?? ""),
    ca_name: String((raw as { ca_name?: string }).ca_name ?? ""),
    wr_1: raw.wr_1,
    wr_2: raw.wr_2,
    wr_3: raw.wr_3,
    wr_4: raw.wr_4,
    wr_5: raw.wr_5,
  };
}

function normalizeComment(raw: GnuboardComment, postId: number): GnuboardComment {
  const content = raw.save_content ?? raw.co_content ?? "";
  const dt = raw.co_datetime ?? (raw as { wr_datetime?: string }).wr_datetime ?? "";
  return {
    wr_id: Number(raw.wr_id ?? 0),
    wr_parent: Number(raw.wr_parent ?? postId),
    co_content: content,
    co_name: String(raw.co_name ?? (raw as { wr_name?: string }).wr_name ?? ""),
    co_datetime: String(dt),
    save_content: content,
  };
}

async function gnuFetchRaw<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiBase = getG6ApiV1Base();
  if (!apiBase) {
    throw new Error("G6 API URL이 설정되지 않았습니다.");
  }

  const token = await getG6AccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gnuboard API error: ${response.status} ${response.statusText} ${text.slice(0, 200)}`);
  }

  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}

function boardWritesPath(boardId: string, suffix = ""): string {
  const bo = resolveG6BoardId(boardId);
  return `/boards/${bo}/writes${suffix}`;
}

/** 게시판 목록 조회 */
export async function getPostList(
  boardId: string,
  params: {
    page?: number;
    per_page?: number;
    search_field?: string;
    search_keyword?: string;
    category?: string;
  } = {}
): Promise<GnuboardResponse<GnuboardPost[]>> {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) searchParams.set("page", String(params.page));
  if (params.per_page !== undefined) searchParams.set("per_page", String(params.per_page));
  if (params.search_keyword) {
    searchParams.set("stx", params.search_keyword);
    searchParams.set("sfl", params.search_field ?? "wr_subject||wr_content");
  }
  if (params.category) searchParams.set("sca", params.category);

  const query = searchParams.toString() ? `?${searchParams}` : "";
  const res = await gnuFetchRaw<G6ListResponse>(`${boardWritesPath(boardId)}${query}`);

  const notices = (res.notice_writes ?? []).map(normalizePost);
  const writes = (res.writes ?? []).map(normalizePost);
  const merged = [...notices, ...writes];

  return {
    success: true,
    data: merged,
    total: res.total_records,
    page: res.current_page,
    per_page: params.per_page,
  };
}

/** 게시물 단건 조회 */
export async function getPost(boardId: string, postId: number): Promise<GnuboardResponse<GnuboardPost>> {
  const res = await gnuFetchRaw<G6WriteResponse>(`${boardWritesPath(boardId)}/${postId}`);
  return { success: true, data: normalizePost(res) };
}

/** 게시물 작성 */
export async function createPost(
  boardId: string,
  data: Partial<GnuboardPost> & { wr_subject: string; wr_content?: string }
): Promise<GnuboardResponse<GnuboardPost>> {
  const body: Record<string, unknown> = {
    wr_subject: data.wr_subject,
    wr_content: data.wr_content ?? "",
    wr_name: data.wr_name ?? "LawyGo",
    html: "html1",
  };
  if (data.wr_1) body.wr_1 = data.wr_1;
  if (data.wr_2) body.wr_2 = data.wr_2;
  if (data.ca_name) body.ca_name = data.ca_name;

  const created = await gnuFetchRaw<{ result?: string; wr_id?: number }>(boardWritesPath(boardId), {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!created.wr_id) {
    throw new Error("G6 게시물 작성 응답에 wr_id가 없습니다.");
  }

  return getPost(boardId, created.wr_id);
}

/** 게시물 수정 */
export async function updatePost(
  boardId: string,
  postId: number,
  data: Partial<GnuboardPost>
): Promise<GnuboardResponse<GnuboardPost>> {
  const body: Record<string, unknown> = {
    wr_subject: data.wr_subject ?? "",
    wr_content: data.wr_content ?? "",
    html: "html1",
  };
  if (data.wr_name) body.wr_name = data.wr_name;
  if (data.wr_1 !== undefined) body.wr_1 = data.wr_1;
  if (data.wr_2 !== undefined) body.wr_2 = data.wr_2;

  await gnuFetchRaw<{ result?: string }>(`${boardWritesPath(boardId)}/${postId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return getPost(boardId, postId);
}

/** 게시물 삭제 */
export async function deletePost(boardId: string, postId: number): Promise<GnuboardResponse<{ deleted: boolean }>> {
  await gnuFetchRaw<{ result?: string }>(`${boardWritesPath(boardId)}/${postId}`, {
    method: "DELETE",
  });
  return { success: true, data: { deleted: true } };
}

/** 댓글 목록 조회 (글 단건 API의 comments 사용) */
export async function getComments(boardId: string, postId: number): Promise<GnuboardResponse<GnuboardComment[]>> {
  const res = await gnuFetchRaw<G6WriteResponse>(`${boardWritesPath(boardId)}/${postId}`);
  const list = (res.comments ?? []).map((c) => normalizeComment(c, postId));
  return { success: true, data: list };
}

/** 댓글 작성 */
export async function createComment(
  boardId: string,
  postId: number,
  content: string,
  authorName = "LawyGo"
): Promise<GnuboardResponse<GnuboardComment>> {
  await gnuFetchRaw<{ result?: string }>(`${boardWritesPath(boardId)}/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({
      wr_content: content,
      wr_name: authorName,
      wr_option: "html1",
    }),
  });

  const refreshed = await getComments(boardId, postId);
  const latest = refreshed.data[refreshed.data.length - 1];
  if (!latest) {
    throw new Error("댓글 작성 후 목록을 불러오지 못했습니다.");
  }
  return { success: true, data: latest };
}

/** 파일 업로드 */
export async function uploadFile(boardId: string, postId: number, file: File) {
  const apiBase = getG6ApiV1Base();
  if (!apiBase) throw new Error("G6 API URL이 설정되지 않았습니다.");

  const formData = new FormData();
  formData.append("file", file);

  const token = await getG6AccessToken();
  const bo = resolveG6BoardId(boardId);
  const url = `${apiBase}/boards/${bo}/writes/${postId}/files`;
  const response = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) throw new Error("파일 업로드 실패");
  return response.json() as Promise<GnuboardResponse<GnuboardFile>>;
}

/** 사건 관련 메모 조회 (wr_1 = case_id 필터) */
export async function getCaseMemos(caseId: string) {
  return getPostList("case_memo", {
    search_field: "wr_1",
    search_keyword: caseId,
    per_page: 50,
  });
}

/** 회원 정보 조회 */
export async function getMemberInfo(userId: string) {
  return gnuFetchRaw<{
    mb_id: string;
    mb_name: string;
    mb_email: string;
    mb_level: number;
    mb_1?: string;
    mb_2?: string;
    mb_3?: string;
  }>(`/members/${userId}`);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function getFileIconType(mimeType: string): "pdf" | "excel" | "word" | "image" | "file" {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "excel";
  if (mimeType.includes("word") || mimeType.includes("document")) return "word";
  if (mimeType.startsWith("image/")) return "image";
  return "file";
}

export { isG6Configured };
