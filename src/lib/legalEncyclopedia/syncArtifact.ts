/**
 * 기능 산출물 → ingest + artifact + Drive + timeline
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncyclopediaProjectRow } from "./encyclopediaProjectDb";
import { saveArtifact } from "./encyclopediaProjectDb";
import { ingestDocument } from "./legalEncyclopediaDb";
import { uploadProjectArtifact } from "./driveProjectFolders";
import { artifactToVectors, type FeatureArtifactPayload } from "./adapters/featureAdapters";

export type SyncArtifactResult = {
  artifactId: string;
  documentId: string;
  vectorCount: number;
  vectorIds: string[];
  driveFileId: string | null;
  drivePath: string | null;
};

export async function syncFeatureToProject(
  db: SupabaseClient,
  params: {
    project: EncyclopediaProjectRow;
    managementNumber: string;
    loginId: string;
    artifact: FeatureArtifactPayload;
    saveToDrive?: boolean;
  }
): Promise<SyncArtifactResult> {
  const vectors = artifactToVectors(params.artifact);

  const ingest = await ingestDocument(db, {
    managementNumber: params.managementNumber,
    loginId: params.loginId,
    title: params.artifact.title,
    rawText: params.artifact.contentText,
    category: params.artifact.category,
    domain: params.artifact.domain,
    vectors,
    projectId: params.project.id,
  });

  let driveFileId: string | null = null;
  let drivePath: string | null = null;

  if (params.saveToDrive !== false) {
    const ext = params.artifact.sourceFeature === "case_search" ? "json" : "txt";
    const fileName = `${params.artifact.sourceFeature}_${Date.now()}.${ext}`;
    const content =
      ext === "json"
        ? JSON.stringify(
            {
              title: params.artifact.title,
              sourceFeature: params.artifact.sourceFeature,
              structured: params.artifact.structured,
              contentText: params.artifact.contentText.slice(0, 50000),
            },
            null,
            2
          )
        : params.artifact.contentText.slice(0, 500000);

    const uploaded = await uploadProjectArtifact({
      managementNumber: params.project.management_number,
      clientName: params.project.client_name,
      caseTitle: params.project.case_title,
      sourceFeature: params.artifact.sourceFeature,
      fileName,
      content,
      mimeType: ext === "json" ? "application/json" : "text/plain; charset=utf-8",
    });
    driveFileId = uploaded.fileId;
    drivePath = uploaded.path;
  }

  const saved = await saveArtifact(db, {
    project_id: params.project.id,
    source_feature: params.artifact.sourceFeature,
    title: params.artifact.title,
    content_text: params.artifact.contentText.slice(0, 100000),
    structured_json: params.artifact.structured ?? null,
    drive_file_id: driveFileId,
    drive_file_path: drivePath,
    legal_document_id: ingest.documentId,
    legal_vector_ids: ingest.vectorIds,
  });

  if (params.project.case_id) {
    await db.from("timeline").insert({
      case_id: params.project.case_id,
      type: "encyclopedia",
      title: "로이고법률백과",
      content: `${params.artifact.title} — ${params.artifact.sourceFeature} 백과 저장 (${ingest.vectorCount}벡터)`,
      author_name: params.loginId,
      metadata: {
        projectId: params.project.id,
        artifactId: saved.id,
        sourceFeature: params.artifact.sourceFeature,
        vectorCount: ingest.vectorCount,
      },
    });
  }

  return {
    artifactId: saved.id,
    documentId: ingest.documentId,
    vectorCount: ingest.vectorCount,
    vectorIds: ingest.vectorIds,
    driveFileId,
    drivePath,
  };
}
