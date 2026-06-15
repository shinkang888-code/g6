"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LinkedAccount } from "@/lib/types";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  accounts?: LinkedAccount[];
  onClose: () => void;
  onSubmit: (data: {
    depositorName: string;
    amount: number;
    bankName: string;
    memo: string;
    date: string;
    linkedAccountId?: string;
  }) => Promise<void>;
};

export function FinanceDepositForm({ open, accounts = [], onClose, onSubmit }: Props) {
  const [depositorName, setDepositorName] = useState("");
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount.replace(/,/g, ""));
    if (!depositorName.trim() || !num || num <= 0) return;
    setSaving(true);
    try {
      await onSubmit({
        depositorName: depositorName.trim(),
        amount: num,
        bankName: bankName.trim(),
        memo: memo.trim(),
        date,
        linkedAccountId: linkedAccountId || undefined,
      });
      setDepositorName("");
      setAmount("");
      setBankName("");
      setMemo("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">입금 등록</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">입금자명 *</label>
            <input
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">금액 *</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">은행</label>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="국민은행"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">입금일</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              />
            </div>
          </div>
          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">연동 계좌</label>
              <select
                value={linkedAccountId}
                onChange={(e) => setLinkedAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              >
                <option value="">선택 안 함</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName || a.bankName} {a.accountNumberMasked}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">메모</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={saving}>
            등록
          </Button>
        </div>
      </form>
    </div>
  );
}
