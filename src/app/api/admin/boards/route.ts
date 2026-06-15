/**
 * 관리자 네이티브 게시판 CRUD
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { getTenantManagementNumber } from "@/lib/boardApiContext";
import {
  createBoard,
  isNativeBoardReady,
  listAllBoardsAdmin,
  softDeleteBoard,
  updateBoard,
} from "@/lib/boardService";

export async function GET() {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 연결 실패" }, { status: 503 });
  if (!(await isNativeBoardReady(db))) {
    return NextResponse.json({ error: "native_boards 마이그레이션 필요" }, { status: 503 });
  }

  const mgmt = getTenantManagementNumber(auth.session);
  const boards = await listAllBoardsAdmin(mgmt);
  return NextResponse.json({
    data: boards,
    nativeBoard: true,
    managementNumber: mgmt,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  if (!(await isNativeBoardReady())) {
    return NextResponse.json({ error: "native_boards 마이그레이션 필요" }, { status: 503 });
  }

  let body: { slug?: string; name?: string; description?: string; boardKind?: "post" | "data" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "게시판 이름을 입력하세요." }, { status: 400 });
  }

  const slug =
    body.slug?.trim() ||
    body.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9가-힣_-]/g, "")
      .slice(0, 40) ||
    `board_${Date.now()}`;

  try {
    const created = await createBoard({
      slug,
      name: body.name,
      description: body.description,
      boardKind: body.boardKind,
      managementNumber: getTenantManagementNumber(auth.session),
    });
    return NextResponse.json({ data: created, message: "게시판이 생성되었습니다." });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "생성 실패" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  let body: { name?: string; description?: string; boardKind?: "post" | "data"; sortOrder?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  try {
    const updated = await updateBoard(id, body);
    if (!updated) return NextResponse.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ data: updated, message: "저장되었습니다." });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 실패" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const ok = await softDeleteBoard(id);
  if (!ok) return NextResponse.json({ error: "삭제할 수 없습니다. (시스템 게시판)" }, { status: 400 });
  return NextResponse.json({ ok: true, message: "게시판이 삭제되었습니다." });
}
