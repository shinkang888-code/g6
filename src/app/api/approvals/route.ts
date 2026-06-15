/**
 * 전자결재 API (LawTop ElectronicApproval / LawTopProcess)
 * GET ?tab=전체|나의작성|미결재|기결재|참조협조|결재중|완료&q=&dateFrom=&dateTo=&docType=
 * POST — 기안(결재 요청)
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import type { ApprovalDoc, ApprovalStep } from "@/lib/types";
import {
  approvalDocFromRow,
  approvalRowFromDoc,
  getActiveApprovalSteps,
} from "@/lib/approvalWorkflow";
import { createNotification } from "@/lib/notificationServer";
import {
  filterByListTab,
  filterBySearch,
  type ApprovalSearchParams,
} from "@/lib/approvalFilters";
import type { ApprovalListTab } from "@/lib/approvalConfig";
import { isCompanyAdmin, isAnyPlatformStaff } from "@/lib/adminRoles";
import { resolveManagementNumber } from "@/lib/tenantScope";

function getDb() {
  return getSupabaseAdmin();
}

const LEGACY_TAB_MAP: Record<string, ApprovalListTab> = {
  mine: "나의작성",
  결재요청: "미결재",
  all: "전체",
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const sp = request.nextUrl.searchParams;
  const rawTab = sp.get("tab") ?? "전체";
  const managementMode = sp.get("management") === "1";
  const tab: ApprovalListTab = managementMode
    ? "완료"
    : LEGACY_TAB_MAP[rawTab] ?? (rawTab as ApprovalListTab);

  const searchParams: ApprovalSearchParams = {
    q: sp.get("q") ?? undefined,
    dateFrom: sp.get("dateFrom") ?? undefined,
    dateTo: sp.get("dateTo") ?? undefined,
    docType: sp.get("docType") ?? undefined,
  };

  const managementNumber = await resolveManagementNumber(session, db);
  let tenantMemberIds: string[] | null = null;
  const shouldScopeToTenant =
    Boolean(managementNumber) && (managementMode || !isAnyPlatformStaff(session));
  if (shouldScopeToTenant && managementNumber) {
    const { data: members } = await db
      .from("site_users")
      .select("id")
      .eq("management_number", managementNumber);
    tenantMemberIds = (members ?? []).map((m) => String(m.id)).filter(Boolean);
    if (!tenantMemberIds.length) {
      return NextResponse.json({ data: [], total: 0, tab });
    }
  }

  let query = db.from("approvals").select("*").order("created_at", { ascending: false }).limit(500);

  if (tenantMemberIds) {
    query = query.in("requester_id", tenantMemberIds);
  }

  const tabsIncludingSoftDeleted: ApprovalListTab[] = ["나의작성", "완료", "전체", "결재중"];
  if (!tabsIncludingSoftDeleted.includes(tab)) {
    query = query.is("deleted_at", null);
  }

  if (searchParams.dateFrom) {
    query = query.gte("created_at", `${searchParams.dateFrom.slice(0, 10)}T00:00:00`);
  }
  if (searchParams.dateTo) {
    query = query.lte("created_at", `${searchParams.dateTo.slice(0, 10)}T23:59:59`);
  }
  if (searchParams.docType && searchParams.docType !== "전체") {
    query = query.eq("doc_type", searchParams.docType);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let docs = (data ?? []).map((r) => approvalDocFromRow(r as Record<string, unknown>));
  docs = filterBySearch(docs, { ...searchParams, dateFrom: undefined, dateTo: undefined });
  docs = filterByListTab(docs, tab, session.userId, session.name, {
    isCompanyAdmin: isCompanyAdmin(session),
  });
  if (managementMode) {
    docs = docs.filter((d) => d.status === "결재완료" && !d.deletedAt);
  }

  return NextResponse.json({ data: docs, total: docs.length, tab });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  let body: Partial<ApprovalDoc> & {
    attachmentData?: { name: string; data: string }[];
    financeEntryId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const approvalLine = (body.approvalLine ?? []) as ApprovalStep[];
  if (!approvalLine.length) {
    return NextResponse.json({ error: "결재선이 필요합니다." }, { status: 400 });
  }

  const doc: ApprovalDoc = {
    id: "",
    title: body.title?.trim() || `기안 문서 · ${new Date().toLocaleDateString("ko-KR")}`,
    type: body.type ?? "기안서",
    status: "결재요청",
    caseId: body.caseId ?? "",
    caseNumber: body.caseNumber ?? "",
    requesterId: session.userId,
    requesterName: session.name,
    approvalLine,
    createdAt: new Date().toISOString(),
    notes: body.notes,
    metadata: body.metadata,
    attachmentNames: body.attachmentNames,
    referrerNames: body.referrerNames,
    referrerIds: body.referrerIds,
    amount: body.amount,
  };

  const row = {
    ...approvalRowFromDoc(doc, session.loginId),
    finance_entry_id: body.financeEntryId?.trim() || null,
    attachment_data: body.attachmentData ?? null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await db.from("approvals").insert(row).select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const saved = approvalDocFromRow(data as Record<string, unknown>);

  await db.from("approval_actions").insert({
    approval_id: saved.id,
    actor_id: session.userId,
    actor_name: session.name,
    action: "submit",
    comment: `${saved.type} 결재 요청`,
  });

  const active = getActiveApprovalSteps(saved.approvalLine);
  for (const step of active) {
    await createNotification(db, {
      userId: step.staffId,
      type: "approval_request",
      title: "결재 요청",
      message: `${session.name}님이 [${saved.type}] "${saved.title}" 결재를 요청했습니다.`,
      link: `/approval?doc=${saved.id}`,
      approvalId: saved.id,
    });
  }

  const referrerIds = saved.referrerIds ?? [];
  const referrerNames = saved.referrerNames ?? [];
  if (referrerIds.length) {
    for (const refId of referrerIds) {
      await createNotification(db, {
        userId: refId,
        type: "approval_request",
        title: "결재 참조",
        message: `${session.name}님이 [${saved.type}] "${saved.title}" 문서를 참조로 보냈습니다.`,
        link: `/approval?doc=${saved.id}&tab=참조협조`,
        approvalId: saved.id,
      });
    }
  } else if (referrerNames.length) {
    for (const refName of referrerNames) {
      await createNotification(db, {
        userId: refName,
        type: "approval_request",
        title: "결재 참조",
        message: `${session.name}님이 [${saved.type}] "${saved.title}" 문서를 참조로 보냈습니다.`,
        link: `/approval?doc=${saved.id}&tab=참조협조`,
        approvalId: saved.id,
      });
    }
  }

  return NextResponse.json({ data: saved });
}
