/**
 * 사내 메신저 API (LawTop MessageSend/Receive 방식)
 * GET ?box=sent|received|thread&with=userId
 * POST { recipients[], body, attachments? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { messageFromRow, threadKeyForUsers } from "@/lib/internalMessageServer";
import { createNotification } from "@/lib/notificationServer";
import { requireTenantSession } from "@/lib/tenantScope";
import { assertSameTenantUsers } from "@/lib/tenantUser";

function matchRecipient(
  row: Record<string, unknown>,
  userId: string,
  loginId: string
): boolean {
  const rid = String(row.recipient_id ?? "");
  const rLogin = String(row.recipient_login_id ?? "").toLowerCase();
  if (userId && rid && userId === rid) return true;
  if (loginId && rLogin && loginId.toLowerCase() === rLogin) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  const box = request.nextUrl.searchParams.get("box") ?? "all";
  const withUser = request.nextUrl.searchParams.get("with") ?? "";
  const userId = session.userId;
  const loginId = session.loginId;

  let query = db
    .from("internal_messages")
    .select("*")
    .eq("management_number", managementNumber)
    .order("created_at", { ascending: false })
    .limit(500);

  if (box === "sent") {
    query = query.eq("sender_id", userId);
  } else if (box === "received") {
    query = query.or(`recipient_id.eq.${userId},recipient_login_id.eq.${loginId}`);
  } else if (box === "thread" && withUser) {
    const key = threadKeyForUsers(userId, withUser);
    query = query.eq("thread_key", key);
  } else {
    query = query.or(
      `sender_id.eq.${userId},recipient_id.eq.${userId},recipient_login_id.eq.${loginId}`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const list = (data ?? []).map((r) => messageFromRow(r as Record<string, unknown>));
  const unreadCount = (data ?? []).filter(
    (r) => matchRecipient(r as Record<string, unknown>, userId, loginId) && !r.read_at
  ).length;

  return NextResponse.json({ data: list, unreadCount });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  let body: {
    recipientId: string;
    recipientName: string;
    recipientLoginId?: string;
    body: string;
    attachmentNames?: string[];
    attachmentData?: { name: string; data: string }[];
    recipients?: Array<{
      recipientId: string;
      recipientName: string;
      recipientLoginId?: string;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const targets =
    body.recipients?.length
      ? body.recipients
      : body.recipientId
        ? [
            {
              recipientId: body.recipientId,
              recipientName: body.recipientName,
              recipientLoginId: body.recipientLoginId,
            },
          ]
        : [];

  if (!targets.length || !body.body?.trim()) {
    return NextResponse.json({ error: "수신자와 내용이 필요합니다." }, { status: 400 });
  }

  const created = [];
  for (const t of targets) {
    const sameTenant = await assertSameTenantUsers(db, session.userId, String(t.recipientId));
    if (!sameTenant) {
      return NextResponse.json(
        { error: "다른 관리번호(회사) 구성원에게는 메시지를 보낼 수 없습니다." },
        { status: 403 }
      );
    }

    const row = {
      sender_id: session.userId,
      sender_name: session.name,
      recipient_id: String(t.recipientId),
      recipient_name: t.recipientName,
      recipient_login_id: t.recipientLoginId?.toLowerCase() ?? null,
      body: body.body.trim(),
      attachment_names: body.attachmentNames ?? [],
      attachment_data: body.attachmentData ?? null,
      thread_key: threadKeyForUsers(session.userId, String(t.recipientId)),
      management_number: managementNumber,
    };

    const { data, error } = await db.from("internal_messages").insert(row).select("*").single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const msg = messageFromRow(data as Record<string, unknown>);
    created.push(msg);

    await createNotification(db, {
      userId: t.recipientId,
      recipientLoginId: t.recipientLoginId,
      type: "memo",
      title: "사내 메시지",
      message: `${session.name}님: ${body.body.trim().slice(0, 80)}`,
      link: `/internal-messenger/chat?with=${encodeURIComponent(session.userId)}&name=${encodeURIComponent(session.name)}`,
      managementNumber,
    });
  }

  return NextResponse.json({ data: created, count: created.length });
}
