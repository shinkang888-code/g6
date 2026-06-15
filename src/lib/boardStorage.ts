/**
 * G6 게시판 목록 로컬 저장소 (이용자 생성·편집·순서·소프트삭제)
 * localStorage 키: lawygo_board_list
 */

import { BOARD_LIST } from "@/lib/boardConfig";

export type BoardKind = "post" | "data"; // 게시물형 | 자료실형

export interface StoredBoardItem {
  id: string;
  name: string;
  description?: string;
  type: BoardKind;
  order: number;
  deletedAt?: string;
}

const STORAGE_KEY = "lawygo_board_list";

const DEFAULT_BOARDS: StoredBoardItem[] = BOARD_LIST.map((b, i) => ({
  id: b.id,
  name: b.name,
  description: b.description,
  type: "post" as BoardKind,
  order: i,
}));

function loadRaw(): StoredBoardItem[] {
  if (typeof window === "undefined") return DEFAULT_BOARDS;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return DEFAULT_BOARDS;
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BOARDS;
  } catch {
    return DEFAULT_BOARDS;
  }
}

function saveRaw(items: StoredBoardItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** 노출용 목록 (삭제 제외, order 정렬) */
export function loadBoards(): StoredBoardItem[] {
  return loadRaw()
    .filter((b) => !b.deletedAt)
    .sort((a, b) => a.order - b.order);
}

/** 순서 변경 후 저장 */
export function reorderBoards(orderedIds: string[]): void {
  const raw = loadRaw();
  const orderById = new Map(orderedIds.map((id, i) => [id, i]));
  const next = raw.map((b) => {
    const newOrder = orderById.get(b.id);
    if (newOrder !== undefined && !b.deletedAt) return { ...b, order: newOrder };
    return b;
  });
  saveRaw(next);
}

/** 게시판 생성 */
export function createBoard(params: { name: string; description?: string; type: BoardKind }): StoredBoardItem {
  const raw = loadRaw();
  const maxOrder = raw.reduce((m, b) => Math.max(m, b.order), -1);
  const id = "board_" + Date.now();
  const item: StoredBoardItem = {
    id,
    name: params.name.trim() || "새 게시판",
    description: params.description?.trim(),
    type: params.type,
    order: maxOrder + 1,
  };
  saveRaw([...raw, item]);
  return item;
}

/** 게시판 수정 */
export function updateBoard(
  id: string,
  params: { name?: string; description?: string; type?: BoardKind }
): void {
  const raw = loadRaw();
  saveRaw(
    raw.map((b) =>
      b.id === id
        ? {
            ...b,
            ...(params.name !== undefined && { name: params.name.trim() || b.name }),
            ...(params.description !== undefined && { description: params.description?.trim() }),
            ...(params.type !== undefined && { type: params.type }),
          }
        : b
    )
  );
}

/** 소프트 삭제 */
export function softDeleteBoard(id: string): void {
  const raw = loadRaw();
  const now = new Date().toISOString();
  saveRaw(raw.map((b) => (b.id === id ? { ...b, deletedAt: now } : b)));
}

/** 삭제된 게시판 복구 (관리자용) */
export function restoreBoard(id: string): void {
  const raw = loadRaw();
  saveRaw(raw.map((b) => (b.id === id ? { ...b, deletedAt: undefined } : b)));
}

/** 삭제된 항목 포함 전체 (관리자 이력/복구용) */
export function loadBoardsIncludingDeleted(): StoredBoardItem[] {
  return loadRaw().sort((a, b) => a.order - b.order);
}

/** id로 단건 조회 (삭제 포함) */
export function getBoardById(id: string): StoredBoardItem | undefined {
  return loadRaw().find((b) => b.id === id);
}
