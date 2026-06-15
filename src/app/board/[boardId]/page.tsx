"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  LayoutList,
  Search,
  Plus,
  MessageSquare,
  Eye,
  Calendar,
  User,
  AlertCircle,
  FileText,
} from "lucide-react";
import { BOARD_LIST } from "@/lib/boardConfig";
import { getBoardById } from "@/lib/boardStorage";
import { Button } from "@/components/ui/button";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportBoardPostsSearchResult } from "@/lib/listExcelExports";
import { toast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";
import type { BoardPost } from "@/lib/boardBridge";

export default function BoardPostsPage({ params }: { params: Promise<{ boardId: string }> }) {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [g6Connected, setG6Connected] = useState(false);
  const [noticeInternal, setNoticeInternal] = useState(false);
  const [search, setSearch] = useState("");
  const [storedBoard, setStoredBoard] = useState<{ id: string; name: string; description?: string } | null>(null);

  useEffect(() => {
    params.then((p) => setBoardId(p.boardId));
  }, [params]);

  useEffect(() => {
    if (!boardId) return;
    if (BOARD_LIST.some((b) => b.id === boardId)) {
      setStoredBoard(null);
      return;
    }
    const b = getBoardById(boardId);
    setStoredBoard(b && !b.deletedAt ? { id: b.id, name: b.name, description: b.description } : null);
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    const q = search ? `?search_keyword=${encodeURIComponent(search)}` : "";
    fetch(`/api/board/${boardId}${q}`)
      .then((res) => res.json())
      .then((data) => {
        setNoticeInternal(data.source === "lawygo");
        setG6Connected(data.source === "g6");
        if (data.success && Array.isArray(data.data)) {
          setPosts(data.data);
          setError(null);
        } else {
          setPosts([]);
          setError(data.error ?? "목록을 불러올 수 없습니다.");
        }
      })
      .catch(() => {
        setPosts([]);
        setError("연결에 실패했습니다.");
        setG6Connected(false);
      })
      .finally(() => setLoading(false));
  }, [boardId, search]);

  const board = boardId
    ? BOARD_LIST.find((b) => b.id === boardId) ?? (storedBoard ? { id: storedBoard.id, name: storedBoard.name, description: storedBoard.description } : null)
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-5"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/board"
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-primary-600 transition-colors"
          >
            <ArrowLeft size={16} /> 게시판
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <LayoutList size={20} className="text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{board?.name ?? boardId}</h1>
              {board?.description && (
                <p className="text-sm text-text-muted">{board.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="제목·내용 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <SearchResultExcelButton
            count={posts.length}
            disabled={loading}
            onExport={() => {
              if (exportBoardPostsSearchResult(posts, board?.name ?? boardId ?? "게시판")) {
                toast.success(`${posts.length}건을 엑셀로보냈습니다.`);
              }
            }}
          />
          {(g6Connected || noticeInternal) ? (
            <Link href={`/board/${boardId}/write`}>
              <Button size="sm" leftIcon={<Plus size={14} />}>
                글쓰기
              </Button>
            </Link>
          ) : (
            <Button size="sm" leftIcon={<Plus size={14} />} disabled>
              글쓰기
            </Button>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
            <div className="animate-pulse divide-y divide-slate-50">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-5 py-4 flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-slate-100 rounded" />
                    <div className="h-3 w-1/2 bg-slate-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error && !g6Connected && !noticeInternal ? (
          <div className="rounded-2xl border border-warning-200 bg-warning-50 p-6 flex flex-col items-center justify-center gap-3">
            <AlertCircle size={32} className="text-warning-500" />
            <p className="text-sm font-medium text-warning-800">G6가 연동되지 않았습니다</p>
            <p className="text-xs text-text-muted text-center max-w-md">
              게시글 목록을 보려면 그누보드6(G6)를 설치·실행하고, 환경 변수 NEXT_PUBLIC_GNUBOARD_API_URL을 설정하세요.
              <br />
              <Link href="/board" className="text-primary-600 hover:underline mt-1 inline-block">
                게시판 목록으로
              </Link>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/70 text-xs text-text-muted font-medium border-b border-slate-100">
                    <th className="text-left px-5 py-3 w-12">번호</th>
                    <th className="text-left px-5 py-3">제목</th>
                    <th className="text-left px-5 py-3 w-24 hidden sm:table-cell">작성자</th>
                    <th className="text-left px-5 py-3 w-20 hidden md:table-cell">조회</th>
                    <th className="text-left px-5 py-3 w-28 hidden md:table-cell">작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-text-muted">
                        <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                        게시글이 없습니다.
                        {!g6Connected && !noticeInternal && (
                          <p className="text-xs mt-1.5 text-slate-400">
                            G6를 연동하면 이 게시판에 글이 표시됩니다.{" "}
                            <Link
                              href="/admin/settings/integration"
                              className="text-primary-600 hover:underline"
                            >
                              그누보드 연동 방법 보기
                            </Link>
                          </p>
                        )}
                        {noticeInternal && (
                          <p className="text-xs mt-1.5 text-slate-400">
                            업무 대시보드 공지사항과 동일한 데이터입니다. 글쓰기로 등록하세요.
                          </p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    posts.map((post) => (
                      <tr
                        key={post.id}
                        className="border-t border-slate-50 text-sm hover:bg-primary-50/50 transition-colors"
                      >
                        <td className="px-5 py-3 text-text-muted tabular-nums">{post.id}</td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/board/${boardId}/post/${post.id}`}
                            className="font-medium text-slate-800 hover:text-primary-600 hover:underline line-clamp-1"
                          >
                            {post.subject || "(제목 없음)"}
                          </Link>
                          {post.commentCount > 0 && (
                            <span className="ml-1.5 text-primary-600 text-xs">
                              [{post.commentCount}]
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-text-muted hidden sm:table-cell flex items-center gap-1">
                          <User size={12} /> {post.author}
                        </td>
                        <td className="px-5 py-3 text-text-muted hidden md:table-cell">
                          <span className="flex items-center gap-1">
                            <Eye size={12} /> {post.hit}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-text-muted hidden md:table-cell text-xs">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {formatDate(post.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
