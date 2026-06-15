/**
 * 전자결재 단건 — 조회 / 승인·반려·취소·메시지
 * PATCH { action: approve|reject|revert|comment, comment?, messageToDrafter? }
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import {
  approvalDocFromRow,
  applyApproveStep,
  applyRejectStep,
  applyRevertStep,
  canUserActOnApproval,
  canUserEditApprovalDoc,
  canUserDeleteApprovalDoc,
  computeApprovalStatus,
  getActiveApprovalSteps,
  approvalRowFromDoc,
} from "@/lib/approvalWorkflow";
import { isCompanyAdmin } from "@/lib/adminRoles";
import { logApprovalAdminDelete } from "@/lib/approvalDeleteAudit";
import type { ApprovalStep } from "@/lib/types";
import { createNotification } from "@/lib/notificationServer";
import { threadKeyForUsers } from "@/lib/internalMessageServer";
import { onApprovalFinanceComplete } from "@/lib/financeBillingServer";
import { resolveManagementNumber } from "@/lib/tenantScope";
import { resolveHVIdForSession } from "@/lib/ledger/ledgerRecord";
import {
  recordApprovalLedgerEvent,
  finalizeApprovalAgreement,
} from "@/lib/ledger/negotiationChain";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const { id } = await params;
  const { data, error } = await db.from("approvals").select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: history } = await db
    .from("approval_actions")
    .select("*")
    .eq("approval_id", id)
    .order("created_at", { ascending: false });

  const row = data as Record<string, unknown>;
  const attachmentData = Array.isArray(row.attachment_data)
    ? (row.attachment_data as { name: string; data: string }[])
    : undefined;

  return NextResponse.json({
    data: approvalDocFromRow(row),
    history: history ?? [],
    attachmentData,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const { id } = await params;
  let body: {
    action: "approve" | "reject" | "revert" | "comment";
    comment?: string;
    messageToDrafter?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { data: existing, error: loadErr } = await db
    .from("approvals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  }

  const doc = approvalDocFromRow(existing as Record<string, unknown>);
  const now = new Date().toISOString();
  let nextLine = doc.approvalLine;
  let actionLog = body.action;

  if (body.action === "approve") {
    if (!canUserActOnApproval(doc.approvalLine, session.userId, doc.status)) {
      return NextResponse.json({ error: "현재 결재 차례가 아닙니다." }, { status: 403 });
    }
    nextLine = applyApproveStep(doc.approvalLine, session.userId, now);
  } else if (body.action === "reject") {
    if (!canUserActOnApproval(doc.approvalLine, session.userId, doc.status)) {
      return NextResponse.json({ error: "현재 결재 차례가 아닙니다." }, { status: 403 });
    }
    nextLine = applyRejectStep(doc.approvalLine, session.userId, body.comment, now);

    if (body.messageToDrafter?.trim()) {
      await db.from("internal_messages").insert({
        sender_id: session.userId,
        sender_name: session.name,
        recipient_id: doc.requesterId,
        recipient_name: doc.requesterName,
        body: `[결재 반려]\n${body.messageToDrafter.trim()}`,
        attachment_names: [],
        thread_key: threadKeyForUsers(session.userId, doc.requesterId),
      });
    }
  } else if (body.action === "revert") {
    const myStep = doc.approvalLine.find((s) => String(s.staffId) === session.userId);
    if (!myStep || myStep.status === "대기") {
      return NextResponse.json({ error: "취소할 결재가 없습니다." }, { status: 400 });
    }
    nextLine = applyRevertStep(doc.approvalLine, session.userId);
    actionLog = "revert";
  } else if (body.action === "comment") {
    if (!body.messageToDrafter?.trim()) {
      return NextResponse.json({ error: "메시지 내용이 필요합니다." }, { status: 400 });
    }
    await db.from("internal_messages").insert({
      sender_id: session.userId,
      sender_name: session.name,
      recipient_id: doc.requesterId,
      recipient_name: doc.requesterName,
      body: `[결재 보완 요청]\n${body.messageToDrafter.trim()}`,
      attachment_names: [],
      thread_key: threadKeyForUsers(session.userId, doc.requesterId),
    });
    await db.from("approval_actions").insert({
      approval_id: id,
      actor_id: session.userId,
      actor_name: session.name,
      action: "comment",
      comment: body.messageToDrafter.trim(),
    });
    return NextResponse.json({ ok: true });
  }

  const nextStatus = computeApprovalStatus(nextLine);
  const completedAt =
    nextStatus === "결재완료" || nextStatus === "반려" ? now : null;

  const { data: updated, error: updErr } = await db
    .from("approvals")
    .update({
      approval_line: nextLine,
      status: nextStatus,
      completed_at: completedAt,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  await db.from("approval_actions").insert({
    approval_id: id,
    actor_id: session.userId,
    actor_name: session.name,
    action: actionLog,
    comment: body.comment ?? null,
  });

  const managementNumber = await resolveManagementNumber(session, db);
  const hVId = managementNumber ? await resolveHVIdForSession(db, session, managementNumber) : null;

  if (managementNumber && hVId) {
    const { data: lastAction } = await db
      .from("approval_actions")
      .select("id")
      .eq("approval_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastAction?.id) {
      await recordApprovalLedgerEvent(db, {
        tenantId: managementNumber,
        hVId,
        approvalId: id,
        actionId: String(lastAction.id),
        action: actionLog,
        actorUserId: session.userId,
        actorLoginId: session.loginId,
        comment: body.comment ?? null,
        docTitle: doc.title,
      });
    }
  }

  const saved = approvalDocFromRow(updated as Record<string, unknown>);

  if (nextStatus === "결재완료") {
    if (managementNumber) {
      try {
        await onApprovalFinanceComplete(db, id, managementNumber);
      } catch (e) {
        console.error("approval finance sync:", e);
      }
      await finalizeApprovalAgreement(db, id, {
        status: nextStatus,
        approvalLine: saved.approvalLine,
        completedAt: now,
      });
    }
    await createNotification(db, {
      userId: saved.requesterId,
      type: "approval_request",
      title: "결재 완료",
      message: `"${saved.title}" 문서가 결재 완료되었습니다.`,
      link: `/approval?doc=${saved.id}`,
      approvalId: saved.id,
    });
  } else if (nextStatus === "반려") {
    await createNotification(db, {
      userId: saved.requesterId,
      type: "approval_request",
      title: "결재 반려",
      message: `"${saved.title}" 문서가 반려되었습니다.`,
      link: `/approval?doc=${saved.id}`,
      approvalId: saved.id,
    });
  } else {
    const active = getActiveApprovalSteps(saved.approvalLine);
    for (const step of active) {
      await createNotification(db, {
        userId: step.staffId,
        type: "approval_request",
        title: "결재 요청",
        message: `"${saved.title}" — ${step.order}차 결재 차례입니다.`,
        link: `/approval?doc=${saved.id}`,
        approvalId: saved.id,
      });
    }
  }

  return NextResponse.json({ data: saved });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const { id } = await params;
  let body: Partial<import("@/lib/types").ApprovalDoc> & {
    attachmentData?: { name: string; data: string }[];
    financeEntryId?: string;
    keepExistingAttachments?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { data: existing, error: loadErr } = await db
    .from("approvals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  }

  const prev = approvalDocFromRow(existing as Record<string, unknown>);
  if (!canUserEditApprovalDoc(prev, session.userId)) {
    return NextResponse.json(
      { error: "결재완료 문서는 수정할 수 없습니다. 결재요청·반려 상태에서 기안자만 수정 가능합니다." },
      { status: 403 }
    );
  }

  const approvalLine = (body.approvalLine ?? prev.approvalLine) as ApprovalStep[];
  if (!approvalLine.length) {
    return NextResponse.json({ error: "결재선이 필요합니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const doc = {
    ...prev,
    title: body.title?.trim() || prev.title,
    type: body.type ?? prev.type,
    status: "결재요청" as const,
    caseId: body.caseId !== undefined ? body.caseId : prev.caseId,
    caseNumber: body.caseNumber !== undefined ? body.caseNumber : prev.caseNumber,
    approvalLine: approvalLine.map((s) => ({
      ...s,
      status: "대기" as const,
      signedAt: undefined,
      comment: undefined,
    })),
    notes: body.notes !== undefined ? body.notes : prev.notes,
    metadata: body.metadata !== undefined ? body.metadata : prev.metadata,
    attachmentNames: body.attachmentNames !== undefined ? body.attachmentNames : prev.attachmentNames,
    referrerNames: body.referrerNames !== undefined ? body.referrerNames : prev.referrerNames,
    referrerIds: body.referrerIds !== undefined ? body.referrerIds : prev.referrerIds,
    amount: body.amount !== undefined ? body.amount : prev.amount,
  };

  const prevRow = existing as Record<string, unknown>;
  const prevAttachments = Array.isArray(prevRow.attachment_data)
    ? (prevRow.attachment_data as { name: string; data: string }[])
    : [];

  let attachmentData = prevAttachments;
  if (body.attachmentData?.length) {
    attachmentData = body.attachmentData;
  } else if (body.keepExistingAttachments === false) {
    attachmentData = [];
  }

  const row = {
    ...approvalRowFromDoc(doc, session.loginId),
    finance_entry_id:
      body.financeEntryId !== undefined
        ? body.financeEntryId?.trim() || null
        : (prevRow.finance_entry_id as string | null) ?? null,
    attachment_data: attachmentData.length ? attachmentData : null,
    attachment_names: doc.attachmentNames ?? [],
    updated_at: now,
  };

  const { data: updated, error: updErr } = await db
    .from("approvals")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  await db.from("approval_actions").insert({
    approval_id: id,
    actor_id: session.userId,
    actor_name: session.name,
    action: "update",
    comment: "결재 요청 전 내용 수정",
  });

  const saved = approvalDocFromRow(updated as Record<string, unknown>);

  return NextResponse.json({ data: saved });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const { id } = await params;
  const { data: existing, error: loadErr } = await db
    .from("approvals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  }

  const doc = approvalDocFromRow(existing as Record<string, unknown>);
  const permCtx = { isCompanyAdmin: isCompanyAdmin(session) };
  if (!canUserDeleteApprovalDoc(doc, session.userId, permCtx)) {
    return NextResponse.json(
      {
        error:
          doc.status === "결재완료"
            ? "결재완료 문서는 사내관리자·기안자·최종결재자만 삭제할 수 있습니다."
            : "삭제 권한이 없습니다.",
      },
      { status: 403 }
    );
  }

  const row = existing as Record<string, unknown>;
  const attachmentNames = Array.isArray(row.attachment_names)
    ? (row.attachment_names as string[])
    : undefined;
  const adminDeletingCompleted = doc.status === "결재완료" && permCtx.isCompanyAdmin;

  const now = new Date().toISOString();
  const deletedAt = row.deleted_at as string | null | undefined;

  if (!deletedAt) {
    const { data: updated, error: updErr } = await db
      .from("approvals")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .select("*")
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    await db.from("approval_actions").insert({
      approval_id: id,
      actor_id: session.userId,
      actor_name: session.name,
      action: "soft_delete",
      comment: "삭제 대기 (한 번 더 삭제 시 영구 삭제)",
    });

    if (adminDeletingCompleted) {
      await logApprovalAdminDelete({
        session,
        doc,
        action: "soft_delete",
        attachmentNames,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "soft",
      data: approvalDocFromRow(updated as Record<string, unknown>),
    });
  }

  if (adminDeletingCompleted) {
    await logApprovalAdminDelete({
      session,
      doc,
      action: "permanent_delete",
      attachmentNames,
    });
  }

  const { error: delErr } = await db.from("approvals").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, mode: "permanent", id });
}
