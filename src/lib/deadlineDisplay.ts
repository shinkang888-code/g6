/**
 * 기일 표시용 파싱·연락처 조회
 */

import { formatCourtDivisionContactLine } from "./courtContactFormat";
import { formatDate } from "./utils";
import type { StaffMember } from "./types";

export type DeadlineRow = {
  id: string;
  date: string;
  type?: string;
  court?: string;
  memo?: string;
  assignedStaff?: string;
};

const PHONE_REGEX = /(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}|010[-.\s]?\d{4}[-.\s]?\d{4})/;
const TIME_RE = /^\d{1,2}:\d{2}$|^\d{1,2}시/;
const PLACE_RE =
  /제\s*\d+\s*호\s*법정|제\s*\d+\s*호법정|\d+\s*호\s*법정|\d+\s*호법정|본관|별관|신별관|법정/;

/** 제33호법정 → 제33호 법정 */
export function normalizeCourtPlaceText(place: string): string {
  return place
    .replace(/(제\d+)호(법정)/, "$1호 $2")
    .replace(/(\d+)호(법정)/, "$1호 $2")
    .trim();
}

function memoBodyWithoutSyncTag(memo: string): string {
  return memo.replace(/^\[court_sync\][^\s]+\s*/, "").trim();
}

function splitMemoSegments(memo?: string): string[] {
  if (!memo?.trim()) return [];
  const body = memo.includes("[court_sync]")
    ? memoBodyWithoutSyncTag(memo)
    : memo.trim();
  return body.split(" / ").map((s) => s.trim()).filter(Boolean);
}

/** memo 첫 구간 또는 시간 패턴에서 기일 시각 추출 */
export function parseTimeFromDeadlineMemo(memo?: string): string {
  if (!memo?.trim()) return "미정";
  for (const seg of splitMemoSegments(memo)) {
    if (TIME_RE.test(seg)) return seg;
  }
  const labeled = memo.match(/시각:\s*([^/·]+)/);
  if (labeled?.[1]?.trim()) return labeled[1].trim();
  return "미정";
}

/** memo에서 법정 호실(기일장소) 추출 — 예: 제231호 법정 */
export function parsePlaceFromDeadlineMemo(memo?: string): string | null {
  if (!memo?.trim()) return null;

  const labeled = memo.match(/(?:장소|기일장소):\s*([^/·]+)/);
  if (labeled?.[1]?.trim()) return labeled[1].trim();

  const segments = splitMemoSegments(memo);
  for (const seg of segments) {
    if (TIME_RE.test(seg)) continue;
    if (/^(속행|변론종결|기일변경|연기|취소|종결|불출석)/.test(seg)) continue;
    if (PLACE_RE.test(seg) || (seg.includes("호") && seg.includes("법정"))) {
      return normalizeCourtPlaceText(seg);
    }
  }

  if (segments.length >= 2 && TIME_RE.test(segments[0])) {
    const candidate = segments[1];
    if (candidate && !/^(속행|변론)/.test(candidate)) {
      return PLACE_RE.test(candidate) || candidate.includes("호")
        ? normalizeCourtPlaceText(candidate)
        : candidate;
    }
  }

  return null;
}

/** memo에서 담당 전화번호 추출 */
export function parseContactPhoneFromMemo(memo?: string): string | null {
  if (!memo?.trim()) return null;
  const labeled = memo.match(/(?:담당전화|연락처|전화)\s*[:：]\s*([0-9\-.\s]+)/);
  if (labeled?.[1]) return labeled[1].replace(/\s/g, "").trim();
  const m = memo.match(PHONE_REGEX);
  return m ? m[0].replace(/\s/g, "") : null;
}

type StaffPhoneSource = Pick<StaffMember, "name" | "phone" | "companyPhone" | "personalPhone">;

