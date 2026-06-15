/**
 * encyclopedia_projects · artifacts CRUD
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProjectDisplay, buildProjectKey } from "./projectKey";
import { ensureProjectDriveFolders } from "./driveProjectFolders";

export type EncyclopediaProjectRow = {
  id: string;
  management_number: string;
  case_id: string | null;
  client_name: string;
  case_title: string;
  project_key: string;
  drive_folder_id: string | null;
  drive_folder_path: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
};

export type EncyclopediaArtifactRow = {
  id: string;
  project_id: string;
  source_feature: string;
  title: string;
  content_text: string | null;
  structured_json: unknown;
  drive_file_id: string | null;
  drive_file_path: string | null;
  legal_document_id: string | null;
  legal_vector_ids: string[];
  created_at: string;
};

export async function isProjectDbReady(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from("encyclopedia_projects").select("id").limit(1);
  return !error;
}

export function rowToProject(r: Record<string, unknown>): EncyclopediaProjectRow {
  return {
    id: r.id as string,
    management_number: r.management_number as string,
    case_id: (r.case_id as string | null) ?? null,
    client_name: r.client_name as string,
    case_title: r.case_title as string,
    project_key: r.project_key as string,
    drive_folder_id: (r.drive_folder_id as string | null) ?? null,
    drive_folder_path: (r.drive_folder_path as string | null) ?? null,
    status: r.status as string,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

export async function listProjects(
  db: SupabaseClient,
  managementNumber: string,
  limit = 50
): Promise<EncyclopediaProjectRow[]> {
  const { data, error } = await db
    .from("encyclopedia_projects")
    .select("*")
    .eq("management_number", managementNumber)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listProjects:", error.message);
    return [];
  }
  return (data ?? []).map(rowToProject);
}

export async function getProject(
  db: SupabaseClient,
  projectId: string,
  managementNumber: string
): Promise<EncyclopediaProjectRow | null> {
  const { data } = await db
    .from("encyclopedia_projects")
    .select("*")
    .eq("id", projectId)
    .eq("management_number", managementNumber)
    .maybeSingle();

  return data ? rowToProject(data) : null;
}

export async function findProjectByCaseId(
  db: SupabaseClient,
  caseId: string,
  managementNumber: string
): Promise<EncyclopediaProjectRow | null> {
  const { data } = await db
    .from("encyclopedia_projects")
    .select("*")
    .eq("case_id", caseId)
    .eq("management_number", managementNumber)
    .eq("status", "active")
    .maybeSingle();

  return data ? rowToProject(data) : null;
}

export async function createProject(
  db: SupabaseClient,
  params: {
    managementNumber: string;
    clientName: string;
    caseTitle: string;
    caseId?: string | null;
    loginId: string;
    syncDrive?: boolean;
  }
): Promise<EncyclopediaProjectRow> {
  const projectKey = buildProjectKey(params.clientName, params.caseTitle);

  const { data: existing } = await db
    .from("encyclopedia_projects")
    .select("*")
    .eq("management_number", params.managementNumber)
    .eq("project_key", projectKey)
    .maybeSingle();

  if (existing) {
    if (params.syncDrive !== false && !existing.drive_folder_id) {
      await syncProjectDrive(db, rowToProject(existing));
    }
    return rowToProject(existing);
  }

  let drive_folder_id: string | null = null;
  let drive_folder_path: string | null = null;

  if (params.syncDrive !== false) {
    const drive = await ensureProjectDriveFolders({
      managementNumber: params.managementNumber,
      clientName: params.clientName,
      caseTitle: params.caseTitle,
      caseId: params.caseId,
    });
    drive_folder_path = drive.rootPath;
    drive_folder_id = drive.rootFolderId;
  }

  const { data, error } = await db
    .from("encyclopedia_projects")
    .insert({
      management_number: params.managementNumber,
      case_id: params.caseId ?? null,
      client_name: params.clientName.trim(),
      case_title: params.caseTitle.trim(),
      project_key: projectKey,
      drive_folder_id,
      drive_folder_path,
      created_by: params.loginId,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "프로젝트 생성 실패");
  return rowToProject(data);
}

export async function createProjectFromCase(
  db: SupabaseClient,
  params: { managementNumber: string; caseId: string; loginId: string }
): Promise<EncyclopediaProjectRow> {
  const { data: caseRow, error } = await db
    .from("cases")
    .select("id, client_name, case_name, management_number")
    .eq("id", params.caseId)
    .eq("management_number", params.managementNumber)
    .maybeSingle();

  if (error || !caseRow) throw new Error("사건을 찾을 수 없습니다.");

  const existing = await findProjectByCaseId(db, params.caseId, params.managementNumber);
  if (existing) {
    await syncProjectDrive(db, existing);
    return existing;
  }

  return createProject(db, {
    managementNumber: params.managementNumber,
    clientName: String(caseRow.client_name ?? "의뢰인"),
    caseTitle: String(caseRow.case_name ?? caseRow.id),
    caseId: params.caseId,
    loginId: params.loginId,
    syncDrive: true,
  });
}

export async function syncProjectDrive(
  db: SupabaseClient,
  project: EncyclopediaProjectRow
): Promise<EncyclopediaProjectRow> {
  const drive = await ensureProjectDriveFolders({
    managementNumber: project.management_number,
    clientName: project.client_name,
    caseTitle: project.case_title,
    caseId: project.case_id,
  });

  const { data } = await db
    .from("encyclopedia_projects")
    .update({
      drive_folder_id: drive.rootFolderId,
      drive_folder_path: drive.rootPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id)
    .select("*")
    .single();

  return data ? rowToProject(data) : project;
}

export async function saveArtifact(
  db: SupabaseClient,
  row: {
    project_id: string;
    source_feature: string;
    title: string;
    content_text?: string;
    structured_json?: unknown;
    drive_file_id?: string | null;
    drive_file_path?: string | null;
    legal_document_id?: string | null;
    legal_vector_ids?: string[];
  }
): Promise<EncyclopediaArtifactRow> {
  const { data, error } = await db
    .from("encyclopedia_artifacts")
    .insert({
      ...row,
      legal_vector_ids: row.legal_vector_ids ?? [],
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "artifact 저장 실패");

  await db
    .from("encyclopedia_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", row.project_id);

  return {
    id: data.id as string,
    project_id: data.project_id as string,
    source_feature: data.source_feature as string,
    title: data.title as string,
    content_text: (data.content_text as string | null) ?? null,
    structured_json: data.structured_json,
    drive_file_id: (data.drive_file_id as string | null) ?? null,
    drive_file_path: (data.drive_file_path as string | null) ?? null,
    legal_document_id: (data.legal_document_id as string | null) ?? null,
    legal_vector_ids: (data.legal_vector_ids as string[]) ?? [],
    created_at: data.created_at as string,
  };
}

export async function listArtifacts(
  db: SupabaseClient,
  projectId: string,
  limit = 30
): Promise<EncyclopediaArtifactRow[]> {
  const { data } = await db
    .from("encyclopedia_artifacts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((d) => ({
    id: d.id as string,
    project_id: d.project_id as string,
    source_feature: d.source_feature as string,
    title: d.title as string,
    content_text: (d.content_text as string | null) ?? null,
    structured_json: d.structured_json,
    drive_file_id: (d.drive_file_id as string | null) ?? null,
    drive_file_path: (d.drive_file_path as string | null) ?? null,
    legal_document_id: (d.legal_document_id as string | null) ?? null,
    legal_vector_ids: (d.legal_vector_ids as string[]) ?? [],
    created_at: d.created_at as string,
  }));
}

export async function getProjectStats(db: SupabaseClient, projectId: string) {
  const [artifacts, vectors, docs] = await Promise.all([
    db.from("encyclopedia_artifacts").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    db.from("legal_vectors").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    db.from("legal_documents").select("id", { count: "exact", head: true }).eq("project_id", projectId),
  ]);

  return {
    artifactCount: artifacts.count ?? 0,
    vectorCount: vectors.count ?? 0,
    documentCount: docs.count ?? 0,
  };
}

export { buildProjectDisplay };
