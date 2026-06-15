"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle,
  Search,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  FileDown,
  FileUp,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ClientItem } from "@/lib/types";
import {
  loadClientsRaw,
  searchClientsIncludingDeleted,
  getClientById,
  saveClient,
  softDeleteClient,
  restoreClient,
} from "@/lib/clientStorage";
import {
  downloadClientExcelTemplate,
  exportClientsGuestlistToExcel,
  parseClientExcel,
  type ClientExcelValidationError,
} from "@/lib/clientExcel";
import { clientFromRow, buildClientsQueryString } from "@/lib/clientApi";
import type { ClientImportPlan } from "@/lib/clientImportServer";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportClientsToExcel } from "@/lib/listExcelExports";
import { ClientImportPreviewModal } from "@/components/clients/ClientImportPreviewModal";
import { ClientRelatedCases } from "@/components/clients/ClientRelatedCases";
import { usePageTabTitle } from "@/lib/tabTitle";

const PAGE_SIZE = 10;

function useCurrentUser(): { role: string; isAdmin: boolean } {
  const [user, setUser] = useState<{ role: string; isAdmin: boolean }>({ role: "직원", isAdmin: false });
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          const role = d.user.role || "직원";
          const permissions = d.user.permissions ?? [role];
          setUser({ role, isAdmin: permissions.includes("관리자") });
        }
      })
      .catch(() => {});
  }, []);
  return user;
}

