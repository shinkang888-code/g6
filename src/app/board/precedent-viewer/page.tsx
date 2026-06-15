import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PrecedentViewerClient } from "@/components/board/ai/PrecedentViewerClient";

function LoadingFallback() {
  return (
    <div className="h-[100dvh] flex items-center justify-center bg-slate-100 text-slate-500 text-sm gap-2">
      <Loader2 size={18} className="animate-spin" />
      판례 뷰어 준비 중…
    </div>
  );
}

export default function PrecedentViewerPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PrecedentViewerClient />
    </Suspense>
  );
}
