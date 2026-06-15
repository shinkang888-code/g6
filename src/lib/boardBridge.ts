/**
 * 전문 게시판 중간 관리자 (Board Bridge)
 * LawyGo ↔ Supabase 네이티브 게시판 연동
 */

import {
  isNativeBoardReady,
  listPosts,
  getPostByNumId,
  createPost,
  updatePost,
  softDeletePost,
  listComments,
  createComment,
  incrementPostView,
  postToBoardPost,
  commentToBoardComment,
} from "./boardService";

export interface BridgeResult<T> {
  success: boolean;
  data: T;
  error?: string;
  source: "lawygo" | "fallback";
  total?: number;
}

export interface BoardPost {
  id: number;
  subject: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  hit: number;
  commentCount: number;
  category?: string;
  caseId?: string;
  caseType?: string;
}

export interface BoardComment {
  id: number;
  postId: number;
  content: string;
  author: string;
  createdAt: string;
}

export type BridgeContext = {
  managementNumber?: string | null;
  authorName?: string;
  authorLoginId?: string;
};

/** 네이티브 게시판 DB 사용 가능 여부 */
export async function isBoardApiConfigured(): Promise<boolean> {
  return isNativeBoardReady();
}

export async function bridgeGetPostList(
  boardId: string,
  params: {
    page?: number;
    per_page?: number;
    search_keyword?: string;
    search_field?: string;
    category?: string;
    managementNumber?: string | null;
  } = {}
): Promise<BridgeResult<BoardPost[]>> {
  if (!(await isNativeBoardReady())) {
    return { success: true, data: [], source: "fallback", total: 0 };
  }
  try {
    const { items, total } = await listPosts(boardId, {
      managementNumber: params.managementNumber,
      page: params.page,
      pageSize: params.per_page,
      searchKeyword: params.search_keyword,
      category: params.category,
    });
    return {
      success: true,
      data: items.map(postToBoardPost),
      source: "lawygo",
      total,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시판 목록을 불러올 수 없습니다.";
    return { success: false, data: [], error: message, source: "fallback", total: 0 };
  }
}

export async function bridgeGetPost(
  boardId: string,
  postId: number,
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardPost | null>> {
  if (!(await isNativeBoardReady())) {
    return { success: false, data: null, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
  }
  try {
    const post = await getPostByNumId(boardId, postId, ctx.managementNumber);
    if (!post) {
      return { success: false, data: null, error: "게시물을 찾을 수 없습니다.", source: "lawygo" };
    }
    await incrementPostView(boardId, postId, ctx.managementNumber);
    return {
      success: true,
      data: postToBoardPost({ ...post, viewCount: post.viewCount + 1 }),
      source: "lawygo",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물을 불러올 수 없습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

export async function bridgeCreatePost(
  boardId: string,
  data: {
    wr_subject: string;
    wr_content: string;
    wr_name?: string;
    wr_1?: string;
    wr_2?: string;
  },
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardPost | null>> {
  if (!(await isNativeBoardReady())) {
    return { success: false, data: null, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
  }
  try {
    const created = await createPost(boardId, {
      title: data.wr_subject,
      content: data.wr_content,
      authorName: data.wr_name ?? ctx.authorName ?? "관리자",
      authorLoginId: ctx.authorLoginId,
      caseId: data.wr_1,
      caseType: data.wr_2,
      managementNumber: ctx.managementNumber,
    });
    return { success: true, data: postToBoardPost(created), source: "lawygo" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 작성에 실패했습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

export async function bridgeUpdatePost(
  boardId: string,
  postId: number,
  data: { wr_subject?: string; wr_content?: string },
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardPost | null>> {
  if (!(await isNativeBoardReady())) {
    return { success: false, data: null, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
  }
  try {
    const updated = await updatePost(boardId, postId, {
      title: data.wr_subject,
      content: data.wr_content,
      managementNumber: ctx.managementNumber,
    });
    if (!updated) {
      return { success: false, data: null, error: "게시물을 찾을 수 없습니다.", source: "lawygo" };
    }
    return { success: true, data: postToBoardPost(updated), source: "lawygo" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 수정에 실패했습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

export async function bridgeDeletePost(
  boardId: string,
  postId: number,
  ctx: BridgeContext = {}
): Promise<BridgeResult<boolean>> {
  if (!(await isNativeBoardReady())) {
    return { success: false, data: false, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
  }
  try {
    const ok = await softDeletePost(boardId, postId, ctx.managementNumber);
    if (!ok) {
      return { success: false, data: false, error: "게시물을 찾을 수 없습니다.", source: "lawygo" };
    }
    return { success: true, data: true, source: "lawygo" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 삭제에 실패했습니다.";
    return { success: false, data: false, error: message, source: "fallback" };
  }
}

export async function bridgeGetComments(
  boardId: string,
  postId: number,
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardComment[]>> {
  if (!(await isNativeBoardReady())) {
    return { success: true, data: [], source: "fallback" };
  }
  try {
    const list = await listComments(boardId, postId, ctx.managementNumber);
    return {
      success: true,
      data: list.map((c) => commentToBoardComment(c, postId)),
      source: "lawygo",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "댓글을 불러올 수 없습니다.";
    return { success: false, data: [], error: message, source: "fallback" };
  }
}

export async function bridgeCreateComment(
  boardId: string,
  postId: number,
  content: string,
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardComment | null>> {
  if (!(await isNativeBoardReady())) {
    return { success: false, data: null, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
  }
  try {
    const comment = await createComment(boardId, postId, {
      content,
      authorName: ctx.authorName ?? "관리자",
      authorLoginId: ctx.authorLoginId,
      managementNumber: ctx.managementNumber,
    });
    if (!comment) {
      return { success: false, data: null, error: "게시물을 찾을 수 없습니다.", source: "lawygo" };
    }
    return {
      success: true,
      data: commentToBoardComment(comment, postId),
      source: "lawygo",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "댓글 작성에 실패했습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}
