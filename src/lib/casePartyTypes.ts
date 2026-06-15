/** 사건 당사자 (다중 의뢰인·상대방·제3자) */

export type CasePartyRole = "client" | "opponent" | "third_party";

export const CASE_PARTY_ROLES: {
  value: CasePartyRole;
  label: string;
  shortLabel: string;
}[] = [
  { value: "client", label: "의뢰인", shortLabel: "의뢰인" },
  { value: "opponent", label: "상대방", shortLabel: "상대방" },
  { value: "third_party", label: "제3자", shortLabel: "제3자" },
];

export const PARTY_POSITIONS = [
  "피고인",
  "원고",
  "피고",
  "신청인",
  "피신청인",
  "채권자",
  "채무자",
  "청구인",
  "피청구인",
  "고소인",
  "피의자",
  "피해자",
];

export interface CaseParty {
  id: string;
  caseId: string;
  role: CasePartyRole;
  sortOrder: number;
  clientId?: string;
  name: string;
  position?: string;
  isCorporate?: boolean;
  phone?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  address?: string;
  idNumber?: string;
  bizNumber?: string;
  /** clients.memo — case_parties 미저장, API·UI 전용 */
  clientMemo?: string;
  createdAt: string;
  updatedAt: string;
}

export type CasePartyInput = Omit<
  CaseParty,
  "id" | "caseId" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

export function createEmptyParty(role: CasePartyRole, sortOrder: number): CasePartyInput {
  return {
    role,
    sortOrder,
    name: "",
    position: "",
    isCorporate: false,
    phone: "",
    mobile: "",
    fax: "",
    email: "",
    address: "",
    idNumber: "",
    bizNumber: "",
  };
}

export function createInitialParties(): CasePartyInput[] {
  return [createEmptyParty("client", 0)];
}

export function partyHasData(party: CasePartyInput): boolean {
  return Boolean(party.name?.trim());
}

export function partiesByRole(parties: CasePartyInput[], role: CasePartyRole): CasePartyInput[] {
  return parties
    .filter((p) => p.role === role)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPrimaryClient(parties: CasePartyInput[]): CasePartyInput | null {
  const clients = partiesByRole(parties, "client");
  return clients[0] ?? null;
}

/** 목록용 상대방 요약: 1명이면 이름, 2명 이상이면 "홍길동 외 2명" */
export function formatOpponentSummary(names: string[]): string {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list[0]} 외 ${list.length - 1}명`;
}

export type CasePartyCaseSummary = {
  clientName: string;
  clientPosition: string;
  opponentName: string;
  clientId: string | null;
};

export function summarizePartiesForCase(parties: CasePartyInput[]): CasePartyCaseSummary {
  const clients = partiesByRole(parties, "client").filter(partyHasData);
  const opponents = partiesByRole(parties, "opponent").filter(partyHasData);
  const primary = clients[0];
  return {
    clientName: primary?.name?.trim() || "(의뢰인 없음)",
    clientPosition: primary?.position?.trim() || "",
    opponentName: formatOpponentSummary(opponents.map((o) => o.name)),
    clientId: primary?.clientId ?? null,
  };
}

/** 기존 cases 단일 필드 → parties 시드 */
export function buildPartiesFromLegacyCase(row: Record<string, unknown>): CasePartyInput[] {
  const out: CasePartyInput[] = [];
  const clientName = String(row.client_name ?? row.clientName ?? "").trim();
  const clientPosition = String(row.client_position ?? row.clientPosition ?? "").trim();
  const clientId = row.client_id ? String(row.client_id) : undefined;

  if (clientName && clientName !== "(의뢰인 없음)") {
    out.push({
      role: "client",
      sortOrder: 0,
      name: clientName,
      position: clientPosition || undefined,
      clientId,
    });
  }

  const opponentRaw = String(row.opponent_name ?? row.opponentName ?? "").trim();
  if (opponentRaw) {
    const names = opponentRaw
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const expanded =
      names.length > 0
        ? names
        : opponentRaw.includes(" 외 ")
          ? [opponentRaw.split(" 외 ")[0].trim()]
          : [opponentRaw];

    expanded.forEach((name, i) => {
      out.push({ role: "opponent", sortOrder: i, name });
    });
  }

  return out;
}
