"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutList,
  FileText,
  ChevronRight,
  Wifi,
  WifiOff,
  Sparkles,
  Search,
  Scale,
  FileStack,
  PenLine,
  Bot,
  FileCheck,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { BOARD_LIST, AI_FEATURES } from "@/lib/boardConfig";
import {
  loadBoards,
  loadBoardsIncludingDeleted,
  reorderBoards,
  createBoard,
  updateBoard,
  softDeleteBoard,
  restoreBoard,
  type StoredBoardItem,
  type BoardKind,
} from "@/lib/boardStorage";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ApprovalManagementTab } from "@/components/board/ApprovalManagementTab";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const aiIconMap: Record<string, React.ReactNode> = {
  legal_encyclopedia: <BookOpen size={20} className="text-primary-600" />,
  case_search: <Scale size={20} className="text-primary-600" />,
  law_search: <Search size={20} className="text-primary-600" />,
  doc_summary: <FileStack size={20} className="text-primary-600" />,
  doc_draft: <PenLine size={20} className="text-primary-600" />,
  ai_search: <Bot size={20} className="text-primary-600" />,
};

const BOARD_KIND_LABELS: Record<BoardKind, string> = {
  post: "게시물형",
  data: "자료실형",
};

type BoardTab = "boards" | "approval";

