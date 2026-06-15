"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Scale, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-20 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md"
      >
        {/* Icon */}
        <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Scale size={36} className="text-primary-600" />
        </div>

        {/* 404 */}
        <div className="text-8xl font-black text-slate-100 leading-none mb-4 select-none">
          404
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
          <br />
          사건번호나 메뉴를 통해 다시 접근해 보세요.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <Button leftIcon={<Home size={14} />}>
              대시보드로 이동
            </Button>
          </Link>
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={14} />}
            onClick={() => window.history.back()}
          >
            이전 페이지
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
