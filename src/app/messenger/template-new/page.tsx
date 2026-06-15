"use client";

import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveTemplate } from "@/lib/messengerTemplates";

export default function MessengerTemplateNewPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isOpener, setIsOpener] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    setIsOpener(params.get("opener") === "1");
  }, []);

  const handleSave = () => {
    const t = title.trim() || "제목 없음";
    if (!content.trim()) {
      alert("내용을 입력하세요.");
      return;
    }
    saveTemplate({ title: t, content: content.trim() });
    if (typeof window !== "undefined" && window.opener) {
      window.opener.postMessage({ type: "messengerTemplateSaved" }, window.location.origin);
    }
    window.close();
  };

  return (
    <div className="min-h-screen bg-white p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-slate-900">새 발송 양식 작성</h1>
        {isOpener && (
          <button
            type="button"
            onClick={() => window.close()}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">양식 제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 상담 안내, 기일 알림"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">발송 내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="발송할 메시지 내용을 입력하세요."
            rows={12}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={handleSave} leftIcon={<Save size={16} />}>
            저장
          </Button>
          {isOpener && (
            <Button type="button" variant="outline" onClick={() => window.close()}>
              취소
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
