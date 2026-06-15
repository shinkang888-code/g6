/**
 * 대시보드 실데이터 로더
 * - /api/admin/cases: 진행중 사건 수·내 담당 사건
 * - /api/deadlines: 기일 현황·다가오는 기일
 */

import type { CaseItem } from "./types";
import { getDDay } from "./utils";

export type DashboardDeadlineRow = {
  id: string;
  caseId?: string;
  caseNumber?: string;
  date: string;
  type?: string;
  court?: string;
  assignedStaff?: string;
  isImmutable?: boolean;
};

export type DashboardFetchResult = {
  activeCaseCount: number;
  myCases: CaseItem[];
  deadlineCases: CaseItem[];
  pendingPaymentCount: number;
  monthlyReceived: number;
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function deadlineToCaseItem(d: DashboardDeadlineRow): CaseItem {
  const caseNumber = d.caseNumber?.trim() || "미등록";
  return {
    id: d.caseId || d.id,
    caseNumber,
    caseType: "",
    caseName: caseNumber,
    court: d.court ?? "",
    clientName: "",
    clientPosition: "",
    opponentName: "",
    status: "진행중",
    assignedStaff: d.assignedStaff ?? "",
    assistants: "",
    nextDate: d.date,
    nextDateType: d.type ?? "기일",
    isElectronic: false,
    isUrgent: false,
    isImmutable: Boolean(d.isImmutable),
    receivedDate: "",
    amount: 0,
    receivedAmount: 0,
    pendingAmount: 0,
    notes: "",
    createdAt: "",
    updatedAt: "",
  };
}

function sortCasesByNextDate(cases: CaseItem[]): CaseItem[] {
  return [...cases].sort((a, b) => {
    const dA = a.nextDate ? getDDay(a.nextDate) : 999999;
    const dB = b.nextDate ? getDDay(b.nextDate) : 999999;
    if (dA !== dB) return dA - dB;
    if (a.nextDate && b.nextDate) {
      return new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime();
    }
    return 0;
  });
}

export async function fetchCurrentUserName(): Promise<string | undefined> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { user?: { name?: string; loginId?: string } };
    return json.user?.name?.trim() || json.user?.loginId?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function fetchDashboardData(userName?: string): Promise<DashboardFetchResult> {
  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = addDays(today, -7);
  const dateTo = addDays(today, 14);

  const countParams = new URLSearchParams({ status: "진행중", page_size: "1", page: "1" });
  const casesParams = new URLSearchParams({ status: "진행중", page_size: "100", page: "1" });
  if (userName?.trim()) casesParams.set("staff_q", userName.trim());

  const [countRes, casesRes, deadlinesRes, financeRes] = await Promise.all([
    fetch(`/api/admin/cases?${countParams}`, { credentials: "include" }),
    fetch(`/api/admin/cases?${casesParams}`, { credentials: "include" }),
    fetch(`/api/deadlines?dateFrom=${dateFrom}&dateTo=${dateTo}`, { credentials: "include" }),
    fetch("/api/finance?sync=0", { credentials: "include" }),
  ]);

  let activeCaseCount = 0;
  if (countRes.ok) {
    const json = (await countRes.json()) as { total?: number };
    activeCaseCount = typeof json.total === "number" ? json.total : 0;
  }

  let myCases: CaseItem[] = [];
  if (casesRes.ok) {
    const json = (await casesRes.json()) as { data?: CaseItem[] };
    const rows = Array.isArray(json.data) ? json.data : [];
    if (userName?.trim()) {
      const q = userName.trim().toLowerCase();
      myCases = rows.filter(
        (c) =>
          c.assignedStaff?.toLowerCase().includes(q) ||
          c.assistants?.toLowerCase().includes(q)
      );
    } else {
      myCases = rows;
    }
    myCases = sortCasesByNextDate(myCases);
  }

  let deadlineCases: CaseItem[] = [];
  if (deadlinesRes.ok) {
    const json = (await deadlinesRes.json()) as { data?: DashboardDeadlineRow[] };
    deadlineCases = (json.data ?? [])
      .filter((d) => d.date)
      .map(deadlineToCaseItem)
      .sort((a, b) => new Date(a.nextDate!).getTime() - new Date(b.nextDate!).getTime());
  }

  let pendingPaymentCount = 0;
  let monthlyReceived = 0;
  if (financeRes.ok) {
    const financeJson = (await financeRes.json()) as {
      stats?: { totalPending?: number; monthlyReceived?: number };
      entries?: unknown[];
    };
    const openEntries = Array.isArray(financeJson.entries) ? financeJson.entries.length : 0;
    pendingPaymentCount =
      openEntries > 0
        ? openEntries
        : financeJson.stats?.totalPending && financeJson.stats.totalPending > 0
          ? 1
          : 0;
    monthlyReceived = Number(financeJson.stats?.monthlyReceived ?? 0);
  }

  const pendingFromCases = myCases.filter((c) => Number(c.pendingAmount ?? 0) > 0).length;
  if (pendingFromCases > pendingPaymentCount) {
    pendingPaymentCount = pendingFromCases;
  }

  return { activeCaseCount, myCases, deadlineCases, pendingPaymentCount, monthlyReceived };
}
