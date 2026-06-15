"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";
import type { CaseItem, Timeline } from "@/lib/types";

type Props = {
  caseItem: CaseItem;
  memos: Timeline[];
  onMemosChange: (memos: Timeline[]) => void;
};

export function CaseMemoTab({ caseItem, memos, onMemosChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [text, setText] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    setSelectedId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setTime("10:00");
    setText("");
    setComposerOpen(false);
  }, [caseItem.id]);

  const sortedMemos = useMemo(
    () =>
      [...memos].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [memos]
  );

  const handleSelect = (item: Timeline) => {
    setSelectedId(item.id);
    setDate(item.date.slice(0, 10));
    const t = new Date(item.date);
    if (!Number.isNaN(t.getTime())) {
      setTime(t.toISOString().slice(11, 16));
    }
    setText(item.content);
    setComposerOpen(true);
  };

  const handleReset = () => {
    setSelectedId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setTime("10:00");
    setText("");
    setComposerOpen(false);
  };

  const handleSave = () => {
    if (!text.trim()) return;
    const iso = `${date}T${time}:00Z`;
    if (selectedId) {
      onMemosChange(
        memos.map((m) => (m.id === selectedId ? { ...m, content: text, date: iso } : m))
      );
      toast.success("메모가 수정되었습니다.");
    } else {
      const newItem: Timeline = {
        id: `memo-${Date.now()}`,
        caseId: caseItem.id,
        type: "memo",
        title: "상담/업무 메모",
        content: text,
        authorId: "me",
        authorName: "담당자",
        date: iso,
      };
      onMemosChange([newItem, ...memos]);
      toast.success("메모가 등록되었습니다.");
    }
    handleReset();
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!confirm("선택한 메모를 삭제하시겠습니까?")) return;
    onMemosChange(memos.filter((m) => m.id !== selectedId));
    toast.success("메모가 삭제되었습니다.");
    handleReset();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-5 py-4 sm:py-5 space-y-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <MessageSquare size={16} className="text-primary-600" />
          메모장
          <span className="text-xs font-normal text-slate-500">({sortedMemos.length})</span>
        </h3>
        {!composerOpen && (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus size={14} />}
            onClick={() => setComposerOpen(true)}
          >
            새 메모
          </Button>
        )}
      </div>

      {composerOpen && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 min-w-[120px] px-2.5 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-[100px] px-2.5 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="사건 진행 메모를 입력하세요."
            rows={4}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 resize-y min-h-[96px] focus:outline-none focus:border-primary-300"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleReset}>
              취소
            </Button>
            {selectedId && (
              <Button size="sm" variant="danger" leftIcon={<Trash2 size={13} />} onClick={handleDelete}>
                삭제
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!text.trim()}>
              {selectedId ? "수정" : "저장"}
            </Button>
          </div>
        </div>
      )}

      {sortedMemos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <MessageSquare size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-600 font-medium">등록된 메모가 없습니다</p>
          <p className="text-xs text-text-muted mt-1">새 메모 버튼으로 진행 내용을 기록하세요.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sortedMemos.map((m) => {
            const isCourtSync = m.id.startsWith("court-sync");
            const isSelected = selectedId === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(m)}
                  className={cn(
                    "w-full text-left bg-white rounded-xl border p-3.5 transition-all",
                    isSelected
                      ? "border-primary-300 ring-2 ring-primary-100 shadow-sm"
                      : "border-slate-200 shadow-card hover:border-primary-200 hover:shadow-card-hover"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isCourtSync ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 shrink-0">
                          기일연동
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 shrink-0">
                          메모
                        </span>
                      )}
                      <span className="text-xs text-text-muted tabular-nums truncate">
                        {formatDate(m.date)} {formatDate(m.date, "time")}
                      </span>
                    </div>
                    <Pencil size={13} className="text-slate-400 shrink-0 mt-0.5" />
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-line line-clamp-4 leading-relaxed">
                    {m.content}
                  </p>
                  {m.authorName && (
                    <p className="text-[11px] text-text-muted mt-2">{m.authorName}</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
