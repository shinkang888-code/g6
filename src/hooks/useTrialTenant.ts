"use client";

import { useEffect, useState } from "react";
import { isTrialManagementNumber } from "@/lib/trialTenant";

export function useTrialTenant(): { isTrial: boolean; loading: boolean; managementNumber: string | null } {
  const [managementNumber, setManagementNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((json: { user?: { managementNumber?: string } | null }) => {
        if (cancelled) return;
        setManagementNumber(json.user?.managementNumber ?? null);
      })
      .catch(() => {
        if (!cancelled) setManagementNumber(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isTrial: isTrialManagementNumber(managementNumber),
    loading,
    managementNumber,
  };
}
