"use client";

import { useState } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  deleteCallMemoTemplate,
  saveCallMemoTemplate,
  updateCallMemoTemplate,
  type CallMemoTemplate,
} from "@/lib/callMemoStorage";
import { CallMemoTemplateEditorPopup } from "@/components/consultation/CallMemoTemplateEditorPopup";

type Props = {
  templates: CallMemoTemplate[];
  onTemplatesChange: () => void;
  onApply: (template: CallMemoTemplate) => void;
};

export function CallMemoTemplatePanel({ templates, onTemplatesChange, onApply }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorInitial, setEditorInitial] = useState<Pick<CallMemoTemplate, "title" | "content"> | null>(
    null
  );

  const openCreate = () => {
    setEditorMode("create");
    setEditingId(null);
    setEditorInitial({ title: "", content: "" });
    setEditorOpen(true);
  };

  const openEdit = (t: CallMemoTemplate) => {
    setEditorMode("edit");
    setEditingId(t.id);
    setEditorInitial({ title: t.title, content: t.content });
    setEditorOpen(true);
  };

  const handleSave = (payload: { title: string; content: string }) => {
    if (editorMode === "create") {
      saveCallMemoTemplate(payload);
      toast.success("양식이 등록되었습니다.");
    } else if (editingId) {
      const updated = updateCallMemoTemplate(editingId, payload);
      if (!updated) {
        toast.error("양식을 찾을 수 없습니다.");
        return;
      }
      toast.success("양식이 수정되었습니다.");
    }
    onTemplatesChange();
  };

  const handleDelete = (t: CallMemoTemplate) => {
    if (!confirm(`"${t.title}" 양식을 삭제하시겠습니까?`)) return;
    deleteCallMemoTemplate(t.id);
    onTemplatesChange();
    toast.success("양식이 삭제되었습니다.");
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden flex flex-col h-full">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">작성 양식</span>
          <Button size="sm" variant="outline" leftIcon={<Plus size={12} />} onClick={openCreate}>
            양식 등록
          </Button>
        </div>
        <div className="p-3 flex-1 overflow-y-auto min-h-[280px]">
          <p className="text-xs text-text-muted mb-3">
            「적용」 또는 제목 클릭 시 좌측 메모 폼에 채워집니다. 등록·수정은 팝업에서 본문을 작성합니다.
          </p>
          {templates.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">등록된 양식이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 p-3 hover:border-primary-200 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onApply(t)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-primary-500 shrink-0" />
                      <span className="font-medium text-slate-800">{t.title}</span>
                    </div>
                    <p className="text-xs text-text-muted mt-1 line-clamp-2 whitespace-pre-wrap">{t.content}</p>
                  </button>
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onApply(t)}
                    >
                      적용
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      leftIcon={<Pencil size={12} />}
                      onClick={() => openEdit(t)}
                    >
                      수정
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="text-danger-600 hover:bg-danger-50 hover:border-danger-200"
                      leftIcon={<Trash2 size={12} />}
                      onClick={() => handleDelete(t)}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CallMemoTemplateEditorPopup
        open={editorOpen}
        mode={editorMode}
        initial={editorInitial}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
