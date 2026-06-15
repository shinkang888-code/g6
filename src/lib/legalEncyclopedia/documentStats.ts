/**
 * 법률백과 문서 조회수 — document_key 생성·집계
 */

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncyclopediaCategory, RankedLegalDocument } from "./types";

export function buildDocumentKey(doc: Pick<RankedLegalDocument, "vectorId" | "title" | "category" | "source">): string {
  if (doc.vectorId && !doc.vectorId.startsWith("doc-vec-") && !doc.vectorId.startsWith("doc-")) {
    return doc.vectorId;
  }
  const raw = `${doc.category}|${doc.title}|${doc.source ?? ""}`.trim();
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export async function fetchViewCounts(
  db: SupabaseClient,
  managementNumber: string,
  keys: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (keys.length === 0) return map;

  const unique = [...new Set(keys)];
  const { data, error } = await db
    .from("legal_document_stats")
    .select("document_key, view_count")
    .eq("management_number", managementNumber)
    .in("document_key", unique);

  if (error) {
    console.error("[document_stats] fetch", error.message);
    return map;
  }

  for (const row of data ?? []) {
    map.set(String(row.document_key), Number(row.view_count ?? 0));
  }
  return map;
}

export async function incrementDocumentView(
  db: SupabaseClient,
  params: {
    managementNumber: string;
    documentKey: string;
    title: string;
    category: EncyclopediaCategory | string;
    vectorId?: string | null;
  }
): Promise<number> {
  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("legal_document_stats")
    .select("id, view_count")
    .eq("management_number", params.managementNumber)
    .eq("document_key", params.documentKey)
    .maybeSingle();

  if (existing?.id) {
    const next = Number(existing.view_count ?? 0) + 1;
    await db
      .from("legal_document_stats")
      .update({ view_count: next, last_viewed_at: now, updated_at: now, title: params.title })
      .eq("id", existing.id);
    return next;
  }

  const { data: inserted } = await db
    .from("legal_document_stats")
    .insert({
      management_number: params.managementNumber,
      document_key: params.documentKey,
      title: params.title.slice(0, 500),
      category: params.category,
      vector_id: params.vectorId ?? null,
      view_count: 1,
      last_viewed_at: now,
    })
    .select("view_count")
    .single();

  return Number(inserted?.view_count ?? 1);
}

export function sortDocumentsByViews(docs: RankedLegalDocument[]): RankedLegalDocument[] {
  return [...docs].sort((a, b) => {
    const va = a.viewCount ?? 0;
    const vb = b.viewCount ?? 0;
    if (vb !== va) return vb - va;
    return b.rankingScore - a.rankingScore;
  });
}

export function attachViewCounts(
  docs: RankedLegalDocument[],
  counts: Map<string, number>
): RankedLegalDocument[] {
  return docs.map((d) => {
    const key = buildDocumentKey(d);
    return { ...d, documentKey: key, viewCount: counts.get(key) ?? 0 };
  });
}
