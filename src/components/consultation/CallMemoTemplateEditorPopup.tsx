"use client";

import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CallMemoTemplate } from "@/lib/callMemoStorage";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Pick<CallMemoTemplate, "title" | "content"> | null;
  onClose: () => void;
  onSave: (payload: { title: string; content: string }) => void;
};

export function CallMemoTemplateEditorPopup({
  open,
  mode,
  initial,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setContent(initial?.content ?? "");
  }, [open, initial?.title, initial?.content]);

  if (!open) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), content });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-template-editor-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 id="call-template-editor-title" className="text-sm font-semibold text-slate-900">
            {mode === "create" ? "양식 등록" : "양식 수정"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">양식 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 일반 문의, 사건 관련 연락"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">본문 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="전화 접수 시 채울 양식 본문을 작성하세요."
              rows={12}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none resize-y min-h-[200px] font-mono leading-relaxed"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
          <Button size="sm" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            leftIcon={<Save size={14} />}
            onClick={handleSave}
            disabled={!title.trim()}
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
