/**
 * 사건 자료실 API — 폴더·파일 메타 (Drive 연동)
 * GET ?caseId=
 * POST — 파일 메타 저장 (업로드는 /api/drive/upload 후 호출)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import { caseFileFromRow, caseFolderFromRow } from "@/lib/caseFilesServer";

function getDb() {
  return getSupabaseAdmin();
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const caseId = request.nextUrl.searchParams.get("caseId")?.trim();
  if (!caseId) {
    return NextResponse.json({ error: "caseId가 필요합니다." }, { status: 400 });
  }

  const [foldersRes, filesRes] = await Promise.all([
    db.from("case_folders").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
    db
      .from("case_files")
      .select(
        "id, case_id, file_name, file_size, mime_type, folder_id, drive_file_id, web_view_link, storage_mode, local_data, created_at"
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
  ]);

  if (foldersRes.error || filesRes.error) {
    return NextResponse.json(
      { error: foldersRes.error?.message || filesRes.error?.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    folders: (foldersRes.data ?? []).map((r) => caseFolderFromRow(r as Record<string, unknown>)),
    files: (filesRes.data ?? []).map((r) => caseFileFromRow(r as Record<string, unknown>)),
  });
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

  let body: {
    caseId: string;
    type: "file" | "folder";
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    folderId?: string | null;
    driveFileId?: string;
    webViewLink?: string;
    storageMode?: "drive" | "local";
    localData?: string;
    name?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const caseId = body.caseId?.trim();
  if (!caseId) {
    return NextResponse.json({ error: "caseId가 필요합니다." }, { status: 400 });
  }

  if (body.type === "folder") {
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "폴더명이 필요합니다." }, { status: 400 });
    }
    const { data, error } = await db
      .from("case_folders")
      .insert({ case_id: caseId, name })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: caseFolderFromRow(data as Record<string, unknown>) });
  }

  const fileName = body.fileName?.trim();
  if (!fileName) {
    return NextResponse.json({ error: "fileName이 필요합니다." }, { status: 400 });
  }

  const storageMode = body.storageMode ?? (body.driveFileId ? "drive" : "local");
  const row = {
    case_id: caseId,
    file_name: fileName,
    file_size: body.fileSize ?? null,
    mime_type: body.mimeType ?? "application/octet-stream",
    folder_id: body.folderId || null,
    drive_file_id: body.driveFileId ?? null,
    web_view_link: body.webViewLink ?? null,
    storage_mode: storageMode,
    local_data: storageMode === "local" ? body.localData ?? null : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db.from("case_files").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data: caseFileFromRow(data as Record<string, unknown>) });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  let body: {
    id: string;
    type: "file" | "folder";
    fileName?: string;
    name?: string;
    folderId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  if (body.type === "folder") {
    const { data, error } = await db
      .from("case_folders")
      .update({ name: body.name?.trim() })
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: caseFolderFromRow(data as Record<string, unknown>) });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.fileName) patch.file_name = body.fileName.trim();
  if (body.folderId !== undefined) patch.folder_id = body.folderId;

  const { data, error } = await db
    .from("case_files")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: caseFileFromRow(data as Record<string, unknown>) });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const id = request.nextUrl.searchParams.get("id");
  const type = request.nextUrl.searchParams.get("type") ?? "file";
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  if (type === "folder") {
    await db.from("case_files").update({ folder_id: null }).eq("folder_id", id);
    const { error } = await db.from("case_folders").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await db.from("case_files").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
