/**
 * G6(그누보드6) 게시판 브릿지 — gnuboard.ts 래퍼
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
import type { BoardComment, BoardPost, BridgeResult } from "./boardBridgeTypes";

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

export function isG6BoardReady(): boolean {
  return isG6Configured();
}

export async function g6GetPostList(
  boardId: string,
  params: {
    page?: number;
    per_page?: number;
    search_keyword?: string;
    search_field?: string;
    category?: string;
  } = {}
): Promise<BridgeResult<BoardPost[]>> {
  if (!isG6Configured()) {
    return { success: true, data: [], source: "fallback", total: 0 };
  }
  try {
    const res = await getPostList(boardId, params);
    const list = Array.isArray(res?.data) ? res.data : [];
    return {
      success: true,
      data: list.map(mapPost),
      source: "g6",
      total: res?.total ?? list.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시판 목록을 불러올 수 없습니다.";
    return { success: false, data: [], error: message, source: "fallback", total: 0 };
  }
}

export async function g6GetPost(
  boardId: string,
  postId: number
): Promise<BridgeResult<BoardPost | null>> {
  if (!isG6Configured()) {
    return { success: false, data: null, error: "G6가 설정되지 않았습니다.", source: "fallback" };
  }
  try {
    const res = await getPost(boardId, postId);
    const post = res?.data;
    return { success: true, data: post ? mapPost(post) : null, source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물을 불러올 수 없습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

export async function g6CreatePost(
  boardId: string,
  data: { wr_subject: string; wr_content: string; wr_name?: string; wr_1?: string; wr_2?: string }
): Promise<BridgeResult<BoardPost | null>> {
  if (!isG6Configured()) {
    return { success: false, data: null, error: "G6가 설정되지 않았습니다.", source: "fallback" };
  }
  try {
    const res = await gnuCreatePost(boardId, data);
    const post = res?.data;
    return { success: true, data: post ? mapPost(post) : null, source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 작성에 실패했습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

export async function g6UpdatePost(
  boardId: string,
  postId: number,
  data: Partial<GnuboardPost>
): Promise<BridgeResult<BoardPost | null>> {
  if (!isG6Configured()) {
    return { success: false, data: null, error: "G6가 설정되지 않았습니다.", source: "fallback" };
  }
  try {
    const res = await gnuUpdatePost(boardId, postId, data);
    const post = res?.data;
    return { success: true, data: post ? mapPost(post) : null, source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 수정에 실패했습니다.";
    return { success: false, data: null, error: message, source: "fallback" };
  }
}

export async function g6DeletePost(
  boardId: string,
  postId: number
): Promise<BridgeResult<boolean>> {
  if (!isG6Configured()) {
    return { success: false, data: false, error: "G6가 설정되지 않았습니다.", source: "fallback" };
  }
  try {
    await gnuDeletePost(boardId, postId);
    return { success: true, data: true, source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "게시물 삭제에 실패했습니다.";
    return { success: false, data: false, error: message, source: "fallback" };
  }
}

export async function g6GetComments(
  boardId: string,
  postId: number
): Promise<BridgeResult<BoardComment[]>> {
  if (!isG6Configured()) {
    return { success: true, data: [], source: "fallback" };
  }
  try {
    const res = await getComments(boardId, postId);
    const list = Array.isArray(res?.data) ? res.data : [];
    return { success: true, data: list.map(mapComment), source: "g6" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "댓글을 불러올 수 없습니다.";
    return { success: false, data: [], error: message, source: "fallback" };
  }
}

export async function g6CreateComment(
  boardId: string,
  postId: number,
  content: string
): Promise<BridgeResult<BoardComment | null>> {
  if (!isG6Configured()) {
    return { success: false, data: null, error: "G6가 설정되지 않았습니다.", source: "fallback" };
  }
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
