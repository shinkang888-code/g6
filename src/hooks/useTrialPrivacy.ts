"use client";

import { useCallback } from "react";
import { maskPersonName } from "@/lib/trialNameMask";
import { useTrialTenant } from "@/hooks/useTrialTenant";

/** 체험판 테넌트에서 화면 표시용 이름 마스킹 */
export function useTrialPrivacy() {
  const { isTrial, loading, managementNumber } = useTrialTenant();

  const maskName = useCallback(
    (name?: string | null) => {
      const value = String(name ?? "").trim();
      if (!value) return "";
      if (!isTrial) return value;
      return maskPersonName(value);
    },
    [isTrial]
  );

  return { isTrial, loading, managementNumber, maskName };
}
