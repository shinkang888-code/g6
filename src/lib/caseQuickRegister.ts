import { parseCaseNumber, type ScourtJob } from "@/lib/scourtBot";
import { normalizePartyNameForScourt } from "@/lib/scourtPartyName";
import { inferCaseType } from "@/lib/caseExcel";
import { DEMO_NAME } from "@/lib/demoAuth";

export const DEFAULT_QUICK_LAWYER = DEMO_NAME;
export const DEFAULT_QUICK_STAFF = "신강";

export type QuickRegisterFields = {
  caseNumber: string;
  courtName: string;
  partyName: string;
};

export function validateQuickRegisterFields(fields: QuickRegisterFields): Record<string, string> {
  const errs: Record<string, string> = {};
  const cn = fields.caseNumber.trim();
  if (!cn) errs.caseNumber = "사건번호를 입력하세요.";
  else {
    const parsed = parseCaseNumber(cn.replace(/\s/g, ""));
    if (!parsed?.year || !parsed.gubun || !parsed.serial) {
      errs.caseNumber = "사건번호 형식을 확인하세요. (예: 2025가소32949)";
    }
  }
  if (!fields.courtName.trim()) errs.court = "기관을 입력하세요.";
  if (!fields.partyName.trim()) errs.partyName = "당사자 이름을 입력하세요.";
  else if (fields.partyName.trim().length < 2) errs.partyName = "당사자명은 2자 이상 입력하세요.";
  return errs;
}

export function buildQuickScourtJob(fields: QuickRegisterFields): ScourtJob | null {
  const parsed = parseCaseNumber(fields.caseNumber.replace(/\s/g, ""));
  if (!parsed?.year || !parsed.gubun || !parsed.serial) return null;
  const party = normalizePartyNameForScourt(fields.partyName.trim());
  if (!party) return null;
  return {
    courtName: fields.courtName.trim(),
    year: parsed.year,
    gubun: parsed.gubun,
    serial: parsed.serial,
    partyName: party,
  };
}

export function inferQuickCaseType(caseNumber: string, explicit?: string): string {
  return inferCaseType(caseNumber, explicit?.trim() || "");
}
