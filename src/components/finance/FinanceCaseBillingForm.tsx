"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { BillingItem } from "@/lib/financeBillingServer";

const FALLBACK_PRESETS = ["착수금", "2차 착수금", "잔여 수임료", "성공보수", "실비", "기타"];

type Props = {
  open: boolean;
  mode: "billing" | "receipt";
  billingItems?: BillingItem[];
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    description: string;
    date: string;
    billingItemId?: string;
  }) => Promise<void>;
};

export function FinanceCaseBillingForm({
  open,
  mode,
  billingItems = [],
  onClose,
  onSubmit,
}: Props) {
  const presets = useMemo(() => {
    const names = billingItems.filter((b) => b.active).map((b) => b.name);
    if (names.length === 0) return FALLBACK_PRESETS;
    return [...names, "기타"];
  }, [billingItems]);

  const [preset, setPreset] = useState(presets[0] ?? FALLBACK_PRESETS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!presets.includes(preset)) setPreset(presets[0] ?? "기타");
  }, [presets, preset]);

  useEffect(() => {
    if (preset === "기타") return;
    const item = billingItems.find((b) => b.name === preset);
    if (item?.defaultAmount && !amount) {
      setAmount(String(item.defaultAmount));
    }
  }, [preset, billingItems, amount]);

  if (!open) return null;

  const isBilling = mode === "billing";
  const description = preset === "기타" ? customLabel.trim() : preset;
  const billingItemId = billingItems.find((b) => b.name === preset)?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount.replace(/,/g, ""));
    if (!num || num <= 0 || !description) return;
    setSaving(true);
    try {
      await onSubmit({
        amount: num,
        description,
        date,
        billingItemId: preset !== "기타" ? billingItemId : undefined,
      });
      setAmount("");
      setCustomLabel("");
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
          <h3 className="text-base font-bold text-slate-900">
            {isBilling ? "청구 등록" : "수동 수납 등록"}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">항목 *</label>
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                const item = billingItems.find((b) => b.name === e.target.value);
                if (item?.defaultAmount) setAmount(String(item.defaultAmount));
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
            >
              {presets.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {preset === "기타" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">항목명 *</label>
              <input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                required
              />
            </div>
          )}
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{isBilling ? "청구일" : "수납일"}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={saving}>
            {isBilling ? "청구 등록" : "수납 등록"}
          </Button>
        </div>
      </form>
    </div>
  );
}
