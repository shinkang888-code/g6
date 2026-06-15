"use client";

import { Check, X, Clock, User } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { ApprovalStep } from "@/lib/types";
import { getApproverLabel } from "@/lib/approvalLineConfig";

type HistoryItem = {
  id: string;
  actor_name: string;
  action: string;
  comment?: string | null;
  created_at: string;
};

const actionLabel: Record<string, string> = {
  submit: "결재 요청",
  approve: "승인",
  reject: "반려",
  revert: "결재 취소",
  comment: "보완 요청",
};

export function ApprovalTimeline({
  line,
  history,
}: {
  line: ApprovalStep[];
  history?: HistoryItem[];
}) {
  const orders = [...new Set(line.map((s) => s.order))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {orders.map((order) => {
          const steps = line.filter((s) => s.order === order);
          const label = getApproverLabel(order);
          const allApproved = steps.every((s) => s.status === "승인");
          const anyRejected = steps.some((s) => s.status === "반려");
          const pending = steps.some((s) => s.status === "대기");

          return (
            <div key={order} className="border border-slate-200 rounded-xl overflow-hidden">
              <div
                className={cn(
                  "px-4 py-2 text-xs font-semibold flex items-center gap-2",
                  anyRejected
                    ? "bg-danger-50 text-danger-700"
                    : allApproved
                      ? "bg-success-50 text-success-700"
                      : pending
                        ? "bg-primary-50 text-primary-700"
                        : "bg-slate-50 text-slate-600"
                )}
              >
                {anyRejected ? (
                  <X size={14} />
                ) : allApproved ? (
                  <Check size={14} />
                ) : (
                  <Clock size={14} />
                )}
                {label} ({order}차 결재)
              </div>
              <ul className="divide-y divide-slate-100">
                {steps.map((s) => (
                  <li key={`${s.order}-${s.staffId}`} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        s.status === "승인"
                          ? "bg-success-100 text-success-700"
                          : s.status === "반려"
                            ? "bg-danger-100 text-danger-700"
                            : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {s.status === "승인" ? <Check size={14} /> : s.status === "반려" ? <X size={14} /> : <User size={14} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800">{s.staffName}</div>
                      <div className="text-xs text-text-muted">{s.role ?? "결재자"}</div>
                      {s.comment && (
                        <div className="text-xs text-danger-600 mt-1">사유: {s.comment}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          s.status === "승인"
                            ? "bg-success-100 text-success-700"
                            : s.status === "반려"
                              ? "bg-danger-100 text-danger-700"
                              : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {s.status}
                      </span>
                      {s.signedAt && (
                        <div className="text-[10px] text-text-muted mt-1">{formatDate(s.signedAt)}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {history && history.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">처리 이력</h4>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="text-xs text-slate-600 flex gap-2">
                <span className="text-text-muted shrink-0">{formatDate(h.created_at)}</span>
                <span>
                  <strong>{h.actor_name}</strong> — {actionLabel[h.action] ?? h.action}
                  {h.comment ? `: ${h.comment}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
