/**
 * 공지사항 로컬 저장소 (관리자 → 이용자)
 * localStorage 키: lawygo_notices
 */

import type { NoticeItem } from "@/lib/types";

const STORAGE_KEY = "lawygo_notices";

const TITLES = [
  "2026년 연차 일정 안내",
  "사무실 보안 정책 변경",
  "기일 달력 이용 안내",
  "사건관리 시스템 업데이트",
  "전자문서 보관 기간 안내",
  "출퇴근 기록 정책",
  "회의실 예약 이용 안내",
  "복리후생 제도 변경",
  "교육 이수 안내",
  "연말 정산 일정",
  "보안 점검 일정",
  "서류 제출 마감 안내",
  "휴가 신청 절차 변경",
  "비상 연락망 업데이트",
  "사무용품 신청 방법",
  "인터넷 사용 정책",
  "재택근무 가이드라인",
  "사건 메모 작성 안내",
  "결재함 이용 방법",
  "메신저 발송 안내",
  "문서 보안 등급 안내",
  "고객 정보 보호 정책",
  "내부 감사 일정",
  "사무소 행사 안내",
  "시스템 점검 공지",
  "비밀번호 정책 강화",
  "이메일 사용 수칙",
  "출장비 정산 절차",
  "법인카드 사용 안내",
  "인사 평가 일정",
];

function generateDefaultNotices(): NoticeItem[] {
  const authors = ["관리자", "시스템관리자", "인사팀", "행정팀"];
  const dayMs = 86400000;
  const base = new Date("2026-02-01T09:00:00.000Z").getTime();
  return TITLES.map((title, i) => {
    const createdAt = new Date(base + dayMs * i).toISOString();
    return {
      id: `n${i + 1}`,
      title,
      content: `${title}에 대한 내용입니다.\n\n세부 사항은 담당 부서에 문의해 주시기 바랍니다.\n\n감사합니다.`,
      authorName: authors[i % authors.length],
      createdAt,
      updatedAt: createdAt,
    };
  });
}

const DEFAULT_NOTICES: NoticeItem[] = generateDefaultNotices();

function loadRaw(): NoticeItem[] {
  if (typeof window === "undefined") return DEFAULT_NOTICES;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return DEFAULT_NOTICES;
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_NOTICES;
  } catch {
    return DEFAULT_NOTICES;
  }
}

function saveRaw(items: NoticeItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** 공지사항 목록 (삭제 제외, 최신순) */
export function loadNotices(): NoticeItem[] {
  return loadRaw()
    .filter((n) => !n.deletedAt)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 제목·내용 검색 */
export function searchNotices(query: string): NoticeItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return loadNotices();
  return loadNotices().filter(
    (n) =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.authorName.toLowerCase().includes(q)
  );
}

/** id로 단건 조회 */
export function getNoticeById(id: string): NoticeItem | undefined {
  return loadRaw().find((n) => n.id === id);
}

/** 공지사항 저장 (신규 시 id 생성) */
export function saveNotice(item: Omit<NoticeItem, "createdAt" | "updatedAt" | "id"> & { id?: string; createdAt?: string; updatedAt?: string }): NoticeItem {
  const raw = loadRaw();
  const now = new Date().toISOString();
  const existing = item.id ? raw.find((n) => n.id === item.id) : undefined;
  if (existing) {
    const updated: NoticeItem = {
      ...existing,
      title: item.title,
      content: item.content,
      authorName: item.authorName,
      updatedAt: now,
      attachmentNames: item.attachmentNames,
      attachmentData: item.attachmentData,
    };
    saveRaw(raw.map((n) => (n.id === item.id ? updated : n)));
    return updated;
  }
  const newItem: NoticeItem = {
    ...item,
    id: item.id || "n-" + Date.now(),
    createdAt: item.createdAt ?? now,
    updatedAt: now,
  };
  saveRaw([...raw, newItem]);
  return newItem;
}

/** 공지사항 소프트 삭제 */
export function softDeleteNotice(id: string): void {
  const raw = loadRaw();
  const now = new Date().toISOString();
  saveRaw(raw.map((n) => (n.id === id ? { ...n, deletedAt: now, updatedAt: now } : n)));
}

/** 공지사항 완전 삭제 */
export function deleteNotice(id: string): void {
  saveRaw(loadRaw().filter((n) => n.id !== id));
}
