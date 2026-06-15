/**
 * LawyGo 네이티브 게시판 (Supabase)
 * G6 대체 — boards / board_posts / board_comments
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { BOARD_LIST } from "@/lib/boardConfig";
import type { BoardPost, BoardComment } from "@/lib/boardBridge";

export const NOTICE_BOARD_SLUG = "notice";

export type BoardKind = "post" | "data";

export type BoardRecord = {
  id: string;
  slug: string;
  managementNumber: string;
  name: string;
  description: string;
  boardKind: BoardKind;
  sortOrder: number;
  isSystem: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PostRecord = {
  id: string;
  boardId: string;
  numId: number;
  title: string;
  content: string;
  authorName: string;
  authorLoginId: string | null;
  viewCount: number;
  category: string | null;
  caseId: string | null;
  caseType: string | null;
  commentCount: number;
  managementNumber: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommentRecord = {
  id: string;
  postId: string;
  numId: number;
  content: string;
  authorName: string;
  authorLoginId: string | null;
  createdAt: string;
};

function normalizeMgmt(managementNumber?: string | null): string {
  return (managementNumber ?? "").trim();
}

function boardFromRow(r: Record<string, unknown>): BoardRecord {
  return {
    id: String(r.id),
    slug: String(r.slug),
    managementNumber: String(r.management_number ?? ""),
    name: String(r.name ?? ""),
    description: String(r.description ?? ""),
    boardKind: (r.board_kind as BoardKind) ?? "post",
    sortOrder: Number(r.sort_order ?? 0),
    isSystem: Boolean(r.is_system),
    deletedAt: (r.deleted_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function postFromRow(r: Record<string, unknown>): PostRecord {
  return {
    id: String(r.id),
    boardId: String(r.board_id),
    numId: Number(r.num_id),
    title: String(r.title ?? ""),
    content: String(r.content ?? ""),
    authorName: String(r.author_name ?? "관리자"),
    authorLoginId: (r.author_login_id as string | null) ?? null,
    viewCount: Number(r.view_count ?? 0),
    category: (r.category as string | null) ?? null,
    caseId: (r.case_id as string | null) ?? null,
    caseType: (r.case_type as string | null) ?? null,
    commentCount: Number(r.comment_count ?? 0),
    managementNumber: String(r.management_number ?? ""),
    deletedAt: (r.deleted_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function commentFromRow(r: Record<string, unknown>): CommentRecord {
  return {
    id: String(r.id),
    postId: String(r.post_id),
    numId: Number(r.num_id),
    content: String(r.content ?? ""),
    authorName: String(r.author_name ?? "관리자"),
    authorLoginId: (r.author_login_id as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

export function postToBoardPost(p: PostRecord): BoardPost {
  return {
    id: p.numId,
    subject: p.title,
    content: p.content,
    author: p.authorName,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    hit: p.viewCount,
    commentCount: p.commentCount,
    category: p.category ?? undefined,
    caseId: p.caseId ?? undefined,
    caseType: p.caseType ?? undefined,
  };
}

export function commentToBoardComment(c: CommentRecord, postNumId: number): BoardComment {
  return {
    id: c.numId,
    postId: postNumId,
    content: c.content,
    author: c.authorName,
    createdAt: c.createdAt,
  };
}

export async function isNativeBoardReady(db?: SupabaseClient | null): Promise<boolean> {
  const client = db ?? getSupabaseAdmin();
  if (!client) return false;
  const { error } = await client.from("boards").select("id").limit(1);
  if (error) {
    console.error("[board] native ready check:", error.message, error.code);
    return false;
  }
  return true;
}

async function ensureDefaultBoards(db: SupabaseClient, managementNumber = ""): Promise<void> {
  const mgmt = normalizeMgmt(managementNumber);
  for (let i = 0; i < BOARD_LIST.length; i++) {
    const b = BOARD_LIST[i];
    const { error } = await db.from("boards").upsert(
      {
        slug: b.id,
        management_number: mgmt,
        name: b.name,
        description: b.description ?? "",
        board_kind: "post",
        sort_order: i,
        is_system: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug,management_number", ignoreDuplicates: true }
    );
    if (error) throw new Error(error.message);
  }
}

export async function resolveBoardBySlug(
  slug: string,
  managementNumber?: string | null
): Promise<BoardRecord | null> {
  const boards = await resolveBoardsBySlug(slug, managementNumber);
  if (boards.length === 0) return null;
  const mgmt = normalizeMgmt(managementNumber);
  return boards.find((b) => b.managementNumber === mgmt) ?? boards[0];
}

/** 테넌트 우선, 없으면 전역 게시판 (slug 기준 복수 가능) */
export async function resolveBoardsBySlug(
  slug: string,
  managementNumber?: string | null
): Promise<BoardRecord[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  if (!(await isNativeBoardReady(db))) return [];

  const mgmt = normalizeMgmt(managementNumber);
  await ensureDefaultBoards(db, mgmt);

  const keys = mgmt ? [mgmt, ""] : [""];
  const { data, error } = await db
    .from("boards")
    .select("*")
    .eq("slug", slug)
    .in("management_number", keys)
    .is("deleted_at", null)
    .order("management_number", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => boardFromRow(r as Record<string, unknown>));
}

