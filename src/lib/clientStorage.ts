/**
 * 고객(의뢰인) 로컬 저장소
 * - 사건 등록 시 저장한 의뢰인 정보 목록
 * - 소프트 삭제 / 관리자 복구
 * localStorage 키: lawygo_clients
 */

import type { ClientItem } from "@/lib/types";

const STORAGE_KEY = "lawygo_clients";

function loadRaw(): ClientItem[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRaw(items: ClientItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** 목록 (삭제 제외, 최신 수정순) */
export function loadClients(): ClientItem[] {
  return loadRaw()
    .filter((c) => !c.deletedAt)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 삭제된 항목 포함 전체 (관리자 복구용) */
export function loadClientsRaw(): ClientItem[] {
  return loadRaw().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 이름·연락처·이메일·주소·메모 검색 (삭제 제외) */
export function searchClients(query: string): ClientItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return loadClients();
  return loadClients().filter((c) => {
    const name = (c.name ?? "").toLowerCase();
    const phone = (c.phone ?? "").toLowerCase();
    const mobile = (c.mobile ?? "").toLowerCase();
    const email = (c.email ?? "").toLowerCase();
    const address = (c.address ?? "").toLowerCase();
    const memo = (c.memo ?? "").toLowerCase();
    return name.includes(q) || phone.includes(q) || mobile.includes(q) || email.includes(q) || address.includes(q) || memo.includes(q);
  });
}

/** 삭제 포함 전체에서 검색 (관리자 화면용) */
export function searchClientsIncludingDeleted(query: string): ClientItem[] {
  const q = query.trim().toLowerCase();
  const list = loadClientsRaw();
  if (!q) return list;
  return list.filter((c) => {
    const name = (c.name ?? "").toLowerCase();
    const phone = (c.phone ?? "").toLowerCase();
    const mobile = (c.mobile ?? "").toLowerCase();
    const email = (c.email ?? "").toLowerCase();
    const address = (c.address ?? "").toLowerCase();
    const memo = (c.memo ?? "").toLowerCase();
    return name.includes(q) || phone.includes(q) || mobile.includes(q) || email.includes(q) || address.includes(q) || memo.includes(q);
  });
}

export function getClientById(id: string): ClientItem | undefined {
  return loadRaw().find((c) => c.id === id);
}

/** 이름·연락처로 일치하는 고객 찾기 (콜센터 메모 연동용) */
export function findClientByNameAndPhone(name: string, phone: string): ClientItem | undefined {
  const n = (name || "").trim().toLowerCase();
  const p = (phone || "").trim().replace(/\D/g, "");
  if (!n) return undefined;
  return loadRaw().find((c) => {
    if (!c.deletedAt && (c.name || "").trim().toLowerCase() === n) {
      const cp = ((c.phone || "") + (c.mobile || "")).replace(/\D/g, "");
      return !p || cp.includes(p) || p.includes(cp);
    }
    return false;
  });
}

export function saveClient(item: Omit<ClientItem, "createdAt" | "updatedAt" | "id"> & { id?: string; createdAt?: string; updatedAt?: string }): ClientItem {
  const raw = loadRaw();
  const now = new Date().toISOString();
  const existing = item.id ? raw.find((c) => c.id === item.id) : undefined;
  if (existing) {
    const updated: ClientItem = {
      ...existing,
      name: item.name,
      phone: item.phone,
      mobile: item.mobile,
      email: item.email,
      address: item.address,
      idNumber: item.idNumber,
      bizNumber: item.bizNumber,
      memo: item.memo,
      updatedAt: now,
      deletedAt: existing.deletedAt,
      callMemoIds: item.callMemoIds ?? existing.callMemoIds,
    };
    saveRaw(raw.map((c) => (c.id === item.id ? updated : c)));
    return updated;
  }
  const newItem: ClientItem = {
    ...item,
    id: item.id || "client-" + Date.now(),
    createdAt: item.createdAt ?? now,
    updatedAt: now,
  };
  saveRaw([...raw, newItem]);
  return newItem;
}

/** 소프트 삭제 (직원 사용) */
export function softDeleteClient(id: string): void {
  const raw = loadRaw();
  const now = new Date().toISOString();
  saveRaw(raw.map((c) => (c.id === id ? { ...c, deletedAt: now, updatedAt: now } : c)));
}

/** 복구 (관리자만 사용) */
export function restoreClient(id: string): void {
  const raw = loadRaw();
  const now = new Date().toISOString();
  saveRaw(raw.map((c) => (c.id === id ? { ...c, deletedAt: undefined, updatedAt: now } : c)));
}
