/**
 * 로이고법률백과 Supabase 저장소
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncyclopediaCategory, FeatureValue, LegalDomain } from "./types";
import type { IngestVectorRow } from "./ingest";
import { nextWeight } from "./featureLearning";
import { ONTOLOGY_SEED } from "./ontologySeed";
import { expandOntology as expandStaticOntology } from "./ontology";

export type DbOntologyRow = {
  keyword: string;
  synonyms: string[];
  domain: LegalDomain;
  related_laws: string[];
};

export type DbVectorRow = {
  id: string;
  title: string;
  body: string;
  category: string;
  domain: string;
  vector_dims: number[];
  magnitude: number;
  feature_labels: string[];
  source_type: string;
};

export async function isEncyclopediaDbReady(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from("legal_vectors").select("id").limit(1);
  return !error;
}

export async function loadOntologyFromDb(
  db: SupabaseClient,
  keyword: string,
  managementNumber: string
): Promise<DbOntologyRow | null> {
  const norm = keyword.trim().replace(/\s+/g, "");

  const { data: tenant } = await db
    .from("legal_ontology_entries")
    .select("keyword, synonyms, domain, related_laws")
    .eq("management_number", managementNumber)
    .ilike("keyword", norm)
    .limit(1)
    .maybeSingle();

  if (tenant) {
    return {
      keyword: tenant.keyword,
      synonyms: (tenant.synonyms as string[]) ?? [],
      domain: tenant.domain as LegalDomain,
      related_laws: (tenant.related_laws as string[]) ?? [],
    };
  }

  const { data: global } = await db
    .from("legal_ontology_entries")
    .select("keyword, synonyms, domain, related_laws")
    .is("management_number", null)
    .ilike("keyword", norm)
    .limit(1)
    .maybeSingle();

  if (global) {
    return {
      keyword: global.keyword,
      synonyms: (global.synonyms as string[]) ?? [],
      domain: global.domain as LegalDomain,
      related_laws: (global.related_laws as string[]) ?? [],
    };
  }

  // 유사 키워드 검색
  const { data: fuzzy } = await db
    .from("legal_ontology_entries")
    .select("keyword, synonyms, domain, related_laws")
    .or(`management_number.is.null,management_number.eq.${managementNumber}`)
    .limit(50);

  const hit = (fuzzy ?? []).find((row) => {
    const kw = String(row.keyword);
    const syns = (row.synonyms as string[]) ?? [];
    return kw.includes(norm) || norm.includes(kw) || syns.some((s) => norm.includes(s) || s.includes(norm));
  });

  if (hit) {
    return {
      keyword: hit.keyword,
      synonyms: (hit.synonyms as string[]) ?? [],
      domain: hit.domain as LegalDomain,
      related_laws: (hit.related_laws as string[]) ?? [],
    };
  }

  return null;
}

export async function expandOntologyWithDb(
  db: SupabaseClient,
  keyword: string,
  managementNumber: string
) {
  const dbRow = await loadOntologyFromDb(db, keyword, managementNumber);
  if (dbRow) {
    const norm = keyword.trim().replace(/\s+/g, "");
    return {
      root: dbRow.keyword,
      synonyms: [...new Set([norm, dbRow.keyword, ...dbRow.synonyms])],
      domain: dbRow.domain,
      domainReason: `DB 온톨로지: 「${dbRow.keyword}」→ ${dbRow.domain} 분야`,
      relatedLaws: dbRow.related_laws,
      fromDb: true,
    };
  }
  const staticResult = expandStaticOntology(keyword);
  return { ...staticResult, fromDb: false };
}

export async function searchStoredVectors(
  db: SupabaseClient,
  managementNumber: string,
  keyword: string,
  synonyms: string[],
  domain: LegalDomain,
  limit = 12,
  projectId?: string | null
): Promise<DbVectorRow[]> {
  const needles = [keyword, ...synonyms].filter(Boolean);
  const orParts = needles.flatMap((n) => [
    `title.ilike.%${n}%`,
    `body.ilike.%${n}%`,
  ]);

  let query = db
    .from("legal_vectors")
    .select("id, title, body, category, domain, vector_dims, magnitude, feature_labels, source_type")
    .eq("management_number", managementNumber)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) {
    query = query.or(`project_id.eq.${projectId},project_id.is.null`);
  }

  if (orParts.length > 0) {
    query = query.or(orParts.join(","));
  }
  if (domain !== "전체") {
    query = query.in("domain", [domain, "전체"]);
  }

  const { data, error } = await query;
  if (error) {
    console.error("searchStoredVectors:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    category: r.category as string,
    domain: r.domain as string,
    vector_dims: (r.vector_dims as number[]) ?? [],
    magnitude: Number(r.magnitude ?? 0),
    feature_labels: (r.feature_labels as string[]) ?? [],
    source_type: r.source_type as string,
  }));
}

export async function loadFeatureWeights(
  db: SupabaseClient,
  managementNumber: string,
  keyword: string,
  projectId?: string | null
): Promise<Map<string, number>> {
  let query = db
    .from("legal_feature_weights")
    .select("feature_label, weight")
    .eq("management_number", managementNumber)
    .eq("keyword", keyword);

  if (projectId) {
    query = query.eq("project_id", projectId);
  } else {
    query = query.is("project_id", null);
  }

  const { data } = await query;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.feature_label as string, Number(row.weight));
  }
  return map;
}

export async function recordUsage(
  db: SupabaseClient,
  row: {
    management_number: string;
    login_id: string;
    action: string;
    keyword?: string;
    vector_id?: string;
    document_id?: string;
    section_id?: string;
    section_title?: string;
    feature_snapshot?: FeatureValue[];
    ranking_score?: number;
    metadata?: Record<string, unknown>;
    project_id?: string | null;
  }
): Promise<void> {
  const { error } = await db.from("legal_usage_records").insert({
    ...row,
    feature_snapshot: row.feature_snapshot ?? null,
    metadata: row.metadata ?? null,
  });
  if (error) console.error("recordUsage:", error.message);
}

export async function upsertFeatureWeightsFromSelection(
  db: SupabaseClient,
  managementNumber: string,
  keyword: string,
  features: FeatureValue[],
  projectId?: string | null
): Promise<void> {
  for (const f of features) {
    let q = db
      .from("legal_feature_weights")
      .select("id, weight, selection_count")
      .eq("management_number", managementNumber)
      .eq("keyword", keyword)
      .eq("feature_label", f.label);

    if (projectId) q = q.eq("project_id", projectId);
    else q = q.is("project_id", null);

    const { data: existing } = await q.maybeSingle();

    const count = (existing?.selection_count as number | undefined) ?? 0;
    const newCount = count + 1;
    const newWeight = nextWeight(Number(existing?.weight ?? 1), newCount);

    if (existing?.id) {
      await db
        .from("legal_feature_weights")
        .update({
          weight: newWeight,
          selection_count: newCount,
          last_selected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await db.from("legal_feature_weights").insert({
        management_number: managementNumber,
        keyword,
        feature_label: f.label,
        feature_kind: f.kind,
        weight: newWeight,
        selection_count: 1,
        last_selected_at: new Date().toISOString(),
        project_id: projectId ?? null,
      });
    }
  }
}

export async function ingestDocument(
  db: SupabaseClient,
  params: {
    managementNumber: string;
    loginId: string;
    title: string;
    rawText: string;
    category: EncyclopediaCategory;
    domain: LegalDomain;
    sourceFilename?: string;
    vectors: IngestVectorRow[];
    projectId?: string | null;
  }
): Promise<{ documentId: string; vectorCount: number; vectorIds: string[] }> {
  const { data: doc, error: docErr } = await db
    .from("legal_documents")
    .insert({
      management_number: params.managementNumber,
      title: params.title,
      category: params.category,
      domain: params.domain,
      source_filename: params.sourceFilename ?? null,
      raw_text: params.rawText.slice(0, 500000),
      clause_count: params.vectors.length,
      created_by: params.loginId,
      project_id: params.projectId ?? null,
    })
    .select("id")
    .single();

  if (docErr || !doc) throw new Error(docErr?.message ?? "문서 저장 실패");

  const rows = params.vectors.map((v) => ({
    management_number: params.managementNumber,
    document_id: doc.id,
    project_id: params.projectId ?? null,
    source_type: "ingest",
    title: v.title,
    body: v.body,
    category: v.category,
    domain: v.domain,
    vector_dims: v.vector_dims,
    magnitude: v.magnitude,
    feature_labels: v.feature_labels,
    clause_index: v.clause_index,
  }));

  const { data: inserted, error: vecErr } = await db.from("legal_vectors").insert(rows).select("id");
  if (vecErr) throw new Error(vecErr.message);

  const vectorIds = (inserted ?? []).map((r) => r.id as string);

  await recordUsage(db, {
    management_number: params.managementNumber,
    login_id: params.loginId,
    action: "ingest",
    keyword: params.title,
    document_id: doc.id,
    project_id: params.projectId ?? null,
    metadata: { clauseCount: params.vectors.length, domain: params.domain },
  });

  return { documentId: doc.id as string, vectorCount: rows.length, vectorIds };
}

export async function getEncyclopediaStats(
  db: SupabaseClient,
  managementNumber: string,
  projectId?: string | null
) {
  let vq = db.from("legal_vectors").select("id", { count: "exact", head: true }).eq("management_number", managementNumber);
  let dq = db.from("legal_documents").select("id", { count: "exact", head: true }).eq("management_number", managementNumber);
  let uq = db.from("legal_usage_records").select("id", { count: "exact", head: true }).eq("management_number", managementNumber);
  let wq = db
    .from("legal_feature_weights")
    .select("feature_label, weight, selection_count")
    .eq("management_number", managementNumber)
    .order("selection_count", { ascending: false })
    .limit(8);

  if (projectId) {
    vq = vq.eq("project_id", projectId);
    dq = dq.eq("project_id", projectId);
    uq = uq.eq("project_id", projectId);
    wq = wq.eq("project_id", projectId);
  }

  const [vectors, documents, usage, weights] = await Promise.all([vq, dq, uq, wq]);

  return {
    vectorCount: vectors.count ?? 0,
    documentCount: documents.count ?? 0,
    usageCount: usage.count ?? 0,
    topWeights: weights.data ?? [],
    ontologySeedCount: ONTOLOGY_SEED.length,
  };
}

export async function ensureOntologySeeded(db: SupabaseClient): Promise<void> {
  const { count } = await db
    .from("legal_ontology_entries")
    .select("id", { count: "exact", head: true })
    .is("management_number", null);

  if ((count ?? 0) > 0) return;

  const rows = ONTOLOGY_SEED.map((e) => ({
    keyword: e.keyword,
    synonyms: e.synonyms,
    domain: e.domain,
    related_laws: e.relatedLaws,
    management_number: null,
  }));

  await db.from("legal_ontology_entries").insert(rows);
}
