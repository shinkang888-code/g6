/**
 * 도메인별 검색결과 엑셀보내기
 */

import type { ApprovalDoc } from "@/lib/types";
import type { BoardPost } from "@/lib/boardBridge";
import type { Notification } from "@/lib/types";
import type { BankTransaction, FinanceEntry } from "@/lib/types";
import type { CaseHistoryEntry } from "@/lib/caseHistoryStorage";
import type { CallMemoItem } from "@/lib/callMemoStorage";
import { exportCasesToExcel } from "@/lib/caseExcel";
import { exportClientsToExcel as exportClientsToExcelRaw } from "@/lib/clientExcel";
import { exportMembersToExcel as exportMembersToExcelRaw, type MemberForExport } from "@/lib/memberExcel";
import { exportStaffToExcel as exportStaffToExcelRaw } from "@/lib/staffExcel";
import { exportDeadlinesToLawTopExcel, type DeadlineExportItem } from "@/lib/deadlineExcel";
import { exportSearchResultExcel } from "@/lib/listExcelExport";
import { caseStatusFilterToApiParam } from "@/lib/caseStatusFilter";
import type { FilterConfig } from "@/lib/types";
import type { CaseItem, ClientItem, StaffMember, NoticeItem } from "@/lib/types";
import { formatDate, formatAmount } from "@/lib/utils";

type CaseApiParams = {
  q?: string;
  staffQ?: string;
  filters?: FilterConfig[];
  sortByNextDeadline?: boolean;
};

function buildCaseListParams(opts: CaseApiParams, page: number, pageSize: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.staffQ?.trim()) params.set("staff_q", opts.staffQ.trim());
  if (opts.sortByNextDeadline) params.set("sort_by", "next_deadline");
  for (const f of opts.filters ?? []) {
    if (f.operator !== "equals") continue;
    if (f.field === "status") {
      const statusParam = caseStatusFilterToApiParam(String(f.value));
      if (statusParam) params.set("status", statusParam);
    } else if (f.field === "caseType") {
      params.set("case_type", String(f.value));
    } else if (f.field === "court") {
      params.set("court", String(f.value));
    } else if (f.field === "assignedStaff") {
      params.set("assigned_staff", String(f.value));
    }
  }
  return params;
}

