import type { ApprovalDoc } from "./types";
import type { ApprovalListTab } from "./approvalConfig";
import type { ApprovalSearchParams } from "./approvalFilters";

const fetchOpts = { credentials: "include" as const, cache: "no-store" as const };

export type FetchApprovalsOptions = ApprovalSearchParams & {
  tab?: ApprovalListTab;
  /** 결재관리 탭: 동일 관리번호 조직의 결재완료 문서만 */
  management?: boolean;
};

export async function fetchApprovals(opts: FetchApprovalsOptions = {}): Promise<ApprovalDoc[]> {
  const params = new URLSearchParams();
  if (opts.tab && opts.tab !== "전체") params.set("tab", opts.tab);
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.dateFrom) params.set("dateFrom", opts.dateFrom);
  if (opts.dateTo) params.set("dateTo", opts.dateTo);
  if (opts.docType && opts.docType !== "전체") params.set("docType", opts.docType);
  if (opts.management) params.set("management", "1");

  const qs = params.toString();
  const res = await fetch(`/api/approvals${qs ? `?${qs}` : ""}`, fetchOpts);
  const json = (await res.json()) as { data?: ApprovalDoc[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? "결재 목록 조회 실패");
  return json.data ?? [];
}

/** 게시판 결재관리: 동일 관리번호 조직의 결재완료 문서 */
export async function fetchApprovalManagementDocs(q?: string): Promise<ApprovalDoc[]> {
  const docs = await fetchApprovals({ tab: "완료", management: true, q });
  return docs.filter((d) => d.status === "결재완료" && !d.deletedAt);
}

export async function createApprovalDoc(
  doc: Partial<ApprovalDoc> & {
    attachmentData?: { name: string; data: string }[];
    financeEntryId?: string;
  }
): Promise<ApprovalDoc> {
  const res = await fetch("/api/approvals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...fetchOpts,
    body: JSON.stringify(doc),
  });
  const json = (await res.json()) as { data?: ApprovalDoc; error?: string };
  if (!res.ok) throw new Error(json.error ?? "기안 실패");
  return json.data!;
}

export type ApprovalDetail = {
  data: ApprovalDoc;
  history: Array<{
    id: string;
    actor_name: string;
    action: string;
    comment?: string | null;
    created_at: string;
  }>;
  attachmentData?: { name: string; data: string }[];
};

export async function fetchApprovalDetail(id: string): Promise<ApprovalDetail> {
  const res = await fetch(`/api/approvals/${id}`, fetchOpts);
  const json = (await res.json()) as ApprovalDetail & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "결재 문서 조회 실패");
  return json;
}

export async function updateApprovalDoc(
  id: string,
  doc: Partial<ApprovalDoc> & {
    attachmentData?: { name: string; data: string }[];
    financeEntryId?: string;
    keepExistingAttachments?: boolean;
  }
): Promise<ApprovalDoc> {
  const res = await fetch(`/api/approvals/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    ...fetchOpts,
    body: JSON.stringify(doc),
  });
  const json = (await res.json()) as { data?: ApprovalDoc; error?: string };
  if (!res.ok) throw new Error(json.error ?? "결재 수정 실패");
  return json.data!;
}

export async function deleteApprovalDoc(
  id: string
): Promise<{ mode: "soft" | "permanent"; data?: ApprovalDoc; id?: string }> {
  const res = await fetch(`/api/approvals/${id}`, {
    method: "DELETE",
    ...fetchOpts,
  });
  const json = (await res.json()) as {
    ok?: boolean;
    mode?: "soft" | "permanent";
    data?: ApprovalDoc;
    id?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? "결재 삭제 실패");
  return { mode: json.mode ?? "soft", data: json.data, id: json.id };
}

export async function patchApproval(
  id: string,
  input: {
    action: "approve" | "reject" | "revert" | "comment";
    comment?: string;
    messageToDrafter?: string;
  }
): Promise<ApprovalDoc> {
  const res = await fetch(`/api/approvals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    ...fetchOpts,
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as { data?: ApprovalDoc; error?: string };
  if (!res.ok) throw new Error(json.error ?? "결재 처리 실패");
  return json.data!;
}
