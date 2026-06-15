"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCallMemoById } from "@/lib/callMemoStorage";
import { FileText } from "lucide-react";

export default function CallMemoViewPage() {
  const params = useParams();
  const memoId = params?.id as string | undefined;
  const [memo, setMemo] = useState<ReturnType<typeof getCallMemoById>>(undefined);

  useEffect(() => {
    if (typeof window === "undefined" || !memoId) return;
    setMemo(getCallMemoById(memoId));
  }, [memoId]);

  if (!memoId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-500">메모 ID가 없습니다.</p>
      </div>
    );
  }

  if (memo === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-500">불러오는 중…</p>
      </div>
    );
  }

  if (!memo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-500">해당 전화 메모를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return s;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-primary-500" />
            전화 메모
          </h1>
          <p className="text-xs text-slate-500 mt-1">{formatDate(memo.updatedAt)}</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-600 mb-1">제목</h2>
            <p className="text-slate-800">{memo.title || "-"}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-600 mb-1">발신자</h2>
            <p className="text-slate-800">{memo.callerName || "-"}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-600 mb-1">연락처</h2>
            <p className="text-slate-800">{memo.phone || "-"}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-600 mb-1">내용</h2>
            <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans bg-slate-50 rounded-lg p-4 border border-slate-100">
              {memo.content || "(내용 없음)"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