export default function ClientsPage() {
  usePageTabTitle("고객관리");
  const { isAdmin } = useCurrentUser();
  const [list, setList] = useState<ClientItem[]>([]);
  const [useApi, setUseApi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredList, setFilteredList] = useState<ClientItem[]>([]);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<"add" | "edit" | null>(null);
  const [excelErrors, setExcelErrors] = useState<ClientExcelValidationError[]>([]);
  const [excelErrorModalOpen, setExcelErrorModalOpen] = useState(false);
  const [excelReplaceMode, setExcelReplaceMode] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [importConfirming, setImportConfirming] = useState(false);
  const [importPlan, setImportPlan] = useState<ClientImportPlan | null>(null);
  const [importIsGuestlist, setImportIsGuestlist] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [pendingImportName, setPendingImportName] = useState("");
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [sortKey, setSortKey] = useState<"name" | "address" | "guestCode" | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    mobile: "",
    email: "",
    address: "",
    guestCode: "",
    position: "",
    idNumber: "",
    bizNumber: "",
    memo: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildClientsQueryString({
        q: searchQuery.trim() || undefined,
        includeDeleted,
        pageSize: 500,
      });
      const res = await fetch(`/api/admin/clients${qs}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        const data = (json.data ?? []).map((r: Record<string, unknown>) => clientFromRow(r));
        setList(data);
        setUseApi(true);
      } else {
        setList(loadClientsRaw());
        setUseApi(false);
      }
    } catch {
      setList(loadClientsRaw());
      setUseApi(false);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, includeDeleted]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const base = useApi
      ? list
      : searchQuery.trim()
        ? searchClientsIncludingDeleted(searchQuery)
        : includeDeleted
          ? loadClientsRaw()
          : list;

    let data = useApi
      ? base
      : searchQuery.trim()
        ? base.filter((c) => {
            const q = searchQuery.trim().toLowerCase();
            const name = (c.name ?? "").toLowerCase();
            const phone = (c.phone ?? "").toLowerCase();
            const mobile = (c.mobile ?? "").toLowerCase();
            const email = (c.email ?? "").toLowerCase();
            const address = (c.address ?? "").toLowerCase();
            const guestCode = (c.guestCode ?? "").toLowerCase();
            const memo = (c.memo ?? "").toLowerCase();
            return (
              name.includes(q) ||
              phone.includes(q) ||
              mobile.includes(q) ||
              email.includes(q) ||
              address.includes(q) ||
              guestCode.includes(q) ||
              memo.includes(q)
            );
          })
        : base.filter((c) => (includeDeleted ? true : !c.deletedAt));

    if (sortKey) {
      const collator = new Intl.Collator("ko-KR");
      data = [...data].sort((a, b) => {
        const aVal =
          sortKey === "name" ? a.name : sortKey === "guestCode" ? a.guestCode : a.address;
        const bVal =
          sortKey === "name" ? b.name : sortKey === "guestCode" ? b.guestCode : b.address;
        return collator.compare(aVal ?? "", bVal ?? "");
      });
    }

    setFilteredList(data);
    setPage(1);
  }, [list, searchQuery, sortKey, includeDeleted, useApi]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const paginated = filteredList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const findClient = useCallback(
    (id: string) => (useApi ? list.find((c) => c.id === id) ?? null : getClientById(id)),
    [useApi, list]
  );

  const selected = selectedId ? findClient(selectedId) : null;

  const openAdd = () => {
    setForm({
      name: "",
      phone: "",
      mobile: "",
      email: "",
      address: "",
      guestCode: "",
      position: "",
      idNumber: "",
      bizNumber: "",
      memo: "",
    });
    setModalOpen("add");
  };

  const openEdit = (c: ClientItem) => {
    setSelectedId(c.id);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      mobile: c.mobile ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      guestCode: c.guestCode ?? "",
      position: c.position ?? "",
      idNumber: c.idNumber ?? "",
      bizNumber: c.bizNumber ?? "",
      memo: c.memo ?? "",
    });
    setModalOpen("edit");
  };

  const buildClientPayload = () => ({
    ...form,
    name: form.name.trim(),
    phone: form.phone.trim() || undefined,
    mobile: form.mobile.trim() || undefined,
    email: form.email.trim() || undefined,
    address: form.address.trim() || undefined,
    idNumber: form.idNumber.trim() || undefined,
    bizNumber: form.bizNumber.trim() || undefined,
    memo: form.memo.trim() || undefined,
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("의뢰인 이름을 입력하세요.");
      return;
    }
    const payload = buildClientPayload();

    if (useApi) {
      try {
        const isAdd = modalOpen === "add";
        const res = await fetch("/api/admin/clients", {
          method: isAdd ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(isAdd ? payload : { id: selectedId, ...payload }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "저장 실패");
        toast.success(isAdd ? "고객이 등록되었습니다." : "수정되었습니다.");
        await refresh();
        setModalOpen(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "저장 실패");
      }
      return;
    }

    if (modalOpen === "add") {
      saveClient(payload);
      toast.success("고객이 등록되었습니다.");
    } else if (selectedId) {
      saveClient({ id: selectedId, ...payload });
      toast.success("수정되었습니다.");
    }
    refresh();
    setModalOpen(null);
  };

  const handleSoftDelete = async () => {
    if (!selectedId) return;
    const client = findClient(selectedId);
    if (client?.deletedAt) return;

    if (useApi) {
      if (!confirm(`"${client?.name}" 고객을 삭제하시겠습니까?`)) return;
      try {
        const res = await fetch("/api/admin/clients", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: selectedId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "삭제 실패");
        toast.success("삭제되었습니다.");
        await refresh();
        setSelectedId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패");
      }
      return;
    }

    if (!confirm(`"${client?.name}" 고객을 삭제하시겠습니까?\n삭제된 항목은 목록에 표시되며, 관리자가 복구할 수 있습니다.`)) return;
    softDeleteClient(selectedId);
    toast.success("삭제되었습니다.");
    refresh();
    setSelectedId(null);
  };

  const handleRestore = async (id?: string) => {
    const targetId = id ?? selectedId;
    if (!targetId) return;
    if (!isAdmin) {
      toast.error("복구는 관리자만 가능합니다.");
      return;
    }

    if (useApi) {
      try {
        const res = await fetch("/api/admin/clients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: targetId, restore: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "복구 실패");
        toast.success("복구되었습니다.");
        await refresh();
        setSelectedId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "복구 실패");
      }
      return;
    }

    restoreClient(targetId);
    toast.success("복구되었습니다.");
    refresh();
    setSelectedId(null);
  };


  const handleExcelAddClick = () => {
    excelInputRef.current?.click();
  };

  const runImportConfirm = async () => {
    if (!pendingImportFile) return;
    setImportConfirming(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingImportFile);
      formData.append("replace", excelReplaceMode ? "true" : "false");
      const res = await fetch("/api/admin/clients/import-excel", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "등록 실패");
      toast.success(
        data.replaced
          ? `기존 데이터 삭제 후 ${data.count ?? 0}건 반영되었습니다.`
          : `${data.count ?? 0}건이 고객 목록에 추가되었습니다. (중복 ${(data.skippedDb ?? 0) + (data.skippedBatch ?? 0)}건 제외)`
      );
      setImportPreviewOpen(false);
      setPendingImportFile(null);
      setImportPlan(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "등록 실패");
    } finally {
      setImportConfirming(false);
    }
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
    if (excelReplaceMode && !confirm("기존 고객을 모두 삭제한 뒤 엑셀 내용으로 전량 반영합니다. 계속하시겠습니까?")) {
      return;
    }

    setPendingImportFile(file);
    setPendingImportName(file.name);
    setImportPreviewOpen(true);
    setImportPreviewLoading(true);
    setImportPlan(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/clients/import-preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setImportPlan(data.plan ?? null);
        setImportIsGuestlist(!!data.isGuestlist);
        setUseApi(true);
        return;
      }
      if (res.status !== 503) {
        toast.error(data.error || "미리보기 실패");
        setImportPreviewOpen(false);
        return;
      }
      toast.error("DB가 연결되지 않았습니다. 엑셀은 로컬에만 추가됩니다.");
      setImportPreviewOpen(false);
    } catch {
      toast.error("미리보기 요청에 실패했습니다.");
      setImportPreviewOpen(false);
    } finally {
      setImportPreviewLoading(false);
    }

    setExcelUploading(true);
    try {
      const result = await parseClientExcel(file);
      if (!result.valid) {
        setExcelErrors(result.errors);
        setExcelErrorModalOpen(true);
        return;
      }
      if (result.clients.length === 0) {
        toast.error("추가할 고객 행이 없습니다. 의뢰인(이름)이 있는 행만 추가됩니다.");
        return;
      }
      for (const row of result.clients) {
        saveClient(row);
      }
      refresh();
      toast.success(`${result.clients.length}명이 고객 목록에 추가되었습니다. (로컬)`);
    } finally {
      setExcelUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-5 p-5 max-w-5xl mx-auto"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <UserCircle size={26} className="text-primary-600" />
              고객관리
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              사건 등록 시 저장한 의뢰인(고객) 정보를 조회·등록·편집할 수 있습니다. 삭제는 소프트 삭제되며, 관리자는 복구할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 상단: 검색 + 액션 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2 w-full max-w-[240px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setPage(1)}
              placeholder="이름·연락처·이메일·주소 검색"
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
            />
            <Button type="button" variant="outline" size="sm" leftIcon={<Search size={14} />} onClick={() => refresh()}>
              검색
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded border-slate-300 text-primary-600"
            />
            삭제 포함
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" size="sm" leftIcon={<Plus size={14} />} onClick={openAdd}>
              등록
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Pencil size={14} />}
              disabled={!selected || !!selected.deletedAt}
              onClick={() => selected && openEdit(selected)}
            >
              편집
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-danger-600 hover:bg-danger-50 hover:border-danger-200"
              leftIcon={<Trash2 size={14} />}
              disabled={!selected || !!selected.deletedAt}
              onClick={handleSoftDelete}
            >
              삭제
            </Button>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={excelReplaceMode}
                onChange={(e) => setExcelReplaceMode(e.target.checked)}
                className="rounded border-slate-300 text-primary-600"
              />
              기존 고객 삭제 후 엑셀 전량 반영
            </label>
            <SearchResultExcelButton
              count={filteredList.filter((c) => !c.deletedAt).length}
              onExport={() => {
                const toExport = filteredList.filter((c) => !c.deletedAt);
                if (exportClientsToExcel(toExport)) {
                  toast.success(`${toExport.length}건을 엑셀로보냈습니다.`);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<FileDown size={14} />}
              onClick={() => {
                const toExport = filteredList.filter((c) => !c.deletedAt);
                if (toExport.length === 0) {
                  toast.error("보낼 고객이 없습니다.");
                  return;
                }
                exportClientsGuestlistToExcel(toExport);
                toast.success(`${toExport.length}건을 guestlist 형식으로보냈습니다.`);
              }}
            >
              guestlist보내기
            </Button>
            <Button type="button" variant="outline" size="sm" leftIcon={<FileDown size={14} />} onClick={downloadClientExcelTemplate}>
              양식
            </Button>
            <Button type="button" variant="outline" size="sm" leftIcon={<FileUp size={14} />} onClick={handleExcelAddClick} disabled={excelUploading}>
              {excelUploading ? "반영 중…" : "엑셀추가"}
            </Button>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelFileChange}
            />
            <span className="text-xs text-slate-500 hidden sm:inline">
              guestlist: 의뢰인명·이동전화·이메일·주소·고유번호 등
            </span>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-success-600 hover:bg-success-50 hover:border-success-200"
                leftIcon={<RotateCcw size={14} />}
                disabled={!selected || !selected?.deletedAt}
                onClick={() => handleRestore()}
              >
                복구
              </Button>
            )}
          </div>
        </div>

        <ClientImportPreviewModal
          open={importPreviewOpen}
          loading={importPreviewLoading}
          confirming={importConfirming}
          isGuestlist={importIsGuestlist}
          plan={importPlan}
          fileName={pendingImportName}
          onClose={() => {
            if (importConfirming) return;
            setImportPreviewOpen(false);
            setPendingImportFile(null);
            setImportPlan(null);
          }}
          onConfirm={runImportConfirm}
        />

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
                    아래 항목을 수정한 뒤 다시 엑셀 파일을 업로드해 주세요. 빈 행은 자동으로 무시됩니다.
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

        {/* 목록 테이블 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">의뢰인</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:table-cell">고유번호</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">연락처</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">이메일</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">주소</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-24">상태</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">액션</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      로딩 중…
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      {searchQuery.trim() ? "검색 결과가 없습니다." : "등록된 고객이 없습니다. 엑셀 전량 반영 또는 등록 버튼으로 추가하세요."}
                    </td>
                  </tr>
                ) : (
                  paginated.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "border-b border-slate-100 transition-colors cursor-pointer",
                        selectedId === c.id ? "bg-primary-50" : "hover:bg-slate-50",
                        c.deletedAt && "opacity-70 bg-slate-50/50"
                      )}
                    >
                      <td className="px-4 py-3">
                        {c.callMemoIds?.length ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const memoId = c.callMemoIds![0];
                              window.open(`/clients/call-memo/${memoId}`, "_blank", "noopener,noreferrer,width=560,height=520");
                            }}
                            className="font-medium text-primary-600 hover:text-primary-700 hover:underline text-left"
                            title="전화 메모 보기 (새 창)"
                          >
                            {c.name}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-800">{c.name}</span>
                        )}
                        {c.position && (
                          <span className="block text-xs text-slate-500">{c.position}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell font-mono text-xs">
                        {c.guestCode || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="md:hidden">{c.mobile || c.phone || "-"}</span>
                        <span className="hidden md:inline">
                          {[c.phone, c.mobile].filter(Boolean).join(" / ") || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell truncate max-w-[180px]">
                        {c.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell truncate max-w-[200px]" title={c.address}>
                        {c.address || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {c.deletedAt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                            삭제됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                            사용중
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {c.deletedAt ? (
                          isAdmin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              leftIcon={<RotateCcw size={12} />}
                              onClick={(e) => { e.stopPropagation(); handleRestore(c.id); }}
                            >
                              복구
                            </Button>
                          )
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            leftIcon={<Pencil size={12} />}
                            onClick={() => openEdit(c)}
                          >
                            편집
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 하단 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-50 border-t border-slate-200 flex-wrap">
              <div className="text-xs text-slate-500">
                {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredList.length)} / {filteredList.length}건
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>정렬:</span>
                <Button
                  type="button"
                  variant={sortKey === "name" ? "primary" : "outline"}
                  size="xs"
                  onClick={() => setSortKey((prev) => (prev === "name" ? null : "name"))}
                >
                  의뢰인
                </Button>
                <Button
                  type="button"
                  variant={sortKey === "address" ? "primary" : "outline"}
                  size="xs"
                  onClick={() => setSortKey((prev) => (prev === "address" ? null : "address"))}
                >
                  주소
                </Button>
                <Button
                  type="button"
                  variant={sortKey === "guestCode" ? "primary" : "outline"}
                  size="xs"
                  onClick={() => setSortKey((prev) => (prev === "guestCode" ? null : "guestCode"))}
                >
                  고유번호
                </Button>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                <Button
                  variant="outline"
                  size="xs"
                  leftIcon={<ChevronLeft size={14} />}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  이전
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => {
                    if (totalPages <= 7) return true;
                    if (n === 1 || n === totalPages) return true;
                    if (Math.abs(n - page) <= 1) return true;
                    return false;
                  })
                  .map((p, idx, arr) => (
                    <span key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-slate-400">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        className={cn(
                          "min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors",
                          page === p
                            ? "bg-primary-600 text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <Button
                  variant="outline"
                  size="xs"
                  rightIcon={<ChevronRight size={14} />}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </div>

        <ClientRelatedCases client={selected ?? null} useApi={useApi} />
      </motion.div>

      {/* 등록/편집 모달 */}
      {(modalOpen === "add" || modalOpen === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {modalOpen === "add" ? "고객 등록" : "고객 편집"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">의뢰인(고객) 이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="이름 또는 법인명"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">전화</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="02-1234-5678"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">휴대폰</label>
                  <input
                    type="text"
                    value={form.mobile}
                    onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                    placeholder="010-0000-0000"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">주소</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="주소"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">고유번호 (guestlist)</label>
                  <input
                    type="text"
                    value={form.guestCode}
                    onChange={(e) => setForm((f) => ({ ...f, guestCode: e.target.value }))}
                    placeholder="C202603090030"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">직위</label>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                    placeholder="대표, 이사 등"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">주민등록번호</label>
                  <input
                    type="text"
                    value={form.idNumber}
                    onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                    placeholder="선택"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">사업자번호</label>
                  <input
                    type="text"
                    value={form.bizNumber}
                    onChange={(e) => setForm((f) => ({ ...f, bizNumber: e.target.value }))}
                    placeholder="선택"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                  placeholder="비고"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 px-4 py-3 border-t border-slate-100">
              <Button size="sm" leftIcon={<Save size={14} />} onClick={handleSave}>
                저장
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModalOpen(null)}>
                취소
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
