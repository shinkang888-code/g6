"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Calendar,
  Eye,
  MessageSquare,
  LayoutList,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { BOARD_LIST } from "@/lib/boardConfig";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { BoardPost, BoardComment } from "@/lib/boardBridge";

export default function BoardPostPage({
  params,
}: {
  params: Promise<{ boardId: string; postId: string }>;
}) {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [post, setPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => {
      setBoardId(p.boardId);
      setPostId(p.postId);
    });
  }, [params]);

  useEffect(() => {
    if (!boardId || !postId || Number.isNaN(Number(postId))) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/board/${boardId}/${postId}`).then((r) => r.json()),
      fetch(`/api/board/${boardId}/${postId}/comments`).then((r) => r.json()),
    ])
      .then(([postRes, commentsRes]) => {
        if (postRes.success && postRes.data) setPost(postRes.data);
        else setError(postRes.error ?? "글을 불러올 수 없습니다.");
        if (commentsRes.success && Array.isArray(commentsRes.data)) setComments(commentsRes.data);
      })
      .catch(() => setError("연결에 실패했습니다."))
      .finally(() => setLoading(false));
  }, [boardId, postId]);

  const board = boardId ? BOARD_LIST.find((b) => b.id === boardId) : null;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 bg-slate-100 rounded" />
          <div className="h-8 w-3/4 bg-slate-100 rounded" />
          <div className="h-4 w-1/2 bg-slate-50 rounded" />
          <div className="h-40 bg-slate-50 rounded" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-warning-200 bg-warning-50 p-6 flex flex-col items-center gap-3">
          <AlertCircle size={32} className="text-warning-500" />
          <p className="text-sm font-medium text-warning-800">{error ?? "글을 찾을 수 없습니다."}</p>
          <Link href={boardId ? `/board/${boardId}` : "/board"}>
            <Button variant="outline" size="sm">목록으로</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/board/${boardId}`}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-primary-600 transition-colors"
          >
            <ArrowLeft size={16} /> {board?.name ?? boardId}
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-card overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <h1 className="text-xl font-bold text-slate-900">{post.subject || "(제목 없음)"}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-text-muted">
              <span className="flex items-center gap-1">
                <User size={14} /> {post.author}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {formatDate(post.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Eye size={14} /> 조회 {post.hit}
              </span>
              {post.commentCount > 0 && (
                <span className="flex items-center gap-1 text-primary-600">
                  <MessageSquare size={14} /> 댓글 {post.commentCount}
                </span>
              )}
            </div>
          </div>
          <div
            className={cn(
              "p-5 sm:p-6 text-sm text-slate-700 whitespace-pre-wrap break-words",
              "prose prose-sm max-w-none prose-p:my-2"
            )}
          >
            {post.content || "내용이 없습니다."}
          </div>
        </div>

        {comments.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <MessageSquare size={16} className="text-primary-600" />
              <span className="font-semibold text-slate-800">댓글 {comments.length}개</span>
            </div>
            <ul className="divide-y divide-slate-50">
              {comments.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-medium text-slate-600">
                      {c.author?.[0] ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span className="font-medium text-slate-700">{c.author}</span>
                        <span>{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/board/ai/case_search?boardId=${boardId}&postId=${postId}`}
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
          >
            <Sparkles size={14} />
            AI 문서엔진에서 이 글 활용 (판례 추천·PDF 요약·준비서면)
          </Link>
          <Link href={`/board/${boardId}`}>
            <Button variant="outline" size="sm" leftIcon={<LayoutList size={14} />}>
              목록
            </Button>
          </Link>
        </div>
      </motion.article>
    </div>
  );
}
