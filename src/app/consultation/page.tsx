"use client";

import { useState, useMemo, useEffect } from "react";
import { usePageTabTitle } from "@/lib/tabTitle";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageSquare,
  CalendarDays,
  List,
  Building2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  User,
  Phone,
  Save,
  Search,
} from "lucide-react";
import {
  fetchConsultations,
  createConsultationApi,
  updateConsultationApi,
  deleteConsultationApi,
  fetchConsultationRooms,
  createConsultationRoomApi,
  updateConsultationRoomApi,
  deleteConsultationRoomApi,
} from "@/lib/consultationClient";
import { mockConsultations, mockConsultationRooms, mockCases, mockStaff } from "@/lib/mockData";
import {
  trialSampleCases,
  trialSampleConsultations,
  trialSampleConsultationRooms,
  trialSampleStaff,
} from "@/lib/trialSampleData";
import { useTrialTenant } from "@/hooks/useTrialTenant";
import {
  loadCallMemos,
  searchCallMemos,
  saveCallMemo,
  softDeleteCallMemo,
  getCallMemoById,
  loadCallMemoTemplates,
  type CallMemoItem,
  type CallMemoTemplate,
} from "@/lib/callMemoStorage";
import { CallMemoTemplatePanel } from "@/components/consultation/CallMemoTemplatePanel";
import { findClientByNameAndPhone, saveClient } from "@/lib/clientStorage";
import type { ConsultationItem, ConsultationRoom, ConsultationStatus, ConsultationConsultant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportCallMemosSearchResult } from "@/lib/listExcelExports";

// 09:00 ~ 21:00, 30분 단위 (25개 슬롯)
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = 9 + Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});
const STATUS_LABEL: Record<ConsultationStatus, string> = {
  scheduled: "예약",
  notified: "통지완료",
  completed: "상담완료",
  cancelled: "예약취소",
};
const IMPORTANCE_LABEL = { high: "높음", medium: "보통", low: "낮음" };

function getConsultationsForSlot(
  list: ConsultationItem[],
  date: string,
  roomId: string,
  slotStart: string
) {
  const [sh, sm] = slotStart.split(":").map(Number);
  const slotEndMin = sh * 60 + sm + 30;
  const slotEnd = `${String(Math.floor(slotEndMin / 60)).padStart(2, "0")}:${String(slotEndMin % 60).padStart(2, "0")}`;
  return list.filter(
    (c) =>
      c.consultationDate === date &&
      c.roomId === roomId &&
      c.status !== "cancelled" &&
      c.startTime < slotEnd &&
      c.endTime > slotStart
  );
}

function getConsultantNames(c: ConsultationItem): string[] {
  if (c.consultants?.length) return c.consultants.map((x) => x.name).filter(Boolean);
  if (c.consultantName) return [c.consultantName];
  return [];
}

function isConsultantMatch(names: string[], query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return names.some((n) => n.includes(q) || q.includes(n));
}