export default function BoardListPage() {
  const [activeTab, setActiveTab] = useState<BoardTab>("boards");
  const [boards, setBoards] = useState<StoredBoardItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nativeBoard, setNativeBoard] = useState<boolean | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createType, setCreateType] = useState<BoardKind>("post");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState<BoardKind>("post");
  const [deletedBoards, setDeletedBoards] = useState<StoredBoardItem[]>([]);
  const { isAdmin } = useIsAdmin();

  const refreshBoards = useCallback(() => {
    setBoards(loadBoards());
  }, []);

  useEffect(() => {
    refreshBoards();
  }, [refreshBoards]);

  useEffect(() => {
    if (isAdmin) {
      setDeletedBoards(loadBoardsIncludingDeleted().filter((b) => b.deletedAt));
    }
  }, [isAdmin, boards]);

  const handleRestore = (id: string) => {
    restoreBoard(id);
    refreshBoards();
    setDeletedBoards(loadBoardsIncludingDeleted().filter((b) => b.deletedAt));
    toast.success("게시판이 복구되었습니다.");
  };

  useEffect(() => {
    fetch("/api/board")
      .then((res) => res.json())
      .then((data) => setNativeBoard(data.nativeBoard ?? false))
      .catch(() => setNativeBoard(false));
  }, []);
  useEffect(() => {
    fetch("/api/ai/gemini")
      .then((res) => res.json())
      .then((data) => setGeminiConfigured(data.configured ?? false))
      .catch(() => setGeminiConfigured(false));
  }, []);
  useEffect(() => {
    fetch("/api/ai/openai")
      .then((res) => res.json())
      .then((data) => setOpenaiConfigured(data.configured ?? false))
      .catch(() => setOpenaiConfigured(false));
  }, []);

  const selectedBoard = selectedId ? boards.find((b) => b.id === selectedId) : null;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const ordered = Array.from(boards);
    const [removed] = ordered.splice(result.source.index, 1);
    ordered.splice(result.destination.index, 0, removed);
    const orderedIds = ordered.map((b) => b.id);
    reorderBoards(orderedIds);
    setBoards(ordered);
    toast.success("순서가 변경되었습니다.");
  };

  const handleCreate = () => {
    if (!createName.trim()) {
      toast.error("게시판 이름을 입력해 주세요.");
      return;
    }
    createBoard({ name: createName.trim(), description: createDesc.trim() || undefined, type: createType });
    refreshBoards();
    setCreateOpen(false);
    setCreateName("");
    setCreateDesc("");
    setCreateType("post");
    toast.success("게시판이 생성되었습니다.");
  };

  const openEdit = () => {
    if (!selectedBoard) {
      toast.error("편집할 게시판을 선택해 주세요.");
      return;
    }
    setEditName(selectedBoard.name);
    setEditDesc(selectedBoard.description ?? "");
    setEditType(selectedBoard.type);
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!selectedId) return;
    if (!editName.trim()) {
      toast.error("게시판 이름을 입력해 주세요.");
      return;
    }
    updateBoard(selectedId, { name: editName.trim(), description: editDesc.trim() || undefined, type: editType });
    refreshBoards();
    setEditOpen(false);
    setSelectedId(null);
    toast.success("수정되었습니다.");
  };

  const handleDelete = () => {
    if (!selectedId) {
      toast.error("삭제할 게시판을 선택해 주세요.");
      return;
    }
    if (!confirm("이 게시판을 삭제하시겠습니까? (삭제된 게시판은 목록에서 숨겨집니다.)")) return;
    softDeleteBoard(selectedId);
    refreshBoards();
    setSelectedId(null);
    toast.success("게시판이 삭제되었습니다.");
  };

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-8"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <LayoutList size={24} className="text-primary-600" />
              게시판
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Supabase 네이티브 게시판, AI문서엔진(Lawygo), 결재관리를 이용할 수 있습니다.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
            <button
              type="button"
              onClick={() => setActiveTab("boards")}
              className={cn(
                "px-4 py-3 min-h-[44px] text-sm font-medium flex items-center gap-2",
                activeTab === "boards" ? "bg-white text-primary-600 shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <LayoutList size={16} />
              게시판·AI
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("approval")}
              className={cn(
                "px-4 py-3 min-h-[44px] text-sm font-medium flex items-center gap-2",
                activeTab === "approval" ? "bg-white text-primary-600 shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <FileCheck size={16} />
              결재관리
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {nativeBoard !== null && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  nativeBoard ? "bg-success-50 text-success-700" : "bg-slate-100 text-text-muted"
                )}
              >
                {nativeBoard ? <Wifi size={14} /> : <WifiOff size={14} />}
                {nativeBoard ? "Supabase 게시판" : "게시판 DB 미준비"}
              </div>
            )}
            {geminiConfigured !== null && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  geminiConfigured ? "bg-primary-50 text-primary-700" : "bg-slate-100 text-text-muted"
                )}
              >
                <Sparkles size={14} />
                {geminiConfigured ? "Gemini 연동됨" : "Gemini 미설정"}
              </div>
            )}
            {openaiConfigured !== null && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  openaiConfigured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-text-muted"
                )}
              >
                <Sparkles size={14} />
                {openaiConfigured ? "ChatGPT 연동됨" : "ChatGPT 미설정"}
              </div>
            )}
          </div>
        </div>

        {activeTab === "approval" && <ApprovalManagementTab />}

        {activeTab === "boards" && (
          <>
            {/* G6 게시판 */}
            <section>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <h2 className="text-sm font-semibold text-slate-600">G6 게시판</h2>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                      게시판생성
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Pencil size={14} />}
                      onClick={openEdit}
                      disabled={!selectedId}
                    >
                      편집
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Trash2 size={14} />}
                      onClick={handleDelete}
                      disabled={!selectedId}
                      className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
                    >
                      삭제
                    </Button>
                  </div>
                )}
              </div>
              <DragDropContext onDragEnd={isAdmin ? handleDragEnd : () => {}}>
                <Droppable droppableId="g6-boards" direction="horizontal">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                      {boards.map((board, i) => (
                        <Draggable key={board.id} draggableId={board.id} index={i} isDragDisabled={!isAdmin}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "rounded-2xl border bg-white shadow-card p-5 relative",
                                "flex items-start gap-4 group",
                                snapshot.isDragging && "shadow-lg ring-2 ring-primary-200",
                                selectedId === board.id
                                  ? "border-primary-400 ring-2 ring-primary-100"
                                  : "border-slate-100 hover:shadow-card-hover hover:border-primary-200"
                              )}
                            >
                              {isAdmin && (
                              <label className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedId === board.id}
                                  onChange={() => setSelectedId(selectedId === board.id ? null : board.id)}
                                  className="rounded border-slate-300"
                                />
                                선택
                              </label>
                            )}
                              <Link
                                href={`/board/${board.id}`}
                                className="flex items-start gap-4 flex-1 min-w-0"
                              >
                                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-primary-50 transition-colors">
                                  <FileText size={20} className="text-slate-600" />
                                </div>
                                <div className="flex-1 min-w-0 pr-6">
                                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
                                    {board.name}
                                  </h3>
                                  {board.description && (
                                    <p className="text-sm text-text-muted mt-0.5">{board.description}</p>
                                  )}
                                  <p className="text-xs text-text-muted mt-1">{BOARD_KIND_LABELS[board.type]}</p>
                                </div>
                                <ChevronRight size={18} className="text-slate-400 group-hover:text-primary-600 shrink-0 mt-0.5" />
                              </Link>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              {isAdmin && (
                <p className="text-xs text-text-muted mt-2">카드를 드래그하여 순서를 변경할 수 있습니다. 클릭 시 선택 후 편집·삭제 가능합니다.</p>
              )}
              {isAdmin && deletedBoards.length > 0 && (
                <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">삭제된 게시판 (이력관리)</h3>
                  <ul className="space-y-2">
                    {deletedBoards.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-700">{b.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(b.id)}
                          className="shrink-0"
                        >
                          복구
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* AI문서엔진 (Lawygo) */}
            <section>
              <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-primary-500" />
                AI문서엔진(Lawygo)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AI_FEATURES.map((feat, i) => (
                  <motion.div
                    key={feat.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.15 + i * 0.05 }}
                  >
                    <Link href={`/board/ai/${feat.id}`}>
                      <div
                        className={cn(
                          "rounded-2xl border border-slate-100 bg-white shadow-card p-5",
                          "hover:shadow-card-hover hover:border-primary-200 transition-all duration-200",
                          "flex items-start gap-4 group"
                        )}
                      >
                        <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center shrink-0 group-hover:bg-primary-100 transition-colors">
                          {aiIconMap[feat.id] ?? <Sparkles size={20} className="text-primary-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
                            {feat.name}
                          </h3>
                          <p className="text-sm text-text-muted mt-0.5">{feat.description}</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 group-hover:text-primary-600 shrink-0 mt-0.5" />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          </>
        )}
      </motion.div>

      {/* 게시판 생성 모달 */}
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-slate-900">게시판 생성</Dialog.Title>
            <Dialog.Description className="text-sm text-text-muted mt-0.5">
              종류를 선택한 뒤 이름과 설명을 입력하세요.
            </Dialog.Description>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">종류</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateType("post")}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      createType === "post"
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    게시물형
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateType("data")}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      createType === "data"
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    자료실형
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">게시판 이름</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="예: 자유게시판"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">설명 (선택)</label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="예: 업무·자료 공유"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button size="sm" onClick={handleCreate} leftIcon={<Plus size={14} />}>
                생성
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(false)}>
                취소
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 게시판 편집 모달 */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-slate-900">게시판 편집</Dialog.Title>
            <Dialog.Description className="text-sm text-text-muted mt-0.5">
              이름, 설명, 종류를 수정할 수 있습니다.
            </Dialog.Description>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">종류</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditType("post")}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      editType === "post"
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    게시물형
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType("data")}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      editType === "data"
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    자료실형
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">게시판 이름</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">설명 (선택)</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button size="sm" onClick={handleEdit} leftIcon={<Pencil size={14} />}>
                저장
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(false)}>
                취소
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
