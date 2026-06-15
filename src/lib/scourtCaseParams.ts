/**
 * 나의사건검색 조회 파라미터 (클라이언트·서버 공용)
 */
import { parseCaseNumber, type ScourtJob } from "@/lib/scourtBot";
import { isValidScourtPartyName, normalizePartyNameForScourt } from "@/lib/scourtPartyName";

export interface SyncCaseInput {
  id: string;
  case_number: string;
  court: string;
  client_name: string;
}

/** 나의사건검색으로 조회 불가한 내부 관리번호 */
export function isInternalOnlyCaseNumber(caseNumber: string): boolean {
  const cn = String(caseNumber ?? "").replace(/\s/g, "");
  if (!cn) return true;
  if (/^J\d/i.test(cn)) return true;
  if (/^\d{4}-\d+/.test(cn)) return true;
  if (/접수/.test(cn)) return true;
  const parsed = parseCaseNumber(cn);
  if (parsed?.gubun === "형제") return true;
  return false;
}

/** 검찰 단계 — 법원 나의사건검색 대상 아님 */
export function isProsecutionCourt(court: string): boolean {
  return /검찰/.test(String(court ?? ""));
}

export function buildScourtJobFromCase(
  c: SyncCaseInput
): { job: ScourtJob } | { error: string } {
  const caseNumber = String(c.case_number ?? "").trim();
  if (isInternalOnlyCaseNumber(caseNumber)) {
    return { error: `내부관리번호(형제/J키 등) — 법원 사건번호로 등록 필요 (${caseNumber})` };
  }
  const parsed = parseCaseNumber(caseNumber);
  if (!parsed.year || !parsed.gubun || !parsed.serial) {
    return { error: `사건번호 형식 불가 (${caseNumber})` };
  }
  const court = String(c.court ?? "").trim();
  if (!court || court === "미정") {
    return { error: "법원(계속기관) 미등록" };
  }
  if (isProsecutionCourt(court)) {
    return { error: `검찰 단계 사건 — 법원 계속기관으로 변경 필요 (${court})` };
  }
  const partyName = normalizePartyNameForScourt(c.client_name ?? "");
  if (!isValidScourtPartyName(c.client_name ?? "")) {
    const raw = String(c.client_name ?? "").trim();
    if (!raw || raw === "(의뢰인 없음)") return { error: "의뢰인명 없음" };
    return { error: `의뢰인명 정규화 불가 (${raw})` };
  }
  return {
    job: {
      courtName: court,
      year: parsed.year,
      gubun: parsed.gubun,
      serial: parsed.serial,
      partyName,
      matchCaseId: c.id,
    },
  };
}

export function canSyncCase(c: {
  id?: string;
  caseNumber?: string;
  court?: string;
  clientName?: string;
}): boolean {
  return !("error" in buildScourtJobFromCase({
    id: c.id ?? "",
    case_number: c.caseNumber ?? "",
    court: c.court ?? "",
    client_name: c.clientName ?? "",
  }));
}
