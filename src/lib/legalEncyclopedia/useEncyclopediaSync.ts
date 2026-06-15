// filepath: src/lib/legalEncyclopedia/useEncyclopediaSync.ts
"use client";

import { useCallback } from "react";
import { toast } from "@/components/ui/toast";
import type { SourceFeatureId } from "./adapters/featureAdapters";

export function useEncyclopediaSync(projectId: string | null) {
  const syncToEncyclopedia = useCallback(
    async (featureId: SourceFeatureId, payload: Record<string, unknown>) => {
      if (!projectId) {
        toast.error("먼저 프로젝트(의뢰인·사건)를 선택하세요.");
        return null;
      }
      try {
        const res = await fetch("/api/ai/legal-encyclopedia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "sync_from_feature",
            projectId,
            featureId,
            payload,
            saveToDrive: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "백과 저장 실패");
        toast.success(data.message ?? "백과에 저장되었습니다.");
        return data as {
          vectorCount: number;
          driveFileId: string | null;
          artifactId: string;
        };
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "백과 저장 오류");
        return null;
      }
    },
    [projectId]
  );

  return { syncToEncyclopedia, canSync: Boolean(projectId) };
}
