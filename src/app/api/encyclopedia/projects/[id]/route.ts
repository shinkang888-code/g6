/**
 * 백과 프로젝트 상세 API
 * GET — 상세+통계 | POST action: sync_drive
 */

import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { resolveManagementNumber } from "@/lib/tenantScope";
import {
  buildProjectDisplay,
  getProject,
  getProjectStats,
  listArtifacts,
  syncProjectDrive,
} from "@/lib/legalEncyclopedia/encyclopediaProjectDb";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const mn = await resolveManagementNumber(auth.session, db);
  if (!mn) return NextResponse.json({ error: "관리번호 없음" }, { status: 403 });

  const { id } = await params;
  const project = await getProject(db, id, mn);
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

  const [stats, artifacts] = await Promise.all([
    getProjectStats(db, id),
    listArtifacts(db, id, 20),
  ]);

  return NextResponse.json({
    project: { ...project, display: buildProjectDisplay(project.client_name, project.case_title) },
    stats,
    artifacts,
  });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const mn = await resolveManagementNumber(auth.session, db);
  if (!mn) return NextResponse.json({ error: "관리번호 없음" }, { status: 403 });

  const { id } = await params;
  let project = await getProject(db, id, mn);
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty ok */
  }

  if (body.action === "sync_drive") {
    project = await syncProjectDrive(db, project);
    return NextResponse.json({
      project: { ...project, display: buildProjectDisplay(project.client_name, project.case_title) },
    });
  }

  return NextResponse.json({ error: "지원하지 않는 action" }, { status: 400 });
}