export async function listBoards(managementNumber?: string | null): Promise<BoardRecord[]> {
  const db = getSupabaseAdmin();
  if (!db || !(await isNativeBoardReady(db))) return [];

  const mgmt = normalizeMgmt(managementNumber);
  await ensureDefaultBoards(db, mgmt);

  const { data, error } = await db
    .from("boards")
    .select("*")
    .is("deleted_at", null)
    .or(`management_number.eq.${mgmt},management_number.eq.`)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const result: BoardRecord[] = [];
  for (const row of data ?? []) {
    const b = boardFromRow(row as Record<string, unknown>);
    if (seen.has(b.slug)) continue;
    seen.add(b.slug);
    result.push(b);
  }
  return result;
}

export async function listPosts(
  boardSlug: string,
  options: {
    managementNumber?: string | null;
    page?: number;
    pageSize?: number;
    searchKeyword?: string;
    category?: string;
  } = {}
): Promise<{ items: PostRecord[]; total: number }> {
  const board = await resolveBoardBySlug(boardSlug, options.managementNumber);
  if (!board) return { items: [], total: 0 };

  const db = getSupabaseAdmin()!;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
  const q = options.searchKeyword?.trim() ?? "";

  let query = db
    .from("board_posts")
    .select("*", { count: "exact" })
    .eq("board_id", board.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,author_name.ilike.%${q}%`);
  }
  if (options.category) {
    query = query.eq("category", options.category);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);

  return {
    items: (data ?? []).map((r) => postFromRow(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getPostByNumId(
  boardSlug: string,
  numId: number,
  managementNumber?: string | null
): Promise<PostRecord | null> {
  const boards = await resolveBoardsBySlug(boardSlug, managementNumber);
  if (boards.length === 0) return null;

  const db = getSupabaseAdmin()!;
  const boardIds = boards.map((b) => b.id);
  const { data, error } = await db
    .from("board_posts")
    .select("*")
    .in("board_id", boardIds)
    .eq("num_id", numId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? postFromRow(data as Record<string, unknown>) : null;
}

export async function incrementPostView(
  boardSlug: string,
  numId: number,
  managementNumber?: string | null
): Promise<void> {
  const post = await getPostByNumId(boardSlug, numId, managementNumber);
  if (!post) return;

  const db = getSupabaseAdmin()!;
  await db
    .from("board_posts")
    .update({ view_count: post.viewCount + 1 })
    .eq("id", post.id);
}

export async function createPost(
  boardSlug: string,
  input: {
    title: string;
    content: string;
    authorName: string;
    authorLoginId?: string;
    category?: string;
    caseId?: string;
    caseType?: string;
    managementNumber?: string | null;
  }
): Promise<PostRecord> {
  const board = await resolveBoardBySlug(boardSlug, input.managementNumber);
  if (!board) throw new Error("게시판을 찾을 수 없습니다.");

  const db = getSupabaseAdmin()!;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("board_posts")
    .insert({
      board_id: board.id,
      title: input.title.trim(),
      content: input.content.trim(),
      author_name: input.authorName.trim() || "관리자",
      author_login_id: input.authorLoginId ?? null,
      category: input.category ?? null,
      case_id: input.caseId ?? null,
      case_type: input.caseType ?? null,
      management_number: normalizeMgmt(input.managementNumber),
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return postFromRow(data as Record<string, unknown>);
}

export async function updatePost(
  boardSlug: string,
  numId: number,
  input: {
    title?: string;
    content?: string;
    authorName?: string;
    managementNumber?: string | null;
  }
): Promise<PostRecord | null> {
  const post = await getPostByNumId(boardSlug, numId, input.managementNumber);
  if (!post) return null;

  const db = getSupabaseAdmin()!;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.content !== undefined) update.content = input.content.trim();
  if (input.authorName !== undefined) update.author_name = input.authorName.trim();

  const { data, error } = await db
    .from("board_posts")
    .update(update)
    .eq("id", post.id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? postFromRow(data as Record<string, unknown>) : null;
}

export async function softDeletePost(
  boardSlug: string,
  numId: number,
  managementNumber?: string | null
): Promise<boolean> {
  const post = await getPostByNumId(boardSlug, numId, managementNumber);
  if (!post) return false;

  const db = getSupabaseAdmin()!;
  const now = new Date().toISOString();
  const { error } = await db
    .from("board_posts")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", post.id);

  return !error;
}

export async function listComments(
  boardSlug: string,
  postNumId: number,
  managementNumber?: string | null
): Promise<CommentRecord[]> {
  const post = await getPostByNumId(boardSlug, postNumId, managementNumber);
  if (!post) return [];

  const db = getSupabaseAdmin()!;
  const { data, error } = await db
    .from("board_comments")
    .select("*")
    .eq("post_id", post.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => commentFromRow(r as Record<string, unknown>));
}

export async function createComment(
  boardSlug: string,
  postNumId: number,
  input: { content: string; authorName: string; authorLoginId?: string; managementNumber?: string | null }
): Promise<CommentRecord | null> {
  const post = await getPostByNumId(boardSlug, postNumId, input.managementNumber);
  if (!post) return null;

  const db = getSupabaseAdmin()!;
  const { data, error } = await db
    .from("board_comments")
    .insert({
      post_id: post.id,
      content: input.content.trim(),
      author_name: input.authorName.trim() || "관리자",
      author_login_id: input.authorLoginId ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await db
    .from("board_posts")
    .update({ comment_count: post.commentCount + 1, updated_at: new Date().toISOString() })
    .eq("id", post.id);

  return commentFromRow(data as Record<string, unknown>);
}

/** 관리자: 게시판 생성 */
export async function createBoard(input: {
  slug: string;
  name: string;
  description?: string;
  boardKind?: BoardKind;
  managementNumber?: string | null;
  sortOrder?: number;
}): Promise<BoardRecord> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("DB 연결 실패");

  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  if (!slug) throw new Error("게시판 ID가 필요합니다.");

  const { data: maxOrder } = await db
    .from("boards")
    .select("sort_order")
    .eq("management_number", normalizeMgmt(input.managementNumber))
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("boards")
    .insert({
      slug,
      management_number: normalizeMgmt(input.managementNumber),
      name: input.name.trim() || slug,
      description: input.description?.trim() ?? "",
      board_kind: input.boardKind ?? "post",
      sort_order: input.sortOrder ?? (Number(maxOrder?.sort_order ?? -1) + 1),
      is_system: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return boardFromRow(data as Record<string, unknown>);
}

export async function updateBoard(
  boardId: string,
  input: { name?: string; description?: string; boardKind?: BoardKind; sortOrder?: number }
): Promise<BoardRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("DB 연결 실패");

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.description !== undefined) update.description = input.description.trim();
  if (input.boardKind !== undefined) update.board_kind = input.boardKind;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;

  const { data, error } = await db
    .from("boards")
    .update(update)
    .eq("id", boardId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? boardFromRow(data as Record<string, unknown>) : null;
}

export async function softDeleteBoard(boardId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;

  const now = new Date().toISOString();
  const { error } = await db
    .from("boards")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", boardId)
    .eq("is_system", false);

  return !error;
}

export async function listAllBoardsAdmin(managementNumber?: string | null): Promise<BoardRecord[]> {
  const db = getSupabaseAdmin();
  if (!db || !(await isNativeBoardReady(db))) return [];

  const mgmt = normalizeMgmt(managementNumber);
  const { data, error } = await db
    .from("boards")
    .select("*")
    .or(`management_number.eq.${mgmt},management_number.eq.`)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => boardFromRow(r as Record<string, unknown>));
}

export async function listPostsAdmin(
  boardId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ items: PostRecord[]; total: number }> {
  const db = getSupabaseAdmin();
  if (!db) return { items: [], total: 0 };

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
  const from = (page - 1) * pageSize;

  const { data, count, error } = await db
    .from("board_posts")
    .select("*", { count: "exact" })
    .eq("board_id", boardId)
    .order("updated_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(error.message);
  return {
    items: (data ?? []).map((r) => postFromRow(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}
