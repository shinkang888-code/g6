"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Send, X } from "lucide-react";
import { patchApproval } from "@/lib/approvalApi";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * 반려 사유를 기안자에게 사내 메신저로 보내는 팝업 (LawTop RequestReject)
 */
export default function ApprovalRejectPage() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc") ?? "";
  const requesterName = searchParams.get("requesterName") ?? "기안자";

  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState("결재자");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.name) setSenderName(d.user.name);
      })
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    const msg = reason.trim();
    if (!msg) {
      toast.error("반려 사유를 입력하세요.");
      return;
    }
    if (!docId) {
      toast.error("문서 정보가 없습니다.");
      return;
    }
    setSending(true);
    try {
      await patchApproval(docId, {
        action: "reject",
        comment: msg,
        messageToDrafter: msg,
      });
      toast.success("기안자에게 반려 사유가 전달되었습니다.");
      if (typeof window !== "undefined" && window.opener) {
        window.opener.postMessage(
          { type: "APPROVAL_REJECT", payload: { docId } },
          window.location.origin
        );
      }
      window.close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col">
      <div className="max-w-md mx-auto w-full bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-4 border-b border-slate-100">
          <h1 className="text-base font-semibold text-slate-900">결재 반려 · 사내 메신저 발송</h1>
          <p className="text-xs text-text-muted mt-1">
            기안자({requesterName})에게 반려 사유를 메시지로 보냅니다. 발송 후 결재가 반려 처리됩니다.
          </p>
          <p className="text-xs text-slate-500 mt-1">결재자: {senderName}</p>
        </div>
        <div className="p-5 flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">반려 사유 *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="반려 사유를 입력하세요. 기안자에게 그대로 전달됩니다."
            rows={5}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
          />
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => window.close()}
            leftIcon={<X size={14} />}
          >
            취소
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleSend}
            disabled={sending}
            leftIcon={<Send size={14} />}
          >
            반려 · 발송
          </Button>
        </div>
      </div>
    </div>
  );
}
