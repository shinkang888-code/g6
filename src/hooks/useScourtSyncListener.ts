"use client";

import { useEffect } from "react";
import { subscribeScourtSync, type ScourtSyncPayload } from "@/lib/scourtSyncBridge";

export function useScourtSyncListener(
  onSync: (payload: ScourtSyncPayload) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    return subscribeScourtSync(onSync);
  }, [enabled, onSync]);
}
