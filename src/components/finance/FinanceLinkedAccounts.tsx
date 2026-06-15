"use client";

import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import type { LinkedAccount } from "@/lib/types";
import { formatAmount } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  accounts: LinkedAccount[];
  onAddClick: () => void;
};

export function FinanceLinkedAccounts({ accounts, onAddClick }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">연동 계좌</h3>
        <Button size="sm" variant="outline" leftIcon={<Plus size={13} />} onClick={onAddClick}>
          계좌 연결
        </Button>
      </div>
      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-text-muted">
          등록된 계좌가 없습니다. 입금 내역을 계좌별로 구분하려면 계좌를 연결하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((account) => {
            const title = account.displayName?.trim() || account.bankName;
            return (
              <Link
                key={account.id}
                href={`/finance/accounts/${account.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-200 bg-white p-4 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {account.bankName} · {account.accountNumberMasked}
                    </div>
                    {account.balance != null && account.balance > 0 && (
                      <div className="text-sm font-bold text-slate-800 mt-2 tabular-nums">
                        {formatAmount(account.balance)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
