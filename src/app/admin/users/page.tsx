"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserManagementClient } from "@/components/admin/UserManagementClient";

export default function AdminUsersPage() {
  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-4">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary-600">
        <ArrowLeft size={14} />
        관리 대시보드
      </Link>
      <UserManagementClient />
    </div>
  );
}