const MY_HIGHLIGHT_COLORS = [
  { id: "red" as const, label: "빨강", bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
  { id: "orange" as const, label: "주황", bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  { id: "green" as const, label: "초록", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  { id: "blue" as const, label: "파랑", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  { id: "purple" as const, label: "보라", bg: "bg-violet-100", text: "text-violet-800", border: "border-violet-300" },
] as const;
type MyHighlightColorId = (typeof MY_HIGHLIGHT_COLORS)[number]["id"];

export default function ConsultationPage() {
  usePageTabTitle("상담관리");
  const { isTrial } = useTrialTenant();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const [activeTab, setActiveTab] = useState<"schedule" | "list" | "rooms">("schedule");
  const [viewDate, setViewDate] = useState(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) setViewDate(dateParam);
  }, [dateParam]);
  const [consultations, setConsultations] = useState<ConsultationItem[]>(
    isTrial ? trialSampleConsultations : mockConsultations
  );
  const [rooms, setRooms] = useState<ConsultationRoom[]>(
    isTrial ? trialSampleConsultationRooms : mockConsultationRooms
  );

  useEffect(() => {
    if (isTrial) {
      setConsultations(trialSampleConsultations);
      setRooms(trialSampleConsultationRooms);
      return;
    }
    void (async () => {
      try {
        const [items, roomItems] = await Promise.all([
          fetchConsultations(),
          fetchConsultationRooms(),
        ]);
        if (items.length > 0) setConsultations(items);
        else setConsultations(mockConsultations);
        if (roomItems.length > 0) setRooms(roomItems);
        else setRooms(mockConsultationRooms);
      } catch {
        setConsultations(mockConsultations);
        setRooms(mockConsultationRooms);
      }
    })();
  }, [isTrial]);

  const linkCases = isTrial ? trialSampleCases : mockCases;
  const linkStaff = isTrial ? trialSampleStaff : mockStaff;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ConsultationItem | null>(null);
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ConsultationRoom | null>(null);
  const [formInitial, setFormInitial] = useState<Partial<ConsultationItem> | null>(null);
  /** 로그인한 본인 이름 (상담자에 포함되면 선택한 색으로 강조) */
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  /** 상담자 이름 검색어 (입력 시 해당 이름 포함된 예약은 파란색으로 강조) */
  const [counselorSearch, setCounselorSearch] = useState("");
  /** 본인 상담 강조 색 */
  const [myHighlightColorId, setMyHighlightColorId] = useState<MyHighlightColorId>("red");

  /** 콜센터 게시판 */
  const [callMemos, setCallMemos] = useState<CallMemoItem[]>([]);
  const [selectedCallMemoId, setSelectedCallMemoId] = useState<string | null>(null);
  const [callForm, setCallForm] = useState({ title: "", callerName: "", phone: "", content: "" });
  const [callTemplates, setCallTemplates] = useState<CallMemoTemplate[]>([]);
  const [callMemoSearchQuery, setCallMemoSearchQuery] = useState("");
  const [callMemoMonth, setCallMemoMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [callMemoPage, setCallMemoPage] = useState(1);
  const CALL_MEMOS_PER_PAGE = 5;

  const refreshCallMemos = () => {
    setCallMemos(loadCallMemos());
  };
  const refreshCallTemplates = () => {
    setCallTemplates(loadCallMemoTemplates());
  };

  // 검색 → 월별 그룹 → 해당 월 메모 5개씩 페이지네이션
  const callMemoSearched = useMemo(() => searchCallMemos(callMemoSearchQuery), [callMemos, callMemoSearchQuery]);
  const callMemoMonths = useMemo(() => {
    const map = new Map<string, CallMemoItem[]>();
    for (const m of callMemoSearched) {
      const dt = new Date(m.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, items]) => ({ month, items: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }));
  }, [callMemoSearched]);
  const currentMonthData = useMemo(
    () => callMemoMonths.find((x) => x.month === callMemoMonth),
    [callMemoMonths, callMemoMonth]
  );
  const currentMonthMemos = currentMonthData?.items ?? [];
  const callMemoTotalPages = Math.max(1, Math.ceil(currentMonthMemos.length / CALL_MEMOS_PER_PAGE));
  const callMemoPageSafe = Math.min(callMemoPage, callMemoTotalPages);
  const callMemoPaginated = useMemo(
    () => currentMonthMemos.slice((callMemoPageSafe - 1) * CALL_MEMOS_PER_PAGE, callMemoPageSafe * CALL_MEMOS_PER_PAGE),
    [currentMonthMemos, callMemoPageSafe]
  );

  useEffect(() => {
    refreshCallMemos();
    refreshCallTemplates();
  }, []);

  useEffect(() => {
    setCallMemoPage(1);
  }, [callMemoMonth, callMemoSearchQuery]);

  useEffect(() => {
    if (callMemoMonths.length > 0 && !callMemoMonths.some((x) => x.month === callMemoMonth)) {
      setCallMemoMonth(callMemoMonths[0].month);
    }
  }, [callMemoMonths, callMemoMonth]);

  const selectCallMemoForEdit = (m: CallMemoItem) => {
    setSelectedCallMemoId(m.id);
    setCallForm({ title: m.title, callerName: m.callerName, phone: m.phone, content: m.content });
  };

  const handleCallMemoRegister = () => {
    if (!callForm.title.trim()) {
      toast.error("제목을 입력하세요.");
      return;
    }
    const saved = saveCallMemo({
      title: callForm.title.trim(),
      callerName: callForm.callerName.trim(),
      phone: callForm.phone.trim(),
      content: callForm.content.trim(),
    });
    // 고객관리 게시판에 연동: 이름·연락처로 고객 찾거나 생성 후 메모 ID 연결
    if (saved.callerName.trim()) {
      const existing = findClientByNameAndPhone(saved.callerName, saved.phone);
      const memoIds = [saved.id, ...(existing?.callMemoIds ?? [])];
      if (existing) {
        saveClient({ ...existing, callMemoIds: memoIds });
      } else {
        saveClient({ name: saved.callerName, phone: saved.phone, mobile: saved.phone, memo: "", callMemoIds: [saved.id] });
      }
    }
    refreshCallMemos();
    setCallForm({ title: "", callerName: "", phone: "", content: "" });
    setSelectedCallMemoId(null);
    toast.success("전화 메모가 등록되었습니다. 고객관리 게시판에 연동되었습니다.");
  };

  const handleCallMemoEdit = () => {
    if (!selectedCallMemoId) return;
    if (!callForm.title.trim()) {
      toast.error("제목을 입력하세요.");
      return;
    }
    const saved = saveCallMemo({
      id: selectedCallMemoId,
      title: callForm.title.trim(),
      callerName: callForm.callerName.trim(),
      phone: callForm.phone.trim(),
      content: callForm.content.trim(),
    });
    // 고객관리 연동 갱신
    if (saved.callerName.trim()) {
      const existing = findClientByNameAndPhone(saved.callerName, saved.phone);
      const memoIds = existing?.callMemoIds?.includes(saved.id)
        ? existing.callMemoIds!
        : [saved.id, ...(existing?.callMemoIds ?? [])];
      if (existing) {
        saveClient({ ...existing, callMemoIds: memoIds });
      } else {
        saveClient({ name: saved.callerName, phone: saved.phone, mobile: saved.phone, memo: "", callMemoIds: [saved.id] });
      }
    }
    refreshCallMemos();
    toast.success("수정되었습니다.");
  };

  const handleCallMemoDelete = () => {
    if (!selectedCallMemoId) return;
    if (!confirm("이 전화 메모를 삭제하시겠습니까? (목록에서만 숨겨집니다.)")) return;
    softDeleteCallMemo(selectedCallMemoId);
    refreshCallMemos();
    setSelectedCallMemoId(null);
    setCallForm({ title: "", callerName: "", phone: "", content: "" });
    toast.success("삭제되었습니다.");
  };

  const applyCallTemplate = (t: CallMemoTemplate) => {
    setCallForm((p) => ({ ...p, title: p.title || t.title, content: t.content }));
    toast.success(`"${t.title}" 양식을 불러왔습니다.`);
  };

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d?.user?.name && setCurrentUserName(d.user.name));
  }, []);

  const prevDay = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() - 1);
    setViewDate(d.toISOString().split("T")[0]);
  };
  const nextDay = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + 1);
    setViewDate(d.toISOString().split("T")[0]);
  };
  const goToday = () => {
    const d = new Date();
    setViewDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  const handleSaveConsultation = async (payload: Partial<ConsultationItem>) => {
    const consultants = payload.consultants?.length ? payload.consultants : (payload.consultantId ? [{ id: payload.consultantId, name: payload.consultantName ?? "" }] : undefined);
    const clientNames = payload.clientNames?.length ? payload.clientNames : (payload.clientName ? [payload.clientName] : undefined);
    const normalized = { ...payload, consultants, clientNames, consultantId: consultants?.[0]?.id ?? payload.consultantId ?? "", consultantName: consultants?.[0]?.name ?? payload.consultantName ?? "", clientName: clientNames?.[0] ?? payload.clientName ?? "" };

    if (isTrial) {
      if (editing) {
        setConsultations((prev) =>
          prev.map((c) =>
            c.id === editing.id
              ? { ...c, ...normalized, updatedAt: new Date().toISOString(), consultantId: normalized.consultantId ?? c.consultantId, consultantName: normalized.consultantName ?? c.consultantName, clientName: normalized.clientName ?? c.clientName }
              : c
          )
        );
        toast.success("상담이 수정되었습니다.");
      } else {
        const newId = "con-" + Date.now();
        const room = rooms.find((r) => r.id === payload.roomId);
        setConsultations((prev) => [
          ...prev,
          {
            id: newId,
            consultationDate: payload.consultationDate!,
            startTime: payload.startTime!,
            endTime: payload.endTime!,
            roomId: payload.roomId!,
            roomName: room?.name ?? "",
            consultantId: consultants?.[0]?.id ?? payload.consultantId!,
            consultantName: consultants?.[0]?.name ?? payload.consultantName ?? "",
            consultants,
            clientName: clientNames?.[0] ?? payload.clientName ?? "",
            clientNames,
            purpose: payload.purpose ?? "",
            importance: payload.importance ?? "medium",
            status: (payload.status as ConsultationStatus) ?? "scheduled",
            caseId: payload.caseId,
            caseNumber: payload.caseNumber,
            notes: payload.notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as ConsultationItem,
        ]);
        toast.success("상담이 등록되었습니다.");
      }
      setFormOpen(false);
      setEditing(null);
      return;
    }

    try {
      const room = rooms.find((r) => r.id === payload.roomId);
      const body = { ...normalized, roomName: room?.name ?? normalized.roomName ?? "" };
      if (editing) {
        const updated = await updateConsultationApi(editing.id, body);
        setConsultations((prev) => prev.map((c) => (c.id === editing.id ? updated : c)));
        toast.success("상담이 수정되었습니다.");
      } else {
        const created = await createConsultationApi(body);
        setConsultations((prev) => [...prev, created]);
        toast.success("상담이 등록되었습니다.");
      }
      setFormOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const handleDeleteConsultation = async (id: string) => {
    if (!confirm("이 상담을 삭제하시겠습니까?")) return;
    if (isTrial) {
      setConsultations((prev) => prev.filter((c) => c.id !== id));
      toast.success("삭제되었습니다.");
      setFormOpen(false);
      setEditing(null);
      return;
    }
    try {
      await deleteConsultationApi(id);
      setConsultations((prev) => prev.filter((c) => c.id !== id));
      toast.success("삭제되었습니다.");
      setFormOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  };

  const handleSaveRoom = async (payload: Partial<ConsultationRoom>) => {
    if (isTrial) {
      if (editingRoom) {
        setRooms((prev) =>
          prev.map((r) => (r.id === editingRoom.id ? { ...r, ...payload } : r))
        );
        toast.success("상담실이 수정되었습니다.");
      } else {
        const newId = "r" + (rooms.length + 1);
        setRooms((prev) => [
          ...prev,
          {
            id: newId,
            name: payload.name ?? "",
            sortOrder: payload.sortOrder ?? prev.length,
            remarks: payload.remarks,
          },
        ]);
        toast.success("상담실이 등록되었습니다.");
      }
      setRoomFormOpen(false);
      setEditingRoom(null);
      return;
    }
    try {
      if (editingRoom) {
        const updated = await updateConsultationRoomApi(editingRoom.id, payload);
        setRooms((prev) => prev.map((r) => (r.id === editingRoom.id ? updated : r)));
        toast.success("상담실이 수정되었습니다.");
      } else {
        const created = await createConsultationRoomApi(payload);
        setRooms((prev) => [...prev, created]);
        toast.success("상담실이 등록되었습니다.");
      }
      setRoomFormOpen(false);
      setEditingRoom(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const handleDeleteRoom = async (id: string) => {
    const used = consultations.some((c) => c.roomId === id);
    if (used && !confirm("이 상담실을 삭제하면 해당 상담 기록도 함께 삭제됩니다. 계속하시겠습니까?")) return;
    if (isTrial) {
      if (used) setConsultations((prev) => prev.filter((c) => c.roomId !== id));
      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success("삭제되었습니다.");
      setEditingRoom(null);
      return;
    }
    try {
      await deleteConsultationRoomApi(id);
      if (used) setConsultations((prev) => prev.filter((c) => c.roomId !== id));
      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success("삭제되었습니다.");
      setEditingRoom(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  };

  const tabs = [
    { id: "schedule" as const, label: "예약 스케줄", icon: CalendarDays },
    { id: "list" as const, label: "상담 목록", icon: List },
    { id: "rooms" as const, label: "상담실 등록/편집", icon: Building2 },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare size={26} className="text-primary-600" />
            상담관리
          </h1>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === tab.id ? "bg-white text-primary-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 스케줄 탭 */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 py-2 px-3 rounded-xl bg-slate-50/80 border border-slate-200">
              <div className="flex items-center gap-2">
                <button onClick={prevDay} className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 bg-white">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={goToday} className="text-sm font-medium text-primary-600 hover:underline px-2">
                  금일
                </button>
                <button onClick={nextDay} className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 bg-white">
                  <ChevronRight size={18} />
                </button>
                <span className="text-sm font-medium text-slate-700 ml-2">{viewDate}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {MY_HIGHLIGHT_COLORS.map(({ id, label, bg }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setMyHighlightColorId(id)}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 transition-all",
                          myHighlightColorId === id ? "border-slate-800 ring-1 ring-slate-400" : "border-slate-200 hover:border-slate-400",
                          bg
                        )}
                        title={label}
                        aria-label={label}
                      />
                    ))}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                <input
                  type="text"
                  value={counselorSearch}
                  onChange={(e) => setCounselorSearch(e.target.value)}
                  placeholder="상담자 이름"
                  className="w-32 sm:w-40 px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 bg-white"
                  aria-label="상담자 검색"
                />
              </div>
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => { setEditing(null); setFormOpen(true); }}>
                상담 등록
              </Button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-600 w-40">상담실</th>
                    {TIME_SLOTS.map((t) => (
                      <th key={t} className="text-center py-2 px-0.5 text-2xs text-slate-500 w-12">
                        {t.slice(0, 2)}시
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-b border-slate-100">
                      <td className="py-2 px-3 text-sm font-medium text-slate-800 sticky left-0 bg-white">
                        {room.name}
                      </td>
                      {TIME_SLOTS.map((slot) => {
                        const items = getConsultationsForSlot(consultations, viewDate, room.id, slot);
                        const cell = items[0];
                        const consultantNames = cell ? getConsultantNames(cell) : [];
                        const isMine = !!currentUserName && isConsultantMatch(consultantNames, currentUserName);
                        const isSearchMatch = !!cell && isConsultantMatch(consultantNames, counselorSearch);
                        const myColor = MY_HIGHLIGHT_COLORS.find((x) => x.id === myHighlightColorId);
                        const cellBg = cell
                          ? isMine && myColor
                            ? myColor.bg
                            : isSearchMatch
                              ? "bg-primary-100"
                              : "bg-warning-50"
                          : "bg-success-50/50 hover:bg-success-100/70 cursor-pointer";
                        const cellText = cell
                          ? isMine && myColor
                            ? myColor.text
                            : isSearchMatch
                              ? "text-primary-800"
                              : "text-warning-800"
                          : "";
                        return (
                          <td
                            key={slot}
                            className={cn(
                              "p-0.5 h-10 border-l border-slate-100 align-top",
                              cellBg
                            )}
                            onDoubleClick={() => {
                              if (!cell) {
                                const next = TIME_SLOTS.indexOf(slot) + 1;
                                const endSlot = TIME_SLOTS[next] ?? "21:30";
                                setFormInitial({
                                  consultationDate: viewDate,
                                  startTime: slot,
                                  endTime: endSlot,
                                  roomId: room.id,
                                  roomName: room.name,
                                  consultantId: linkStaff[0]?.id,
                                  consultantName: linkStaff[0]?.name,
                                });
                                setEditing(null);
                                setFormOpen(true);
                              }
                            }}
                            onClick={() => {
                              if (cell) {
                                setEditing(cell);
                                setFormOpen(true);
                              }
                            }}
                          >
                            {cell && (
                              <div
                                className={cn("text-2xs truncate px-0.5 font-medium", cellText)}
                                title={`방문: ${(cell.clientNames?.length ? cell.clientNames : (cell.clientName ? [cell.clientName] : [])).join(", ")} · 담당: ${consultantNames.join(", ")}${cell.purpose ? ` · ${cell.purpose}` : ""}`}
                              >
                                {(cell.clientNames?.length ? cell.clientNames : (cell.clientName ? [cell.clientName] : [])).join(", ")}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 상담 목록 탭 */}
        {activeTab === "list" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => { setFormInitial(null); setEditing(null); setFormOpen(true); }}>
                상담 등록
              </Button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/70 text-xs text-text-muted font-medium border-b border-slate-100">
                      <th className="text-left px-5 py-3">일시</th>
                      <th className="text-left px-5 py-3">상담실</th>
                      <th className="text-left px-5 py-3">담당</th>
                      <th className="text-left px-5 py-3">내담자/용건</th>
                      <th className="text-left px-5 py-3">상태</th>
                      <th className="text-left px-5 py-3">연관 사건</th>
                      <th className="text-right px-5 py-3 w-20">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...consultations]
                      .filter((c) => c.status !== "cancelled")
                      .sort((a, b) => `${a.consultationDate}${a.startTime}`.localeCompare(`${b.consultationDate}${b.startTime}`))
                      .map((c) => (
                        <tr key={c.id} className="border-t border-slate-50 text-sm hover:bg-slate-50/50">
                          <td className="px-5 py-3 tabular-nums">{c.consultationDate} {c.startTime}-{c.endTime}</td>
                          <td className="px-5 py-3">{c.roomName}</td>
                          <td className="px-5 py-3 text-slate-800">
                            {(c.consultants?.length ? c.consultants.map((x) => x.name) : [c.consultantName]).filter(Boolean).join(", ")}
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-medium text-slate-800">
                              {(c.clientNames?.length ? c.clientNames : (c.clientName ? [c.clientName] : [])).filter(Boolean).join(", ")}
                            </span>
                            {c.purpose && <span className="text-text-muted ml-1">{c.purpose}</span>}
                          </td>
                          <td className="px-5 py-3">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              c.status === "completed" && "bg-success-100 text-success-700",
                              c.status === "notified" && "bg-primary-100 text-primary-700",
                              c.status === "scheduled" && "bg-slate-100 text-slate-700",
                              c.status === "cancelled" && "bg-danger-100 text-danger-700"
                            )}>
                              {STATUS_LABEL[c.status]}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {c.caseNumber ? (
                              <a href={`/cases/${c.caseId}`} className="text-primary-600 hover:underline">{c.caseNumber}</a>
                            ) : "-"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button type="button" onClick={() => { setEditing(c); setFormOpen(true); }} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary-600">
                              <Pencil size={14} />
                            </button>
                            <button type="button" onClick={() => handleDeleteConsultation(c.id)} className="p-1.5 rounded-lg text-slate-500 hover:bg-danger-50 hover:text-danger-600">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 상담실 등록/편집 탭 */}
        {activeTab === "rooms" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">상담실(유형)을 등록·수정·삭제합니다. 삭제 시 해당 상담실의 모든 상담 기록도 삭제됩니다.</p>
              <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => { setEditingRoom(null); setRoomFormOpen(true); }}>
                입력칸 호출
              </Button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/70 text-xs text-text-muted font-medium border-b border-slate-100">
                    <th className="text-left px-5 py-3 w-12">순서</th>
                    <th className="text-left px-5 py-3">항목(상담실명)</th>
                    <th className="text-left px-5 py-3">비고</th>
                    <th className="text-right px-5 py-3 w-24">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.sort((a, b) => a.sortOrder - b.sortOrder).map((room, idx) => (
                    <tr key={room.id} className="border-t border-slate-50 text-sm">
                      <td className="px-5 py-3 tabular-nums">{idx + 1}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{room.name}</td>
                      <td className="px-5 py-3 text-text-muted">{room.remarks ?? "-"}</td>
                      <td className="px-5 py-3 text-right">
                        <button type="button" onClick={() => { setEditingRoom(room); setRoomFormOpen(true); }} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary-600">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => handleDeleteRoom(room.id)} className="p-1.5 rounded-lg text-slate-500 hover:bg-danger-50 hover:text-danger-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 콜센터 게시판 (전화 메모) - 하단 */}
        <section className="mt-8 pt-8 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Phone size={18} className="text-primary-600" />
            <h2 className="text-base font-semibold text-slate-800">콜센터 게시판</h2>
            <span className="text-xs text-text-muted">전화 콜 접수 시 메모를 남기고, 양식을 당겨 쓸 수 있습니다.</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 좌측: 게시글 신규생성 폼 + 목록 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden flex flex-col">
              <div className="p-4 flex-1 flex flex-col gap-4 min-h-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">제목</label>
                    <input
                      type="text"
                      value={callForm.title}
                      onChange={(e) => setCallForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="예: 사건 문의"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">발신자</label>
                    <input
                      type="text"
                      value={callForm.callerName}
                      onChange={(e) => setCallForm((p) => ({ ...p, callerName: e.target.value }))}
                      placeholder="이름"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">연락처</label>
                  <input
                    type="text"
                    value={callForm.phone}
                    onChange={(e) => setCallForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="전화번호"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                  />
                </div>
                <div className="flex-1 min-h-0">
                  <label className="block text-xs font-medium text-slate-600 mb-1">내용</label>
                  <textarea
                    value={callForm.content}
                    onChange={(e) => setCallForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder="전화 내용을 입력하세요. 우측 양식을 클릭하면 여기로 불러옵니다."
                    rows={5}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none resize-y"
                  />
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={callMemoSearchQuery}
                      onChange={(e) => setCallMemoSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && setCallMemoPage(1)}
                      placeholder="제목·발신자·연락처·내용 검색"
                      className="flex-1 min-w-[140px] max-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
                    />
                    <Button size="sm" variant="outline" leftIcon={<Search size={14} />} onClick={() => setCallMemoPage(1)}>
                      검색
                    </Button>
                    <SearchResultExcelButton
                      count={callMemoSearched.length}
                      onExport={() => {
                        if (exportCallMemosSearchResult(callMemoSearched)) {
                          toast.success(`${callMemoSearched.length}건을 엑셀로보냈습니다.`);
                        }
                      }}
                    />
                    <Button size="sm" leftIcon={<Save size={14} />} onClick={handleCallMemoRegister}>
                      등록
                    </Button>
                    <Button size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={handleCallMemoEdit} disabled={!selectedCallMemoId}>
                      편집
                    </Button>
                    <Button size="sm" variant="outline" className="text-danger-600 hover:bg-danger-50 hover:border-danger-200" leftIcon={<Trash2 size={14} />} onClick={handleCallMemoDelete} disabled={!selectedCallMemoId}>
                      삭제
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setCallForm({ title: "", callerName: "", phone: "", content: "" }); setSelectedCallMemoId(null); }}
                      className="text-xs text-slate-500 hover:text-primary-600 ml-auto"
                    >
                      새로 쓰기
                    </button>
                  </div>
                  {callMemoMonths.length === 0 ? (
                    <p className="text-xs text-text-muted py-3">{callMemoSearchQuery.trim() ? "검색 결과가 없습니다." : "등록된 전화 메모가 없습니다."}</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {callMemoMonths.map(({ month }) => {
                          const [y, m] = month.split("-");
                          const label = `${y}. ${m}`;
                          return (
                            <button
                              key={month}
                              type="button"
                              onClick={() => { setCallMemoMonth(month); setCallMemoPage(1); }}
                              className={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
                                callMemoMonth === month ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-1.5 min-h-[120px]">
                        {callMemoPaginated.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => selectCallMemoForEdit(m)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border",
                              selectedCallMemoId === m.id ? "bg-primary-50 text-primary-800 border-primary-200" : "hover:bg-slate-50 border-slate-100"
                            )}
                          >
                            <span className="font-medium truncate block">{m.title}</span>
                            <span className="text-xs text-text-muted">
                              {m.callerName} · {new Date(m.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          </button>
                        ))}
                      </div>
                      {callMemoTotalPages > 1 && (
                        <div className="flex items-center justify-center gap-1 mt-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setCallMemoPage((p) => Math.max(1, p - 1))}
                            disabled={callMemoPageSafe <= 1}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          {Array.from({ length: callMemoTotalPages }, (_, i) => i + 1).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setCallMemoPage(n)}
                              className={cn(
                                "min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors",
                                callMemoPageSafe === n ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-100"
                              )}
                            >
                              {n}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setCallMemoPage((p) => Math.min(callMemoTotalPages, p + 1))}
                            disabled={callMemoPageSafe >= callMemoTotalPages}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <CallMemoTemplatePanel
              templates={callTemplates}
              onTemplatesChange={refreshCallTemplates}
              onApply={applyCallTemplate}
            />
          </div>
        </section>
      </motion.div>

      {/* 상담 등록/편집 폼 모달 */}
      {formOpen && (
        <ConsultationForm
          key={editing?.id ?? "new"}
          consultation={editing ?? undefined}
          initial={formInitial ?? undefined}
          rooms={rooms}
          staff={linkStaff}
          cases={linkCases}
          defaultDate={viewDate}
          onSave={handleSaveConsultation}
          onDelete={editing ? () => handleDeleteConsultation(editing.id) : undefined}
          onClose={() => { setFormOpen(false); setEditing(null); setFormInitial(null); }}
        />
      )}

      {/* 상담실 등록/편집 모달 */}
      {roomFormOpen && (
        <RoomForm
          room={editingRoom ?? undefined}
          nextOrder={rooms.length}
          onSave={handleSaveRoom}
          onClose={() => { setRoomFormOpen(false); setEditingRoom(null); }}
        />
      )}
    </div>
  );
}

function ConsultationForm({
  consultation,
  initial,
  rooms,
  staff,
  cases,
  defaultDate,
  onSave,
  onDelete,
  onClose,
}: {
  consultation?: ConsultationItem;
  initial?: Partial<ConsultationItem>;
  rooms: ConsultationRoom[];
  staff: typeof mockStaff;
  cases: typeof mockCases;
  defaultDate: string;
  onSave: (p: Partial<ConsultationItem>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const initialConsultants: ConsultationConsultant[] = consultation?.consultants?.length
    ? consultation.consultants
    : (consultation?.consultantId || initial?.consultantId)
      ? [{ id: consultation?.consultantId ?? initial?.consultantId!, name: consultation?.consultantName ?? initial?.consultantName ?? "" }]
      : staff[0] ? [{ id: staff[0].id, name: staff[0].name }] : [];
  const initialClientNames: string[] = consultation?.clientNames?.length
    ? consultation.clientNames
    : (consultation?.clientName || initial?.clientName) ? [consultation?.clientName ?? initial?.clientName ?? ""] : [];

  const [form, setForm] = useState<Partial<ConsultationItem>>(() => ({
    consultationDate: consultation?.consultationDate ?? initial?.consultationDate ?? defaultDate,
    startTime: consultation?.startTime ?? initial?.startTime ?? "10:00",
    endTime: consultation?.endTime ?? initial?.endTime ?? "10:30",
    roomId: consultation?.roomId ?? initial?.roomId ?? rooms[0]?.id,
    roomName: consultation?.roomName ?? initial?.roomName ?? rooms[0]?.name,
    consultantId: initialConsultants[0]?.id ?? staff[0]?.id,
    consultantName: initialConsultants[0]?.name ?? staff[0]?.name,
    consultants: initialConsultants,
    clientName: initialClientNames[0] ?? "",
    clientNames: initialClientNames,
    purpose: consultation?.purpose ?? initial?.purpose ?? "",
    importance: consultation?.importance ?? initial?.importance ?? "medium",
    status: consultation?.status ?? initial?.status ?? "scheduled",
    caseId: consultation?.caseId ?? initial?.caseId,
    caseNumber: consultation?.caseNumber ?? initial?.caseNumber,
    notes: consultation?.notes ?? initial?.notes ?? "",
  }));

  const [consultantInput, setConsultantInput] = useState("");
  const [visitorInput, setVisitorInput] = useState("");

  const consultants = form.consultants ?? (form.consultantId ? [{ id: form.consultantId, name: form.consultantName ?? "" }] : []);
  const clientNames = form.clientNames ?? (form.clientName ? [form.clientName] : []);

  const addConsultantByName = (name: string) => {
    const n = name.trim();
    if (!n || consultants.some((c) => c.name === n)) return;
    const id = `consultant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setForm((p) => ({ ...p, consultants: [...consultants, { id, name: n }], consultantId: consultants[0]?.id ?? id, consultantName: consultants[0]?.name ?? n }));
    setConsultantInput("");
  };
  const removeConsultant = (id: string) => {
    const next = consultants.filter((c) => c.id !== id);
    setForm((p) => ({ ...p, consultants: next, consultantId: next[0]?.id, consultantName: next[0]?.name }));
  };
  const addVisitor = () => {
    const name = visitorInput.trim();
    if (!name || clientNames.includes(name)) return;
    setForm((p) => ({ ...p, clientNames: [...clientNames, name], clientName: clientNames[0] ?? name }));
    setVisitorInput("");
  };
  const removeVisitor = (name: string) => {
    const next = clientNames.filter((n) => n !== name);
    setForm((p) => ({ ...p, clientNames: next, clientName: next[0] ?? "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalConsultants = form.consultants?.length ? form.consultants : consultants;
    const finalClientNames = form.clientNames?.length ? form.clientNames : clientNames;
    if (finalConsultants.length === 0) {
      toast.error("상담 담당자를 1명 이상 추가하세요.");
      return;
    }
    if (finalClientNames.length === 0 && !form.purpose?.trim()) {
      toast.error("방문자(내담자) 또는 용건을 입력하세요.");
      return;
    }
    const room = rooms.find((r) => r.id === form.roomId);
    const c = cases.find((x) => x.id === form.caseId);
    onSave({
      ...form,
      roomName: room?.name,
      consultantId: finalConsultants[0]?.id,
      consultantName: finalConsultants[0]?.name,
      consultants: finalConsultants,
      clientName: finalClientNames[0],
      clientNames: finalClientNames,
      caseNumber: c?.caseNumber,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{consultation ? "상담 편집" : "상담 등록"}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">예약일 *</label>
              <input
                id="consult-date"
                type="date"
                value={form.consultationDate}
                onChange={(e) => setForm((p) => ({ ...p, consultationDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">시작 *</label>
                <select
                  id="consult-start"
                  value={form.startTime}
                  onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">종료 *</label>
                <select
                  id="consult-end"
                  value={form.endTime}
                  onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">상담실 *</label>
            <select
              id="consult-room"
              value={form.roomId}
              onChange={(e) => {
                const r = rooms.find((x) => x.id === e.target.value);
                setForm((p) => ({ ...p, roomId: e.target.value, roomName: r?.name }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              required
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">상담 담당 * (여러 명 선택, 문자 발송 시 복수 입력)</label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50/50 min-h-[42px]">
              {consultants.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 text-primary-800 text-xs font-medium"
                >
                  {c.name}
                  <button type="button" onClick={() => removeConsultant(c.id)} className="p-0.5 rounded hover:bg-primary-200/50" aria-label="제거">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={consultantInput}
                onChange={(e) => setConsultantInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addConsultantByName(consultantInput); } }}
                placeholder="이름 입력 후 Enter"
                className="flex-1 min-w-[120px] px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-0 text-slate-600"
              />
            </div>
            <button type="button" onClick={() => addConsultantByName(consultantInput)} className="text-xs text-primary-600 hover:underline mt-1">+ 담당자 추가</button>
            {consultants.length === 0 && <p className="text-2xs text-text-muted mt-0.5">이름 입력 후 Enter로 추가합니다.</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">방문자(내담자)/용건 *</label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50/50 min-h-[42px] mb-1">
              {clientNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200 text-slate-800 text-xs font-medium"
                >
                  <User size={11} />
                  {name}
                  <button type="button" onClick={() => removeVisitor(name)} className="p-0.5 rounded hover:bg-slate-300/50" aria-label="제거">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={visitorInput}
                onChange={(e) => setVisitorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addVisitor(); } }}
                placeholder="이름 입력 후 Enter"
                className="flex-1 min-w-[100px] px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
              />
            </div>
            <button type="button" onClick={addVisitor} className="text-xs text-primary-600 hover:underline mb-1">+ 방문자 추가</button>
            <input
              type="text"
              value={form.purpose}
              onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
              placeholder="용건"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">중요도</label>
              <select
                value={form.importance}
                onChange={(e) => setForm((p) => ({ ...p, importance: e.target.value as ConsultationItem["importance"] }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              >
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">상태</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ConsultationStatus }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">매치사건 (연관 사건)</label>
            <select
              value={form.caseId ?? ""}
              onChange={(e) => {
                const c = cases.find((x) => x.id === e.target.value);
                setForm((p) => ({ ...p, caseId: e.target.value || undefined, caseNumber: c?.caseNumber }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            >
              <option value="">선택 안 함</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.caseNumber} {c.caseName}</option>
              ))}
            </select>
            <p className="text-2xs text-text-muted mt-0.5">연결 시 해당 사건 메모함에 상담 내용이 자동 기록됩니다.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">비고</label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {onDelete && (
              <Button type="button" variant="ghost" className="text-danger-600" onClick={onDelete}>
                삭제
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit">저장</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoomForm({
  room,
  nextOrder,
  onSave,
  onClose,
}: {
  room?: ConsultationRoom;
  nextOrder: number;
  onSave: (p: Partial<ConsultationRoom>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(room?.name ?? "");
  const [remarks, setRemarks] = useState(room?.remarks ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, sortOrder: room?.sortOrder ?? nextOrder, remarks: remarks || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{room ? "상담실 편집" : "상담실 등록"}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">항목(상담실명) * 최대 10글자</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 10))}
              maxLength={10}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">비고</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit">저장</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
