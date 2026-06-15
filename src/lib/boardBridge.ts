/**
 * 전문 게시판 중간 관리자 (Board Bridge)
 * LawyGo ↔ G6(그누보드6) 연동 시 에러·폴백·정규화를 담당합니다.
 * - 프론트/API 라우트는 이 모듈만 사용하고, G6를 직접 호출하지 않습니다.
 */

import {
  getPostList,
  getPost,
  createPost as gnuCreatePost,
  updatePost as gnuUpdatePost,
  deletePost as gnuDeletePost,
  getComments,
  createComment as gnuCreateComment,
  type GnuboardPost,
  type GnuboardComment,
} from "./gnuboard";
import { isG6Configured } from "./gnuboardConfig";

/** 브릿지 응답: 성공/실패와 출처(g6 | fallback) 통일 */
export interface BridgeResult<T> {
  success: boolean;
  data: T;
  error?: string;
  source: "g6" | "fallback";
}

/** LawyGo에서 사용하는 게시물 타입 (G6 필드 매핑) */
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

/** LawyGo에서 사용하는 댓글 타입 */
export interface BoardComment {
  id: number;
  postId: number;
  content: string;
  author: string;
  createdAt: string;
}

function mapPost(p: GnuboardPost): BoardPost {
  return {
    id: p.wr_id,
    subject: p.wr_subject,
    content: p.wr_content,
    author: p.wr_name,
    createdAt: p.wr_datetime,
    updatedAt: p.wr_last,
    hit: p.wr_hit ?? 0,
    commentCount: p.wr_comment ?? 0,
    category: p.ca_name,
    caseId: p.wr_1,
    caseType: p.wr_2,
  };
}

function mapComment(c: GnuboardComment): BoardComment {
  return {
    id: c.wr_id,
    postId: c.wr_parent,
    content: c.save_content ?? c.co_content,
    author: c.co_name,
    createdAt: c.co_datetime,
  };
}

/** G6 연결 가능 여부 (환경변수 기준) */
export function isBoardApiConfigured(): boolean {
  if (typeof process === "undefined") return false;
  return isG6Configured();
}

/** 게시판 목록 조회 (에러 시 빈 배열 반환, G6 미연동 시 빈 목록으로 성공 처리) */
export async function bridgeGetPostList(
  boardId: string,
  params: { page?: number; per_page?: number; search_keyword?: string; search_field?: string; category?: string } = {}
): Promise<BridgeResult<BoardPost[]>> {
  if (!isBoardApiConfigured()) {
    return { success: true, data: [], source: "fallback" };
  }
  try {
    const res = await getPostList(boardId, params);
    const list = Array.isArray(res?.data) ? res.data : [];
    return { success: true, data: list.map(mapPost), source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시판 목록을 불러올 수 없습니다.";
    return { success: false, data: [], error: message, source: "fallback" };
  }
}

/** 게시물 단건 조회 */
export async function bridgeGetPost(boardId: string, postId: number): Promise<BridgeResult<BoardPost | null>> {
  try {
    const res = await getPost(boardId, postId);
    const post = res?.data;
    return { success: true, data: post ? mapPost(post) : null, source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물을 불러올 수 없습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

/** 게시물 작성 */
export async function bridgeCreatePost(
  boardId: string,
  data: { wr_subject: string; wr_content: string; wr_name?: string; wr_1?: string; wr_2?: string }
): Promise<BridgeResult<BoardPost | null>> {
  try {
    const res = await gnuCreatePost(boardId, data);
    const post = res?.data;
    return { success: true, data: post ? mapPost(post) : null, source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 작성에 실패했습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

/** 게시물 수정 */
export async function bridgeUpdatePost(
  boardId: string,
  postId: number,
  data: Partial<GnuboardPost>
): Promise<BridgeResult<BoardPost | null>> {
  try {
    const res = await gnuUpdatePost(boardId, postId, data);
    const post = res?.data;
    return { success: true, data: post ? mapPost(post) : null, source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 수정에 실패했습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

/** 게시물 삭제 */
export async function bridgeDeletePost(boardId: string, postId: number): Promise<BridgeResult<boolean>> {
  try {
    await gnuDeletePost(boardId, postId);
    return { success: true, data: true, source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 삭제에 실패했습니다.";
    return { success: false, data: false, error: message, source: "fallback" };
  }
}

/** 댓글 목록 */
export async function bridgeGetComments(boardId: string, postId: number): Promise<BridgeResult<BoardComment[]>> {
  try {
    const res = await getComments(boardId, postId);
    const list = Array.isArray(res?.data) ? res.data : [];
    return { success: true, data: list.map(mapComment), source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "댓글을 불러올 수 없습니다.";
    return { success: false, data: [], error: message, source: "fallback" };
  }
}

/** 댓글 작성 */
export async function bridgeCreateComment(
  boardId: string,
  postId: number,
  content: string
): Promise<BridgeResult<BoardComment | null>> {
  try {
    const res = await gnuCreateComment(boardId, postId, content);
    const comment = res?.data;
    return {
      success: true,
      data: comment ? mapComment(comment) : null,
      source: "g6",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "댓글 작성에 실패했습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}
