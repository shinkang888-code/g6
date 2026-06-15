/**
 * 로이고법률백과 API
 * POST actions: search | model_answer | ingest | record_selection
 * GET: 메타·통계
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { resolveManagementNumber } from "@/lib/tenantScope";
import { buildVectorsFromFeatures, formFeatureValues, textToSemanticVector } from "@/lib/legalEncyclopedia/semanticVector";
import {
  buildDictionarySections,
  mergeRawDocuments,
  rankDocuments,
  storedVectorsToRaw,
  type RawAiDocument,
} from "@/lib/legalEncyclopedia/ranking";
import {
  buildModelAnswerPrompt,
  buildSearchPrompt,
  parseAiDocumentsJson,
  parseModelAnswerSections,
} from "@/lib/legalEncyclopedia/prompts";
import { buildModelAnswerPipeline, buildPipelineSteps } from "@/lib/legalEncyclopedia/pipeline";
import { applyLearnedWeights, detectRepetitiveResolution } from "@/lib/legalEncyclopedia/featureLearning";
import { clausesToVectors, extractLegalClauses } from "@/lib/legalEncyclopedia/ingest";
import {
  ensureOntologySeeded,
  expandOntologyWithDb,
  getEncyclopediaStats,
  ingestDocument,
  isEncyclopediaDbReady,
  loadFeatureWeights,
  recordUsage,
  searchStoredVectors,
  upsertFeatureWeightsFromSelection,
} from "@/lib/legalEncyclopedia/legalEncyclopediaDb";
import type {
  EncyclopediaCategory,
  FeatureValue,
  LegalDomain,
  ModelAnswerRequest,
  RankedLegalDocument,
} from "@/lib/legalEncyclopedia/types";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import type { SessionPayload } from "@/lib/authSession";
import { getClientIdentifier, LIMIT_AI_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { generateGeminiContent } from "@/lib/geminiClient";
import { expandOntology } from "@/lib/legalEncyclopedia/ontology";
import { fetchCategoryDocuments } from "@/lib/legalEncyclopedia/categoryFetch";
import { enrichLawMeta, enrichPrecedentMeta } from "@/lib/legalEncyclopedia/documentMeta";
import {
  attachViewCounts,
  buildDocumentKey,
  fetchViewCounts,
  sortDocumentsByViews,
} from "@/lib/legalEncyclopedia/documentStats";
import { getLawGoKrOc } from "@/lib/lawOpenApiSettings";
import {
  getProject,
  isProjectDbReady,
} from "@/lib/legalEncyclopedia/encyclopediaProjectDb";
import { syncFeatureToProject } from "@/lib/legalEncyclopedia/syncArtifact";
import {
  aiSearchToArtifact,
  briefDraftToArtifact,
  lawArticlesToArtifact,
  pdfSummaryToArtifact,
  precedentCardsToArtifact,
  type FeatureArtifactPayload,
  type SourceFeatureId,
} from "@/lib/legalEncyclopedia/adapters/featureAdapters";
import type { PrecedentCard } from "@/components/board/ai/CaseRecommendTab";
import type { LawArticleItem } from "@/lib/lawSearchParse";

const VALID_CATEGORIES = new Set(["판례", "법령", "서식", "기타자료", "관련법률문서"]);

async function callAi(prompt: string): Promise<string> {
  const result = await generateGeminiContent({
    parts: [{ text: prompt }],
    systemHint:
      "당신은 대한민국 법률 온라인 백과사전·모범답안 AI입니다. 특허 기반 법률정보 검색·순위화·문서 작성 전문가입니다.",
    temperature: 0.3,
    maxOutputTokens: 8192,
  });
  if (!result.ok) throw new Error(result.message);
  return result.text;
}

function normalizeCategory(c: string): EncyclopediaCategory {
  if (c === "관련법률문서" || c === "관련 법률문서") return "관련법률문서";
  return VALID_CATEGORIES.has(c) ? (c as EncyclopediaCategory) : "기타자료";
}

function enrichRawDocMeta(doc: RawAiDocument): RawAiDocument {
  if (doc.category === "판례") {
    return { ...doc, meta: enrichPrecedentMeta(doc.title, doc.source, doc.body, doc.meta) };
  }
  if (doc.category === "법령") {
    return { ...doc, meta: enrichLawMeta(doc.title, doc.body, doc.meta) };
  }
  return doc;
}

async function resolveTenant(auth: { session: SessionPayload }) {
  const db = getSupabaseAdmin();
  if (!db) return { error: NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 }) };
  const managementNumber = await resolveManagementNumber(auth.session, db);
  if (!managementNumber) {
    return { error: NextResponse.json({ error: "관리번호가 설정되지 않았습니다." }, { status: 403 }) };
  }
  return { db, managementNumber, loginId: auth.session.loginId };
}

function parseSyncPayload(
  featureId: SourceFeatureId,
  payload: Record<string, unknown>
): FeatureArtifactPayload {
  switch (featureId) {
    case "case_search":
      return precedentCardsToArtifact((payload.cards ?? []) as PrecedentCard[]);
    case "doc_summary":
      return pdfSummaryToArtifact({
        fileName: String(payload.fileName ?? "판결문"),
        summary: String(payload.summary ?? ""),
        ocrText: payload.ocrText ? String(payload.ocrText) : undefined,
      });
    case "law_search":
      return lawArticlesToArtifact(
        (payload.articles ?? []) as LawArticleItem[],
        String(payload.query ?? "")
      );
    case "ai_search":
      return aiSearchToArtifact(String(payload.query ?? ""), String(payload.answer ?? ""));
    case "doc_draft":
      return briefDraftToArtifact(String(payload.title ?? "서면"), String(payload.content ?? ""));
    default:
      return {
        sourceFeature: "legal_encyclopedia",
        title: String(payload.title ?? "백과 자료"),
        contentText: String(payload.contentText ?? ""),
        category: "관련법률문서",
        domain: "전체",
      };
  }
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const limited = enforceRateLimit(req, `ai:encyclopedia:${getClientIdentifier(req)}`, LIMIT_AI_PER_MIN, {
    routePath: "/api/ai/legal-encyclopedia",
    source: "ai",
  });
  if (limited) return limited;

  const tenant = await resolveTenant(auth);
  if ("error" in tenant) return tenant.error;
  const { db, managementNumber, loginId } = tenant;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const action = String(body.action ?? "search");
  const projectId = body.projectId ? String(body.projectId) : undefined;
  const dbReady = await isEncyclopediaDbReady(db);
  if (dbReady) await ensureOntologySeeded(db);

  if (action === "sync_from_feature") {
    if (!projectId) return NextResponse.json({ error: "projectId가 필요합니다." }, { status: 400 });
    if (!(await isProjectDbReady(db))) {
      return NextResponse.json({ error: "encyclopedia_projects 마이그레이션 필요" }, { status: 503 });
    }

    const project = await getProject(db, projectId, managementNumber);
    if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

    const featureId = String(body.featureId ?? "") as SourceFeatureId;
    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const artifact = parseSyncPayload(featureId, payload);

    const result = await syncFeatureToProject(db, {
      project,
      managementNumber,
      loginId,
      artifact,
      saveToDrive: body.saveToDrive !== false,
    });

    return NextResponse.json({
      success: true,
      message: `${result.vectorCount}개 벡터가 프로젝트 백과에 저장되었습니다.`,
      ...result,
    });
  }

  if (action === "search") {
    const keyword = String(body.keyword ?? "").trim();
    if (!keyword) return NextResponse.json({ error: "검색 키워드를 입력하세요." }, { status: 400 });

    const category = (body.category as EncyclopediaCategory | "전체") ?? "전체";
    const detail = body.detail ? String(body.detail) : undefined;

    const ontology = dbReady
      ? await expandOntologyWithDb(db, keyword, managementNumber)
      : { ...expandOntology(keyword), fromDb: false };

    let features = formFeatureValues(keyword, ontology.synonyms, ontology.relatedLaws, ontology.domain);
    const learnedWeights = dbReady
      ? await loadFeatureWeights(db, managementNumber, keyword, projectId)
      : new Map();
    if (learnedWeights.size > 0) features = applyLearnedWeights(features, learnedWeights);

    const vectors = buildVectorsFromFeatures(features);
    const queryVector = textToSemanticVector(keyword);

    const searchPrompt = buildSearchPrompt({
      keyword,
      synonyms: ontology.synonyms,
      domain: ontology.domain,
      domainReason: ontology.domainReason,
      features,
      category,
      detail,
    });

    let aiDocs: RawAiDocument[] = [];
    try {
      const aiText = await callAi(searchPrompt);
      aiDocs = parseAiDocumentsJson(aiText).map((d) =>
        enrichRawDocMeta({
          title: d.title,
          category: normalizeCategory(d.category),
          domain: d.domain,
          summary: d.summary,
          body: d.body,
          source: d.source ?? "AI 분석",
        })
      );
    } catch (e) {
      console.error("encyclopedia search AI:", e);
    }

    let apiDocs: RawAiDocument[] = [];
    if (category !== "전체" && (category === "판례" || category === "법령")) {
      const oc = await getLawGoKrOc();
      apiDocs = (await fetchCategoryDocuments(category, keyword, oc)).map(enrichRawDocMeta);
    }

    if (aiDocs.length === 0 && apiDocs.length === 0) {
      aiDocs = [
        enrichRawDocMeta({
          title: `${keyword} 관련 ${category !== "전체" ? category : "법령"} 개요`,
          category: category !== "전체" ? category : "법령",
          domain: ontology.domain,
          summary: `${keyword}에 관한 기본 법적 개념과 적용 범위를 정리합니다.`,
          body: `온톨로지: ${ontology.domainReason}. 유의어: ${ontology.synonyms.join(", ")}`,
          source: "로이고법률백과",
        }),
      ];
    }

    let storedRaw: RawAiDocument[] = [];
    if (dbReady) {
      const stored = await searchStoredVectors(
        db,
        managementNumber,
        keyword,
        ontology.synonyms,
        ontology.domain,
        12,
        projectId
      );
      storedRaw = storedVectorsToRaw(stored);
    }

    const merged = mergeRawDocuments([...apiDocs, ...aiDocs], storedRaw);
    let documents = rankDocuments(keyword, queryVector, features, merged, learnedWeights);

    if (category !== "전체") {
      const filtered = documents.filter((d) => d.category === category);
      if (filtered.length > 0) documents = filtered;
    }
    if (ontology.domain !== "전체" && documents.length > 3) {
      const domainFiltered = documents.filter((d) => d.domain === ontology.domain || d.domain === "전체");
      if (domainFiltered.length > 0) documents = domainFiltered;
    }

    const keys = documents.map((d) => buildDocumentKey(d));
    if (dbReady) {
      const counts = await fetchViewCounts(db, managementNumber, keys);
      documents = sortDocumentsByViews(attachViewCounts(documents, counts));
    } else {
      documents = documents.map((d) => ({
        ...d,
        documentKey: buildDocumentKey(d),
        viewCount: 0,
      }));
    }

    const sections = buildDictionarySections(keyword, documents);
    const stats = dbReady ? await getEncyclopediaStats(db, managementNumber, projectId) : undefined;

    if (dbReady) {
      await recordUsage(db, {
        management_number: managementNumber,
        login_id: loginId,
        action: "search",
        keyword,
        project_id: projectId ?? null,
        feature_snapshot: features,
        metadata: { storedHits: storedRaw.length, aiHits: aiDocs.length, apiHits: apiDocs.length, fromDb: ontology.fromDb, projectId },
      });
    }

    const pipeline = buildPipelineSteps([
      `키워드 「${keyword}」 수신`,
      ontology.fromDb ? `DB 온톨로지 · ${ontology.domain}` : `정적 온톨로지 · ${ontology.domain}`,
      `자질값 ${features.length}개 (학습가중 ${learnedWeights.size}개 반영)`,
      `업로드 벡터 ${storedRaw.length}건 + API ${apiDocs.length}건 + AI ${aiDocs.length}건 병합`,
      `의미벡터 ${vectors.length}개 변환·저장`,
      "AI 다층 신경망 연관 분석",
      `순위화 완료 ${documents.length}건`,
      `문자열 사전 소목차 ${sections.length}개`,
      "문서순위기반 출력 완료",
    ]);

    return NextResponse.json({
      keyword,
      synonyms: ontology.synonyms,
      domain: ontology.domain as LegalDomain,
      domainReason: ontology.domainReason,
      features,
      vectors,
      documents,
      sections,
      pipeline,
      stats: stats
        ? {
            vectorCount: stats.vectorCount,
            documentCount: stats.documentCount,
            usageCount: stats.usageCount,
            fromDb: ontology.fromDb,
          }
        : undefined,
    });
  }

  if (action === "model_answer") {
    const keyword = String(body.keyword ?? "").trim();
    const sectionTitle = String(body.sectionTitle ?? "").trim();
    const sectionId = body.sectionId ? String(body.sectionId) : undefined;
    const documents = (body.documents ?? []) as RankedLegalDocument[];
    const features = (body.features ?? []) as ModelAnswerRequest["features"];

    if (!keyword || !sectionTitle) {
      return NextResponse.json({ error: "키워드와 소목차가 필요합니다." }, { status: 400 });
    }

    let repetitiveResolution = false;
    if (dbReady && sectionId) {
      const { data: recent } = await db
        .from("legal_usage_records")
        .select("keyword, section_id")
        .eq("management_number", managementNumber)
        .eq("login_id", loginId)
        .order("created_at", { ascending: false })
        .limit(20);

      repetitiveResolution = detectRepetitiveResolution(
        (recent ?? []).map((r) => ({
          keyword: r.keyword as string,
          section_id: r.section_id as string | null,
        })),
        keyword,
        sectionId
      );
    }

    const prompt = buildModelAnswerPrompt({ keyword, sectionTitle, documents, features });
    let fullText = "";
    try {
      fullText = await callAi(prompt);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "AI 요청 실패" }, { status: 503 });
    }

    const sections = parseModelAnswerSections(fullText);
    const blocks = sections.map((s, i) => ({
      id: `block-${i}`,
      sectionTitle: s.title,
      clauses: s.content.split(/\n+/).filter((l) => l.trim().length > 10).slice(0, 8),
      objectiveFunctionLabel:
        i === sections.length - 1
          ? repetitiveResolution
            ? "반복해결 매커니즘 → 목적함수벡터 확정"
            : "목적함수벡터 연결 완료"
          : undefined,
    }));

    if (dbReady) {
      await recordUsage(db, {
        management_number: managementNumber,
        login_id: loginId,
        action: "model_answer",
        keyword,
        section_id: sectionId,
        section_title: sectionTitle,
        feature_snapshot: features,
        project_id: projectId ?? null,
      });
      await upsertFeatureWeightsFromSelection(db, managementNumber, keyword, features, projectId);
    }

    const pipeline = buildModelAnswerPipeline([
      `자질값 ${features.length}개 가중치 비교`,
      repetitiveResolution ? "반복해결 패턴 감지 ✓" : "반복해결 패턴 학습 중",
      "목적함수 로직 도출",
      `소목차 「${sectionTitle}」 문자열 연결`,
      "모범답안 웹문서 산출",
    ]);

    return NextResponse.json({
      title: `${keyword} — ${sectionTitle} 모범답안`,
      blocks,
      fullText,
      pipeline,
      repetitiveResolution,
    });
  }

  if (action === "ingest") {
    if (!dbReady) {
      return NextResponse.json(
        { error: "legal_vectors 테이블이 없습니다. Supabase 마이그레이션을 적용하세요." },
        { status: 503 }
      );
    }

    const title = String(body.title ?? "업로드 법률문서").trim();
    const rawText = String(body.text ?? "").trim();
    const category = normalizeCategory(String(body.category ?? "관련법률문서"));
    const domain = (String(body.domain ?? "전체") as LegalDomain) || "전체";

    if (!rawText || rawText.length < 50) {
      return NextResponse.json({ error: "법률문서 본문을 50자 이상 입력하세요." }, { status: 400 });
    }

    const clauses = extractLegalClauses(rawText);
    const vectors = clausesToVectors(clauses, {
      category,
      domain,
      featureLabels: [title],
    });

    const result = await ingestDocument(db, {
      managementNumber,
      loginId,
      title,
      rawText,
      category,
      domain,
      sourceFilename: body.filename ? String(body.filename) : undefined,
      vectors,
      projectId: projectId ?? null,
    });

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      clauseCount: result.vectorCount,
      message: `${result.vectorCount}개 법률구문이 의미벡터로 저장되었습니다.`,
    });
  }

  if (action === "record_selection") {
    if (!dbReady) return NextResponse.json({ success: true, offline: true });

    const keyword = String(body.keyword ?? "").trim();
    const vectorId = body.vectorId ? String(body.vectorId) : undefined;
    const sectionId = body.sectionId ? String(body.sectionId) : undefined;
    const sectionTitle = body.sectionTitle ? String(body.sectionTitle) : undefined;
    const features = (body.features ?? []) as FeatureValue[];
    const rankingScore = typeof body.rankingScore === "number" ? body.rankingScore : undefined;
    const selectionType = String(body.selectionType ?? "select_document");

    await recordUsage(db, {
      management_number: managementNumber,
      login_id: loginId,
      action: selectionType,
      keyword,
      vector_id: vectorId,
      section_id: sectionId,
      section_title: sectionTitle,
      feature_snapshot: features,
      ranking_score: rankingScore,
      project_id: projectId ?? null,
    });

    if (keyword && features.length > 0) {
      await upsertFeatureWeightsFromSelection(db, managementNumber, keyword, features, projectId);
    }

    const weights = keyword ? await loadFeatureWeights(db, managementNumber, keyword, projectId) : new Map();

    return NextResponse.json({
      success: true,
      learnedWeights: Object.fromEntries(weights),
    });
  }

  return NextResponse.json({ error: "지원하지 않는 action입니다." }, { status: 400 });
}

export async function GET() {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  let stats = null;
  if (db) {
    const mn = await resolveManagementNumber(auth.session, db);
    if (mn && (await isEncyclopediaDbReady(db))) {
      stats = await getEncyclopediaStats(db, mn);
    }
  }

  return NextResponse.json({
    name: "로이고법률백과",
    patent: "10-2019-0015797",
    dbReady: Boolean(stats),
    stats,
    modules: [
      "키워드범위인식(온톨로지 DB)",
      "자질값 형성·학습",
      "차원감소·의미벡터 DB",
      "법률문서 ingest",
      "순위화 프레임워크",
      "반복해결 매커니즘",
      "모범답안 산출",
    ],
    actions: ["search", "model_answer", "ingest", "record_selection", "sync_from_feature"],
  });
}
