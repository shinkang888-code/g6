/**
 * 체험판(관리번호 10000) 당사자·의뢰인 이름 마스킹
 * - 첫 글자만 표시, 나머지는 * (예: 강민수 → 강**, 홍길동 → 홍**)
 */

import type { NextRequest } from "next/server";
import type { CaseInstitution } from "@/lib/caseInstitutionTypes";
import type { CaseParty } from "@/lib/casePartyTypes";
import type { ClientItem } from "@/lib/types";
import { isTrialManagementNumber } from "@/lib/trialTenant";

export const TRIAL_UNMASK_HEADER = "x-lawygo-unmask";

/** 사건 수정 폼에서만 원문 이름 로드 (저장 시 마스킹 문자열이 DB에 들어가는 것 방지) */
export const trialFormEditFetchHeaders: HeadersInit = {
  [TRIAL_UNMASK_HEADER]: "1",
};

export function maskPersonName(name: string | null | undefined): string {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 1) return trimmed;
  return trimmed.charAt(0) + "*".repeat(trimmed.length - 1);
}

export function shouldMaskTrialNames(
  managementNumber: string | null | undefined,
  request?: NextRequest
): boolean {
  if (!isTrialManagementNumber(managementNumber)) return false;
  if (!request) return true;
  return request.headers.get(TRIAL_UNMASK_HEADER) !== "1";
}

export type MaskableCaseFields = {
  clientName?: string | null;
  opponentName?: string | null;
};

export function maskCaseFields<T extends MaskableCaseFields>(item: T): T {
  return {
    ...item,
    ...(item.clientName !== undefined && item.clientName !== null
      ? { clientName: maskPersonName(item.clientName) }
      : {}),
    ...(item.opponentName !== undefined && item.opponentName !== null
      ? { opponentName: maskPersonName(item.opponentName) }
      : {}),
  };
}

export function maskPartyRecord<T extends { name?: string | null }>(party: T): T {
  if (!party.name?.trim()) return party;
  return { ...party, name: maskPersonName(party.name) };
}

export function maskPartiesList<T extends { name?: string | null }>(parties: T[]): T[] {
  return parties.map(maskPartyRecord);
}

export function maskInstitutionRecord(
  inst: CaseInstitution | Record<string, unknown>
): CaseInstitution | Record<string, unknown> {
  const contact = (inst as { contactName?: string }).contactName;
  if (!contact?.trim()) return inst;
  return { ...inst, contactName: maskPersonName(contact) };
}

export function maskInstitutionsList(
  list: Array<CaseInstitution | Record<string, unknown>>
): Array<CaseInstitution | Record<string, unknown>> {
  return list.map(maskInstitutionRecord);
}

export function maskClientRecord(client: ClientItem): ClientItem {
  return { ...client, name: maskPersonName(client.name) };
}

export function maskClientsList(clients: ClientItem[]): ClientItem[] {
  return clients.map(maskClientRecord);
}

export type DeadlineListItem = {
  clientName?: string;
  [key: string]: unknown;
};

export function maskDeadlineListItem<T extends DeadlineListItem>(row: T): T {
  if (!row.clientName?.trim()) return row;
  return { ...row, clientName: maskPersonName(row.clientName) };
}

export function maskDeadlineList<T extends DeadlineListItem>(rows: T[]): T[] {
  return rows.map(maskDeadlineListItem);
}