/** 담당자 이름으로 직원 연락처 조회 */
export function resolveStaffContactPhone(
  name: string | undefined,
  staffList: StaffPhoneSource[]
): string | null {
  if (!name?.trim() || !staffList.length) return null;
  const target = name.trim();
  const member = staffList.find(
    (s) =>
      s.name.trim() === target ||
      s.name.trim().includes(target) ||
      target.includes(s.name.trim())
  );
  if (!member) return null;
  const phone =
    member.phone?.trim() ||
    member.personalPhone?.trim() ||
    member.companyPhone?.trim();
  return phone || null;
}

export function formatDeadlineDateTime(date: string, time: string): string {
  const base = formatDate(date);
  if (time && time !== "미정") return `${base} ${time}`;
  return base;
}

/** 예: 2026.07.07. */
export function formatCourtDeadlineDateDot(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}.`;
  const base = formatDate(date);
  return base.endsWith(".") ? base : `${base}.`;
}

/** 기일장소만 — 예: 제231호 법정 */
export function getDeadlinePlaceText(deadline: DeadlineRow, caseCourt = ""): string | null {
  const fromMemo = parsePlaceFromDeadlineMemo(deadline.memo);
  if (fromMemo) return fromMemo;

  const institution = (deadline.court?.trim() || caseCourt?.trim() || "");
  const full = getDeadlineLocation(deadline, caseCourt);
  if (!full || full === "미정" || full === institution) return null;
  if (institution && full.startsWith(institution)) {
    const rest = full.slice(institution.length).trim();
    return rest || null;
  }
  return full !== institution ? full : null;
}

export type CourtDeadlineSummaryCtx = {
  caseNumber: string;
  clientName: string;
  court?: string;
  /** 재판부·기관연락처 (메모 3행) */
  courtDivision?: string;
};

/**
 * 하단 메모·연동 메시지 형식
 * 2026고합3 김유리(캄보디아) [공판기일 [영상]]
 * 2026.06.23.    대전지방법원 홍성지원 제214호 중법정
 * 제 3 형사부(나) (전화:031-828-0421 (수요일,금요일은 재판으로 업무처리가 어렵습니다.))
 */
export function formatCourtDeadlineSummary(
  deadline: DeadlineRow,
  ctx: CourtDeadlineSummaryCtx
): string {
  const type = deadline.type?.trim() || "기일";
  const time = parseTimeFromDeadlineMemo(deadline.memo);
  const datePart = formatCourtDeadlineDateDot(deadline.date);
  const timePart = time !== "미정" ? time : "";
  const courtName = ctx.court ?? deadline.court ?? "";
  const place = getDeadlineLocation(deadline, courtName);
  const contactLine = formatCourtDivisionContactLine(ctx.courtDivision);

  const line1 = `${ctx.caseNumber} ${ctx.clientName} [${type}]`;
  const line2 = [datePart, timePart, place !== "미정" ? place : ""]
    .filter(Boolean)
    .join("    ");
  const lines = [line1, line2];
  if (contactLine) lines.push(contactLine);
  return lines.join("\n");
}

export function getDeadlineLocation(deadline: DeadlineRow, caseCourt: string): string {
  const institution = deadline.court?.trim() || caseCourt?.trim() || "";
  const place = parsePlaceFromDeadlineMemo(deadline.memo);

  const normalizedPlace = place ? normalizeCourtPlaceText(place) : null;
  if (institution && normalizedPlace) {
    if (institution.includes(normalizedPlace) || normalizedPlace.includes(institution)) {
      return normalizedPlace;
    }
    return `${institution} ${normalizedPlace}`;
  }
  if (normalizedPlace) return normalizedPlace;
  return institution || "미정";
}

export function getDeadlineContactPhone(
  deadline: DeadlineRow,
  fallbackStaffName: string,
  staffList: StaffPhoneSource[]
): string {
  return (
    parseContactPhoneFromMemo(deadline.memo) ??
    resolveStaffContactPhone(deadline.assignedStaff || fallbackStaffName, staffList) ??
    "미등록"
  );
}
