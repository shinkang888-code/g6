"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-20 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md"
      >
        <div className="w-20 h-20 bg-danger-100 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
          <AlertTriangle size={36} className="text-danger-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          오류가 발생했습니다
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-3">
          페이지를 불러오는 중 예상치 못한 오류가 발생했습니다.
        </p>

        {error?.message && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl px-4 py-3 mb-6 text-left">
            <p className="text-xs font-mono text-danger-700 break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="primary"
            leftIcon={<RefreshCw size={14} />}
            onClick={reset}
          >
            다시 시도
          </Button>
          <Link href="/">
            <Button variant="outline" leftIcon={<Home size={14} />}>
              대시보드
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
