"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    displayName: string;
    balance: number | null;
  }) => Promise<void>;
};

export function FinanceAccountLinkForm({ open, onClose, onSubmit }: Props) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim()) return;
    setSaving(true);
    try {
      const bal = balance.trim() ? Number(balance.replace(/,/g, "")) : null;
      await onSubmit({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        displayName: displayName.trim(),
        balance: bal && bal > 0 ? bal : null,
      });
      setBankName("");
      setAccountNumber("");
      setAccountHolder("");
      setDisplayName("");
      setBalance("");
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
          <h3 className="text-base font-bold text-slate-900">계좌 연결</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-text-muted mb-4">
          수동 등록입니다. 오픈뱅킹 연동은 추후 Phase에서 추가됩니다.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">은행명 *</label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="국민은행"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">계좌번호 *</label>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="123-45-678901"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">예금주</label>
              <input
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">표시명</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="수임료 계좌"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">잔액 (선택)</label>
            <input
              type="number"
              min={0}
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={saving}>
            연결
          </Button>
        </div>
      </form>
    </div>
  );
}
