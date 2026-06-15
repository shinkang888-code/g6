// filepath: src/app/admin/materials/page.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, HardDrive } from "lucide-react";
import { MaterialsManager } from "@/components/admin/MaterialsManager";
import { usePageTabTitle } from "@/lib/tabTitle";

export default function AdminMaterialsPage() {
  usePageTabTitle("자료관리");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          관리 대시보드
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <HardDrive size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900">자료관리</h1>
        </div>
        <p className="text-sm text-text-muted mt-1">
          Google Drive에 저장된 회사·사건·백과 자료를 검색·업로드·이름변경·다운로드·삭제합니다.
        </p>
      </div>

      <MaterialsManager />
    </div>
  );
}
