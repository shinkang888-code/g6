"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Loader2 } from "lucide-react";
import type { ClientItem } from "@/lib/types";

type RelatedCase = {
  id: string;
  caseNumber: string;
  caseName: string;
  status: string;
  court: string;
  assignedStaff: string;
  receivedDate: string;
};

type Props = {
  client: ClientItem | null;
  useApi: boolean;
};

export function ClientRelatedCases({ client, useApi }: Props) {
  const [cases, setCases] = useState<RelatedCase[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client?.id) {
      setCases([]);
      return;
    }
    if (!useApi) {
      setCases([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/clients/${client.id}/cases`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (!cancelled) setCases(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client?.id, useApi]);

  if (!client) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <Briefcase size={16} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-slate-800">
          관련 사건
          <span className="font-normal text-slate-500 ml-1">({client.name})</span>
        </h3>
      </div>
      <div className="p-4">
        {!useApi ? (
          <p className="text-xs text-slate-500">DB 연결 시 의뢰인과 연결된 사건 목록이 표시됩니다.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" />
            사건 조회 중…
          </div>
        ) : cases.length === 0 ? (
          <p className="text-xs text-slate-500">연결된 사건이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases?highlight=${c.id}`}
                  className="block text-sm rounded-lg border border-slate-100 px-3 py-2 hover:bg-primary-50 hover:border-primary-100 transition-colors"
                >
                  <span className="font-medium text-slate-800">{c.caseName || "사건명 없음"}</span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    {[c.caseNumber, c.court, c.status].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
