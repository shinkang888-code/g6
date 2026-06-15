"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, Building2, Smartphone, Search, ChevronLeft, ChevronRight, FileDown, FileUp, AlertTriangle, X, Trash2, Users, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { StaffMember } from "@/lib/types";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { downloadStaffExcelTemplate, type ExcelValidationError } from "@/lib/staffExcel";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportStaffToExcel } from "@/lib/listExcelExports";

const PAGE_SIZE = 12;

export default function StaffPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [excelErrors, setExcelErrors] = useState<ExcelValidationError[]>([]);
  const [excelErrorModalOpen, setExcelErrorModalOpen] = useState(false);
  const [excelReplaceMode, setExcelReplaceMode] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [managementNumber, setManagementNumber] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const staffListRef = useRef<StaffMember[]>(staffList);
  const excelInputRef = useRef<HTMLInputElement>(null);
  staffListRef.current = staffList;

  /** 회원 관리에서 승인된 회원 목록을 새로고침 */
  const handleImportMembers = useCallback(() => {
    setSyncLoading(true);
    fetch(`/api/staff?t=${Date.now()}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { staff?: unknown[]; error?: string; managementNumber?: string };
        setStaffLoaded(true);
        if (data.managementNumber) setManagementNumber(data.managementNumber);
        if (res.status === 401) {
          toast.error(data?.error ?? "로그인이 필요합니다.");
          return;
        }
        const list = data?.staff != null && Array.isArray(data.staff) ? (data.staff as StaffMember[]) : [];
        setStaffList(list);
        if (data?.error) {
          toast.error(data.error);
        } else if (list.length === 0) {
          toast.info("승인된 회원이 없습니다.");
        } else {
          toast.success(`승인 회원 ${list.length}명을 불러왔습니다.`);
        }
      })
      .catch(() => {
        setStaffLoaded(true);
        toast.error("회원 목록을 가져오지 못했습니다. 네트워크를 확인하세요.");
      })
      .finally(() => setSyncLoading(false));
  }, []);

  const fetchStaffList = useCallback(() => {
    fetch("/api/staff", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { staff?: unknown[]; error?: string; managementNumber?: string };
        setStaffLoaded(true);
        if (data.managementNumber) setManagementNumber(data.managementNumber);
        const list = (data?.staff != null && Array.isArray(data.staff)) ? (data.staff as StaffMember[]) : [];
        setStaffList(list);
        if (res.status === 401) toast.error(data?.error ?? "로그인이 필요합니다.");
        else if (data?.error) toast.error(data.error);
      })
      .catch(() => {
        setStaffLoaded(true);
        setStaffList([]);
        toast.error("직원 목록을 불러오지 못했습니다. 네트워크를 확인하세요.");
      });
  }, []);

  // DB 직원 목록 로드 (승인된 회원 = 직원으로 동기화된 목록)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/staff", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { staff?: unknown[]; error?: string; managementNumber?: string };
        if (cancelled) return;
        setStaffLoaded(true);
        if (data.managementNumber) setManagementNumber(data.managementNumber);
        const list = (data?.staff != null && Array.isArray(data.staff)) ? (data.staff as StaffMember[]) : [];
        setStaffList(list);
        if (res.status === 401) toast.error(data?.error ?? "로그인이 필요합니다.");
        else if (data?.error) toast.error(data.error);
      })
      .catch(() => {
        if (!cancelled) setStaffLoaded(true);
        if (!cancelled) setStaffList([]);
      });
    return () => { cancelled = true; };
  }, []);

  // 다른 탭에서 회원 승인 후 돌아오면 목록 새로고침
  useEffect(() => {
    const onFocus = () => { fetchStaffList(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStaffList]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        (s.role && s.role.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.loginId && s.loginId.toLowerCase().includes(q))
    );
  }, [staffList, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredList.slice(start, start + PAGE_SIZE);
  }, [filteredList, currentPage]);

  useEffect(() => {
    setPage((p) => (p > totalPages ? Math.max(1, totalPages) : p));
  }, [totalPages]);

  const handleSearch = () => {
    setPage(1);
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "STAFF_ADD" && Array.isArray(e.data?.payload)) {
        const added = e.data.payload as StaffMember[];
        setStaffList((prev) => [...added, ...prev]);
        toast.success(`${added.length}명이 추가되었습니다.`);
      }
      if (e.data?.type === "STAFF_EDIT_GET_DATA" && e.source) {
        const target = e.source as Window;
        const list = staffListRef.current;
        setTimeout(() => {
          try {
            target.postMessage({ type: "STAFF_DATA", payload: list }, window.location.origin);
          } catch {}
        }, 50);
      }
      if (e.data?.type === "STAFF_UPDATE" && e.data?.payload) {
        const updated = e.data.payload as StaffMember;
        setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        toast.success("직원 정보가 수정되었습니다.");
      }
      if (e.data?.type === "STAFF_DELETE" && e.data?.payload) {
        const id = e.data.payload as string;
        setStaffList((prev) => prev.filter((s) => s.id !== id));
        toast.success("직원 목록에서 제외되었습니다.");
      }
      if (e.data?.type === "STAFF_REFRESH") {
        fetchStaffList();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchStaffList]);

  const openAddWindow = () => {
    const w = 520;
    const h = 720;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(
      "/staff/add",
      "staff-add",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
  };

  const handleExcelAddClick = () => {
    excelInputRef.current?.click();
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      toast.error("엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.");
      return;
    }
    if (excelReplaceMode && !confirm("기존 직원·회원(관리자 제외)을 모두 삭제한 뒤 엑셀 내용으로 전량 반영합니다. 계속하시겠습니까?")) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("replace", excelReplaceMode ? "true" : "false");

    setExcelUploading(true);
    try {
      const res = await fetch("/api/admin/members/import-excel", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errors = (data as { errors?: ExcelValidationError[] }).errors;
        if (errors && errors.length > 0) {
          setExcelErrors(errors);
          setExcelErrorModalOpen(true);
        } else {
          toast.error((data as { error?: string }).error ?? "엑셀 등록에 실패했습니다.");
        }
        return;
      }

      const created = (data as { created?: number }).created ?? 0;
      const updated = (data as { updated?: number }).updated ?? 0;
      const skipped = (data as { skipped?: number }).skipped ?? 0;
      const total = (data as { total?: number }).total ?? 0;
      const replaced = (data as { replaced?: boolean }).replaced;
      const format = (data as { format?: string }).format;
      const formatLabel = format === "lawtop" ? "LawTop 직원목록" : "회원목록";
      if (replaced) {
        toast.success(`기존 데이터 삭제 후 ${created + updated}명 반영되었습니다. (${formatLabel} ${total}행)`);
      } else if (created > 0 || updated > 0) {
        const parts = [
          created > 0 ? `신규 ${created}명` : null,
          updated > 0 ? `갱신 ${updated}명` : null,
          skipped > 0 ? `건너뜀 ${skipped}명` : null,
        ].filter(Boolean);
        toast.success(`${formatLabel}에서 ${parts.join(", ")} 처리되었습니다.`);
      } else {
        toast.info(`변경된 직원이 없습니다. (전체 ${total}행)`);
      }
      fetchStaffList();
    } catch {
      toast.error("엑셀 업로드 중 오류가 발생했습니다.");
    } finally {
      setExcelUploading(false);
    }
  };

  const openEditWindow = (staffId: string) => {
    try {
      sessionStorage.setItem(
        "lawygo_staff_edit_fallback",
        JSON.stringify({ id: staffId, list: staffListRef.current })
      );
    } catch {}
    const w = 520;
    const h = 640;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(
      `/staff/edit?id=${encodeURIComponent(staffId)}`,
      "staff-edit",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
  };

  const displayPhone = (s: StaffMember) => {
    if (s.companyPhone || s.personalPhone) {
      return [s.companyPhone, s.personalPhone].filter(Boolean).join(" / ");
    }
    return s.phone;
  };

  const handleDeleteStaff = async (staff: StaffMember) => {
    if (!confirm(`"${staff.name}"을(를) 직원에서 제외하시겠습니까?\n계정이 삭제되며, 해당 회원은 새 관리번호로 다시 가입할 수 있습니다.`)) return;
    setDeletingId(staff.id);
    try {
      const res = await fetch("/api/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: staff.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "제외 처리에 실패했습니다.");
        return;
      }
      setStaffList((prev) => prev.filter((s) => s.id !== staff.id));
      toast.success(data.message ?? "직원에서 제외했습니다. 새 관리번호로 재가입할 수 있습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "제외 처리에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">직원 관리</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {!staffLoaded ? "로딩 중…" : (
              <>
                {managementNumber ? `회사코드 ${managementNumber} · ` : ""}
                전체 {staffList.length}명
                {searchQuery.trim() && ` · 검색 ${filteredList.length}명`}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchResultExcelButton
            label="직원목록 엑셀"
            count={filteredList.length}
            emptyMessage="보낼 직원 목록이 없습니다."
            onExport={() => {
              if (exportStaffToExcel(filteredList)) {
                toast.success(`${filteredList.length}명을 엑셀로보냈습니다.`);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FileDown size={14} />}
            onClick={() => {
              downloadStaffExcelTemplate();
              toast.success("직원/회원목록 양식 파일이 다운로드되었습니다.");
            }}
            title="회원목록과 동일한 형식의 빈 양식"
          >
            양식 다운로드
          </Button>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={excelReplaceMode}
              onChange={(e) => setExcelReplaceMode(e.target.checked)}
              className="rounded border-slate-300 text-primary-600"
            />
            기존 직원 삭제 후 엑셀 전량 반영
          </label>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcelFileChange}
          />
          <Button size="sm" variant="outline" leftIcon={<FileUp size={14} />} onClick={handleExcelAddClick} disabled={excelUploading}>
            {excelUploading ? "반영 중…" : "엑셀 추가"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Users size={14} />}
            onClick={handleImportMembers}
            disabled={syncLoading}
            title="회원 관리에서 승인된 회원 목록을 새로고침"
          >
            {syncLoading ? "불러오는 중…" : "회원 새로고침"}
          </Button>
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={openAddWindow}>
            직원 추가
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {excelErrorModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExcelErrorModalOpen(false)}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ pointerEvents: "none" }}
            >
              <div
                className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md max-h-[80vh] overflow-hidden"
                style={{ pointerEvents: "auto" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-amber-50">
                  <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-800">엑셀 입력 오류</h3>
                  <button
                    type="button"
                    onClick={() => setExcelErrorModalOpen(false)}
                    className="ml-auto p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    aria-label="닫기"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="px-5 pt-3 text-xs text-slate-600">
                  아래 항목을 수정한 뒤 다시 엑셀 파일을 업로드해 주세요. 오류가 있는 행은 추가되지 않습니다.
                </p>
                <div className="p-5 overflow-y-auto max-h-[50vh] space-y-2">
                  {excelErrors.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-slate-500 shrink-0">
                        {err.row > 0 ? `${err.row}행` : "파일"}
                      </span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 pb-5">
                  <Button size="sm" className="w-full" onClick={() => setExcelErrorModalOpen(false)}>
                    확인
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="이름, 부서, 역할, 이메일로 검색"
          className="flex-1 min-w-[200px] max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
        />
        <Button size="sm" variant="outline" leftIcon={<Search size={14} />} onClick={handleSearch}>
          검색
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!staffLoaded ? (
          <div className="col-span-full text-center py-12 text-text-muted text-sm">직원 목록을 불러오는 중입니다.</div>
        ) : paginatedList.length === 0 ? (
          <div className="col-span-full text-center py-12 text-text-muted text-sm">
            {searchQuery.trim() ? (
              "검색 결과가 없습니다."
            ) : (
              <>
                <p>승인된 회원이 없습니다.</p>
                <p className="mt-1 text-xs">회원 관리에서 회원을 승인하면 이 목록에 자동으로 표시됩니다.</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => fetchStaffList()} disabled={syncLoading}>
                  새로고침
                </Button>
              </>
            )}
          </div>
        ) : paginatedList.map((staff, i) => (
          <motion.div
            key={staff.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onDoubleClick={() => openEditWindow(staff.id)}
            className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover:shadow-card-hover transition-all hover:-translate-y-0.5 cursor-pointer"
            title="더블클릭 시 직원 정보 편집"
          >
            <div className="flex items-start gap-4">
              <Avatar name={staff.name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <h3 className="text-base font-bold text-slate-900 truncate min-w-0" title={staff.name}>{staff.name}</h3>
                    {staff.role && (
                      <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 shrink-0">{staff.role}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-slate-600 hover:text-primary-700"
                      leftIcon={<Pencil size={14} />}
                      onClick={(e) => { e.stopPropagation(); openEditWindow(staff.id); }}
                      aria-label="직원 수정"
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                      leftIcon={<Trash2 size={14} />}
                      onClick={(e) => { e.stopPropagation(); handleDeleteStaff(staff); }}
                      disabled={deletingId === String(staff.id)}
                      aria-label="직원 삭제"
                    >
                      삭제
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-text-muted mt-0.5">{staff.department}</div>
                {staff.loginId && (
                  <div className="text-xs text-slate-500 mt-0.5">로그인: {staff.loginId}</div>
                )}
                <div className="flex flex-col gap-1 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Mail size={11} /> {staff.email}
                  </div>
                  {(staff.companyPhone || staff.personalPhone) ? (
                    <>
                      {staff.companyPhone && (
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                          <Building2 size={11} /> {staff.companyPhone}
                        </div>
                      )}
                      {staff.personalPhone && (
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                          <Smartphone size={11} /> {staff.personalPhone}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Phone size={11} /> {staff.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {staffLoaded && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ChevronLeft size={14} />}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            이전
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => {
                if (totalPages <= 7) return true;
                if (n === 1 || n === totalPages) return true;
                if (Math.abs(n - currentPage) <= 1) return true;
                return false;
              })
              .map((n, idx, arr) => (
                <span key={n}>
                  {idx > 0 && arr[idx - 1] !== n - 1 && (
                    <span className="px-1.5 text-slate-400">…</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPage(n)}
                    className={cn(
                      "min-w-[2rem] h-8 px-2 rounded-lg text-sm font-medium transition-colors",
                      n === currentPage
                        ? "bg-primary-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {n}
                  </button>
                </span>
              ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            rightIcon={<ChevronRight size={14} />}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            다음
          </Button>
          <span className="text-xs text-text-muted ml-2">
            {currentPage} / {totalPages} 페이지
          </span>
        </div>
      )}
    </div>
  );
}
