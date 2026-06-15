/**
 * 전문 게시판 브릿지 — Supabase 네이티브 + G6(그누보드6) 하이브리드
 * BOARD_BRIDGE_PREFER: native | g6 | hybrid (기본 hybrid — 네이티브 우선, 없으면 G6)
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
import {
  g6GetPostList,
  g6GetPost,
  g6CreatePost,
  g6UpdatePost,
  g6DeletePost,
  g6GetComments,
  g6CreateComment,
  isG6BoardReady,
} from "./boardBridgeG6";
import { isG6Configured } from "./gnuboardConfig";
import type {
  BoardBridgeStatus,
  BoardComment,
  BoardPost,
  BridgeContext,
  BridgeResult,
} from "./boardBridgeTypes";

export type { BoardComment, BoardPost, BridgeContext, BridgeResult, BoardBridgeStatus };

type PreferMode = "native" | "g6" | "hybrid";

function getPreferMode(): PreferMode {
  const v = (process.env.BOARD_BRIDGE_PREFER ?? "hybrid").trim().toLowerCase();
  if (v === "native" || v === "g6") return v;
  return "hybrid";
}

async function useNative(): Promise<boolean> {
  const mode = getPreferMode();
  if (mode === "g6") return false;
  return isNativeBoardReady();
}

async function useG6(): Promise<boolean> {
  const mode = getPreferMode();
  if (mode === "native") return false;
  if (!(await useNative())) return isG6BoardReady();
  return mode === "g6" && isG6BoardReady();
}

/** 연동 상태 (API / UI) */
export async function getBoardBridgeStatus(): Promise<BoardBridgeStatus> {
  const nativeBoard = await isNativeBoardReady();
  const g6Connected = isG6Configured();
  return {
    nativeBoard,
    g6Connected,
    prefer: getPreferMode(),
  };
}

export async function isBoardApiConfigured(): Promise<boolean> {
  if (await isNativeBoardReady()) return true;
  return isG6BoardReady();
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
  if (await useNative()) {
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
      if (!(await useG6())) {
        return { success: false, data: [], error: message, source: "fallback", total: 0 };
      }
    }
  }

  if (await useG6()) {
    return g6GetPostList(boardId, params);
  }

  return { success: true, data: [], source: "fallback", total: 0 };
}

export async function bridgeGetPost(
  boardId: string,
  postId: number,
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardPost | null>> {
  if (await useNative()) {
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
      if (!(await useG6())) {
        const message = e instanceof Error ? e.message : "게시물을 불러올 수 없습니다.";
        return { success: false, data: null, error: message, source: "fallback" };
      }
    }
  }

  if (await useG6()) {
    return g6GetPost(boardId, postId);
  }

  return { success: false, data: null, error: "게시판이 연결되지 않았습니다.", source: "fallback" };
}

export async function bridgeCreatePost(
  boardId: string,
  data: { wr_subject: string; wr_content: string; wr_name?: string; wr_1?: string; wr_2?: string },
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardPost | null>> {
  if (await useNative()) {
    try {
      const created = await createPost(boardId, {
        title: data.wr_subject,
        content: data.wr_content,
        authorName: data.wr_name ?? ctx.authorName ?? "관리자",
        managementNumber: ctx.managementNumber,
      });
      return { success: true, data: postToBoardPost(created), source: "lawygo" };
    } catch (e) {
      if (!(await useG6())) {
        const message = e instanceof Error ? e.message : "게시물 작성에 실패했습니다.";
        return { success: false, data: null, error: message, source: "fallback" };
      }
    }
  }

  if (await useG6()) {
    return g6CreatePost(boardId, data);
  }

  return { success: false, data: null, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
}

export async function bridgeUpdatePost(
  boardId: string,
  postId: number,
  data: { wr_subject?: string; wr_content?: string },
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardPost | null>> {
  if (await useNative()) {
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
      if (!(await useG6())) {
        const message = e instanceof Error ? e.message : "게시물 수정에 실패했습니다.";
        return { success: false, data: null, error: message, source: "fallback" };
      }
    }
  }

  if (await useG6()) {
    return g6UpdatePost(boardId, postId, {
      wr_subject: data.wr_subject,
      wr_content: data.wr_content,
    });
  }

  return { success: false, data: null, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
}

export async function bridgeDeletePost(
  boardId: string,
  postId: number,
  ctx: BridgeContext = {}
): Promise<BridgeResult<boolean>> {
  if (await useNative()) {
    try {
      const ok = await softDeletePost(boardId, postId, ctx.managementNumber);
      if (!ok) {
        return { success: false, data: false, error: "게시물을 찾을 수 없습니다.", source: "lawygo" };
      }
      return { success: true, data: true, source: "lawygo" };
    } catch (e) {
      if (!(await useG6())) {
        const message = e instanceof Error ? e.message : "게시물 삭제에 실패했습니다.";
        return { success: false, data: false, error: message, source: "fallback" };
      }
    }
  }

  if (await useG6()) {
    return g6DeletePost(boardId, postId);
  }

  return { success: false, data: false, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
}

export async function bridgeGetComments(
  boardId: string,
  postId: number,
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardComment[]>> {
  if (await useNative()) {
    try {
      const list = await listComments(boardId, postId, ctx.managementNumber);
      return {
        success: true,
        data: list.map((c) => commentToBoardComment(c, postId)),
        source: "lawygo",
      };
    } catch (e) {
      if (!(await useG6())) {
        const message = e instanceof Error ? e.message : "댓글을 불러올 수 없습니다.";
        return { success: false, data: [], error: message, source: "fallback" };
      }
    }
  }

  if (await useG6()) {
    return g6GetComments(boardId, postId);
  }

  return { success: true, data: [], source: "fallback" };
}

export async function bridgeCreateComment(
  boardId: string,
  postId: number,
  content: string,
  ctx: BridgeContext = {}
): Promise<BridgeResult<BoardComment | null>> {
  if (await useNative()) {
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
      if (!(await useG6())) {
        const message = e instanceof Error ? e.message : "댓글 작성에 실패했습니다.";
        return { success: false, data: null, error: message, source: "fallback" };
      }
    }
  }

  if (await useG6()) {
    return g6CreateComment(boardId, postId, content);
  }

  return { success: false, data: null, error: "게시판 DB가 준비되지 않았습니다.", source: "fallback" };
}
