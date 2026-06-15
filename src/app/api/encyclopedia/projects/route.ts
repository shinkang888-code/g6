/**
 * 백과 프로젝트 API
 * GET — 목록 | POST — 생성
 */

import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { resolveManagementNumber } from "@/lib/tenantScope";
import {
  buildProjectDisplay,
  createProject,
  createProjectFromCase,
  isProjectDbReady,
  listProjects,
} from "@/lib/legalEncyclopedia/encyclopediaProjectDb";

export async function GET() {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const mn = await resolveManagementNumber(auth.session, db);
  if (!mn) return NextResponse.json({ error: "관리번호 없음" }, { status: 403 });

  if (!(await isProjectDbReady(db))) {
    return NextResponse.json({ projects: [], dbReady: false });
  }

  const projects = await listProjects(db, mn);
  return NextResponse.json({
    dbReady: true,
    projects: projects.map((p) => ({
      ...p,
      display: buildProjectDisplay(p.client_name, p.case_title),
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const mn = await resolveManagementNumber(auth.session, db);
  if (!mn) return NextResponse.json({ error: "관리번호 없음" }, { status: 403 });

  if (!(await isProjectDbReady(db))) {
    return NextResponse.json({ error: "encyclopedia_projects 마이그레이션 필요" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  try {
    if (body.caseId) {
      const project = await createProjectFromCase(db, {
        managementNumber: mn,
        caseId: String(body.caseId),
        loginId: auth.session.loginId,
      });
      return NextResponse.json({
        project: { ...project, display: buildProjectDisplay(project.client_name, project.case_title) },
      });
    }

    const clientName = String(body.clientName ?? "").trim();
    const caseTitle = String(body.caseTitle ?? "").trim();
    if (!clientName || !caseTitle) {
      return NextResponse.json({ error: "의뢰인명과 사건명을 입력하세요." }, { status: 400 });
    }

    const project = await createProject(db, {
      managementNumber: mn,
      clientName,
      caseTitle,
      loginId: auth.session.loginId,
      syncDrive: body.syncDrive !== false,
    });

    return NextResponse.json({
      project: { ...project, display: buildProjectDisplay(project.client_name, project.case_title) },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "프로젝트 생성 실패" }, { status: 500 });
  }
}