export async function fetchAllCasesForExport(opts: CaseApiParams): Promise<CaseItem[]> {
  const pageSize = 500;
  let page = 1;
  const all: CaseItem[] = [];
  while (true) {
    const params = buildCaseListParams(opts, page, pageSize);
    const res = await fetch(`/api/admin/cases?${params.toString()}`, { credentials: "include" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "사건 목록 조회 실패");
    const rows = Array.isArray(json.data) ? (json.data as CaseItem[]) : [];
    all.push(...rows);
    const total = typeof json.total === "number" ? json.total : rows.length;
    if (all.length >= total || rows.length < pageSize) break;
    page += 1;
  }
  return all;
}

/** 선택한 사건 ID 목록으로보내기용 데이터 조회 */
export async function fetchCasesByIds(ids: string[]): Promise<CaseItem[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const results = await Promise.all(
    unique.map(async (id) => {
      const res = await fetch(`/api/admin/cases?id=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) return null;
      const rows = Array.isArray(json.data) ? (json.data as CaseItem[]) : [];
      return rows[0] ?? null;
    })
  );

  const byId = new Map(results.filter(Boolean).map((c) => [c!.id, c!]));
  return unique.map((id) => byId.get(id)).filter((c): c is CaseItem => Boolean(c));
}

export async function fetchAllAdminCasesForExport(opts: {
  q?: string;
  status?: string;
  caseType?: string;
  court?: string;
  assignedStaff?: string;
}): Promise<Record<string, unknown>[]> {
  const pageSize = 500;
  let page = 1;
  const all: Record<string, unknown>[] = [];
  while (true) {
    const params = new URLSearchParams();
    if (opts.q?.trim()) params.set("q", opts.q.trim());
    if (opts.status) params.set("status", opts.status);
    if (opts.caseType) params.set("case_type", opts.caseType);
    if (opts.court) params.set("court", opts.court);
    if (opts.assignedStaff) params.set("assigned_staff", opts.assignedStaff);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    const res = await fetch(`/api/admin/cases?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "사건 목록 조회 실패");
    const rows = Array.isArray(json.data) ? json.data : [];
    all.push(...rows);
    const total = typeof json.total === "number" ? json.total : rows.length;
    if (all.length >= total || rows.length < pageSize) break;
    page += 1;
  }
  return all;
}

export function mapApiCaseRow(c: Record<string, unknown>) {
  return {
    caseNumber: String(c.caseNumber ?? c.case_number ?? ""),
    caseType: String(c.caseType ?? c.case_type ?? ""),
    caseName: String(c.caseName ?? c.case_name ?? ""),
    court: String(c.court ?? ""),
    clientName: String(c.clientName ?? c.client_name ?? ""),
    clientPosition: String(c.clientPosition ?? c.client_position ?? ""),
    opponentName: String(c.opponentName ?? c.opponent_name ?? ""),
    status: String(c.status ?? "진행중"),
    assignedStaff: String(c.assignedStaff ?? c.assigned_staff_name ?? ""),
    assistants: String(c.assistants ?? ""),
    receivedDate: String(c.receivedDate ?? c.received_date ?? ""),
    amount: Number(c.amount ?? 0),
    receivedAmount: Number(c.receivedAmount ?? c.received_amount ?? 0),
    pendingAmount: Number(c.pendingAmount ?? c.pending_amount ?? 0),
    isElectronic: Boolean(c.isElectronic ?? c.is_electronic),
    isUrgent: Boolean(c.isUrgent ?? c.is_urgent),
    isImmutable: Boolean(c.isImmutable ?? c.is_immutable_deadline),
    notes: String(c.notes ?? ""),
    nextDate: (c.nextDate ?? c.next_date ?? null) as string | null,
    nextDateType: String(c.nextDateType ?? c.next_date_type ?? ""),
  };
}

export function exportCasesSearchResult(cases: Parameters<typeof exportCasesToExcel>[0], prefix = "사건목록_검색결과") {
  exportCasesToExcel(cases, prefix);
}

export function exportApprovalsSearchResult(items: ApprovalDoc[], tabLabel: string) {
  return exportSearchResultExcel(
    items,
    [
      { header: "제목", value: (r) => r.title },
      { header: "유형", value: (r) => r.type },
      { header: "상태", value: (r) => r.status },
      { header: "사건번호", value: (r) => r.caseNumber },
      { header: "기안자", value: (r) => r.requesterName },
      { header: "금액", value: (r) => r.amount ?? "" },
      { header: "기안일", value: (r) => formatDate(r.createdAt) },
      { header: "완료일", value: (r) => (r.completedAt ? formatDate(r.completedAt) : "") },
    ],
    { filenamePrefix: `결재목록_${tabLabel}`, sheetName: "결재" }
  );
}

export function exportBoardPostsSearchResult(posts: BoardPost[], boardName: string) {
  return exportSearchResultExcel(
    posts,
    [
      { header: "번호", value: (r) => r.id },
      { header: "제목", value: (r) => r.subject },
      { header: "작성자", value: (r) => r.author },
      { header: "조회", value: (r) => r.hit ?? 0 },
      { header: "작성일", value: (r) => formatDate(r.createdAt) },
    ],
    { filenamePrefix: `게시판_${boardName}`, sheetName: "게시글" }
  );
}

export function exportCaseHistorySearchResult(items: CaseHistoryEntry[]) {
  return exportSearchResultExcel(
    items,
    [
      { header: "사건번호", value: (r) => r.caseNumber },
      { header: "의뢰인", value: (r) => r.clientName },
      { header: "작업", value: (r) => r.action },
      { header: "계정", value: (r) => r.accountName },
      { header: "일시", value: (r) => r.timestamp },
    ],
    { filenamePrefix: "사건이력_검색결과", sheetName: "이력" }
  );
}

export function exportNotificationsSearchResult(items: Notification[]) {
  return exportSearchResultExcel(
    items,
    [
      { header: "제목", value: (r) => r.title },
      { header: "내용", value: (r) => r.message },
      { header: "유형", value: (r) => r.type },
      { header: "읽음", value: (r) => (r.isRead ? "Y" : "") },
      { header: "일시", value: (r) => formatDate(r.createdAt) },
    ],
    { filenamePrefix: "알림_검색결과", sheetName: "알림" }
  );
}

type FinanceRow = { 구분: string; 일자: string; 거래처: string; 금액: number; 비고: string };

export async function exportFinanceLedgerExcel(): Promise<boolean> {
  try {
    const res = await fetch("/api/finance/ledger", { credentials: "include" });
    const data = (await res.json()) as {
      entries?: FinanceEntry[];
      transactions?: BankTransaction[];
      error?: string;
    };
    if (!res.ok) return false;
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    if (entries.length === 0 && transactions.length === 0) return false;
    return exportFinanceSearchResult(transactions, entries, "수납대장");
  } catch {
    return false;
  }
}

export function exportFinanceSearchResult(
  transactions: BankTransaction[],
  entries: FinanceEntry[],
  filenamePrefix = "회계_검색결과"
) {
  const rows: FinanceRow[] = [
    ...transactions.map((t) => ({
      구분: "입금",
      일자: formatDate(t.date),
      거래처: t.depositorName,
      금액: t.amount,
      비고: t.memo ?? "",
    })),
    ...entries.map((e) => ({
      구분: "미수",
      일자: formatDate(e.date),
      거래처: e.clientName,
      금액: e.amount,
      비고: `${e.caseNumber} ${e.description ?? ""}`.trim(),
    })),
  ];
  return exportSearchResultExcel(
    rows,
    [
      { header: "구분", value: (r) => r.구분 },
      { header: "일자", value: (r) => r.일자 },
      { header: "거래처", value: (r) => r.거래처 },
      { header: "금액", value: (r) => formatAmount(r.금액) },
      { header: "비고", value: (r) => r.비고 },
    ],
    { filenamePrefix, sheetName: "회계" }
  );
}

export function exportCallMemosSearchResult(items: CallMemoItem[]) {
  return exportSearchResultExcel(
    items,
    [
      { header: "제목", value: (r) => r.title },
      { header: "발신자", value: (r) => r.callerName },
      { header: "연락처", value: (r) => r.phone },
      { header: "내용", value: (r) => r.content },
      { header: "등록일", value: (r) => formatDate(r.createdAt) },
    ],
    { filenamePrefix: "전화메모_검색결과", sheetName: "콜메모" }
  );
}

export function exportDeadlinesSearchResult(items: DeadlineExportItem[], prefix: string) {
  if (items.length === 0) return false;
  exportDeadlinesToLawTopExcel(items, prefix);
  return true;
}

export function exportNoticesSearchResult(items: NoticeItem[]) {
  return exportSearchResultExcel(
    items,
    [
      { header: "제목", value: (r) => r.title },
      { header: "작성자", value: (r) => r.authorName },
      { header: "내용", value: (r) => r.content },
      { header: "작성일", value: (r) => formatDate(r.createdAt) },
    ],
    { filenamePrefix: "공지_검색결과", sheetName: "공지" }
  );
}

export function exportClientsToExcel(clients: ClientItem[]): boolean {
  if (clients.length === 0) return false;
  exportClientsToExcelRaw(clients);
  return true;
}

export function exportMembersToExcel(members: MemberForExport[]): boolean {
  if (members.length === 0) return false;
  exportMembersToExcelRaw(members);
  return true;
}

export function exportStaffToExcel(staffList: StaffMember[]): boolean {
  if (staffList.length === 0) return false;
  exportStaffToExcelRaw(staffList);
  return true;
}
