"use client";

import { useEffect, useState } from "react";
import type { CaseItem } from "@/lib/types";

export function useCaseItemById(caseId: string | null) {
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [loading, setLoading] = useState(Boolean(caseId));

  useEffect(() => {
    if (!caseId) {
      setCaseItem(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/cases?id=${encodeURIComponent(caseId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: { data?: CaseItem[] }) => {
        if (cancelled) return;
        const list = Array.isArray(json.data) ? json.data : [];
        setCaseItem(list[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setCaseItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return { caseItem, loading };
}
