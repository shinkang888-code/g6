"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { BOARD_LIST } from "@/lib/boardConfig";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

function getCurrentAuthor(): string {
  if (typeof window === "undefined") return "관리자";
  try {
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("lawygo_session="));
    if (!cookie) return "관리자";
    const payload = cookie.split("=")[1]?.split(".")[0];
    if (!payload) return "관리자";
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.name ?? decoded.loginId ?? "관리자";
  } catch {
    return "관리자";
  }
}

export default function BoardWritePage({ params }: { params: Promise<{ boardId: string }> }) {
  const router = useRouter();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    params.then((p) => setBoardId(p.boardId));
  }, [params]);

  const board = boardId ? BOARD_LIST.find((b) => b.id === boardId) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardId || !title.trim()) {
      toast.error("제목을 입력하세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/board/${boardId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wr_subject: title.trim(),
          wr_content: content.trim(),
          wr_name: getCurrentAuthor(),
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; data?: { id?: number } };
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "등록에 실패했습니다.");
        return;
      }
      toast.success("게시글이 등록되었습니다.");
      const postId = json.data?.id;
      router.push(postId ? `/board/${boardId}/post/${postId}` : `/board/${boardId}`);
    } catch {
      toast.error("등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link
          href={boardId ? `/board/${boardId}` : "/board"}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600"
        >
          <ArrowLeft size={16} />
          {board?.name ?? "게시판"} 목록
        </Link>
      </div>

      <h1 className="text-xl font-bold text-slate-900 mb-4">글쓰기 · {board?.name ?? ""}</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-card">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 outline-none"
            placeholder="공지 제목"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-y focus:ring-2 focus:ring-primary-500/20 outline-none leading-relaxed"
            placeholder="공지 내용을 입력하세요."
          />
        </div>
        <div className="flex justify-end gap-2">
          <Link href={boardId ? `/board/${boardId}` : "/board"}>
            <Button type="button" variant="outline">
              취소
            </Button>
          </Link>
          <Button type="submit" leftIcon={<Save size={14} />} disabled={submitting}>
            {submitting ? "등록 중…" : "등록"}
          </Button>
        </div>
      </form>
    </div>
  );
}
