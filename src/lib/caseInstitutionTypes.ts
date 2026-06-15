/** 사건 계속기관(진행단계별) 타입 */

export type CaseInstitutionStage =
  | "police"
  | "prosecution"
  | "court_1"
  | "court_2"
  | "court_3"
  | "detention";

export const CASE_INSTITUTION_STAGES: {
  value: CaseInstitutionStage;
  label: string;
  shortLabel: string;
  sortOrder: number;
}[] = [
  { value: "police", label: "수사기관 (경찰)", shortLabel: "경찰", sortOrder: 0 },
  { value: "prosecution", label: "수사기관 (검찰)", shortLabel: "검찰", sortOrder: 1 },
  { value: "court_1", label: "법원 (1심)", shortLabel: "1심", sortOrder: 2 },
  { value: "court_2", label: "법원 (2심)", shortLabel: "2심", sortOrder: 3 },
  { value: "court_3", label: "법원 (3심)", shortLabel: "3심", sortOrder: 4 },
  { value: "detention", label: "구금", shortLabel: "구금", sortOrder: 5 },
];

export const TRIAL_LEVELS = ["1심", "2심", "3심", "기타"] as const;
export type TrialLevel = (typeof TRIAL_LEVELS)[number];

export interface CaseInstitution {
  id: string;
  caseId: string;
  stage: CaseInstitutionStage;
  sortOrder: number;
  agencyName?: string;
  caseNumber?: string;
  caseName?: string;
  department?: string;
  contactName?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  room?: string;
  notes?: string;
  detentionAgency?: string;
  detentionNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export type CaseInstitutionInput = Omit<
  CaseInstitution,
  "id" | "caseId" | "createdAt" | "updatedAt"
> & { id?: string };

export function emptyInstitution(stage: CaseInstitutionStage): CaseInstitutionInput {
  const meta = CASE_INSTITUTION_STAGES.find((s) => s.value === stage);
  return {
    stage,
    sortOrder: meta?.sortOrder ?? 0,
    agencyName: "",
    caseNumber: "",
    caseName: "",
    department: "",
    contactName: "",
    phone: "",
    mobile: "",
    fax: "",
    email: "",
    room: "",
    notes: "",
    detentionAgency: "",
    detentionNumber: "",
  };
}

export function createEmptyInstitutionsMap(): Record<CaseInstitutionStage, CaseInstitutionInput> {
  return CASE_INSTITUTION_STAGES.reduce(
    (acc, s) => {
      acc[s.value] = emptyInstitution(s.value);
      return acc;
    },
    {} as Record<CaseInstitutionStage, CaseInstitutionInput>
  );
}

/** 사건번호 패턴으로 심급 추론 */
export function inferTrialLevel(caseNumber: string): TrialLevel {
  const n = String(caseNumber ?? "").replace(/\s/g, "");
  if (/^(\d{4})두|^(\d{4})노|^(\d{4})도|^(\d{4})르|^(\d{4})머/.test(n)) return "2심";
  if (/^(\d{4})다|^(\d{4})스|^(\d{4})재/.test(n)) return "3심";
  return "1심";
}

export function trialLevelToCourtStage(level: string): CaseInstitutionStage {
  if (level === "2심") return "court_2";
  if (level === "3심") return "court_3";
  return "court_1";
}

export function extractPhoneFromCourtDivision(raw?: string | null): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const m = text.match(/(?:전화|Tel|TEL)\s*[:：]?\s*([0-9][0-9\-.\s]{8,})/i);
  if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
  const m2 = text.match(/(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}|010[-.\s]?\d{4}[-.\s]?\d{4})/);
  return m2?.[0]?.trim() ?? null;
}

export function institutionHasData(inst: CaseInstitutionInput): boolean {
  return Boolean(
    inst.agencyName?.trim() ||
      inst.caseNumber?.trim() ||
      inst.department?.trim() ||
      inst.contactName?.trim() ||
      inst.phone?.trim() ||
      inst.mobile?.trim() ||
      inst.fax?.trim() ||
      inst.email?.trim() ||
      inst.room?.trim() ||
      inst.notes?.trim() ||
      inst.detentionAgency?.trim() ||
      inst.detentionNumber?.trim()
  );
}
