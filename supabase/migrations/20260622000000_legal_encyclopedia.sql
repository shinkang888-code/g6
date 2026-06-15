-- 로이고법률백과 — 벡터·사용기록·온톨로지 DB (특허 10-2019-0015797)

-- 1) 온톨로지 사전 (전역 + 회사별 확장)
CREATE TABLE IF NOT EXISTS public.legal_ontology_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  synonyms jsonb NOT NULL DEFAULT '[]'::jsonb,
  domain text NOT NULL DEFAULT '전체',
  related_laws jsonb NOT NULL DEFAULT '[]'::jsonb,
  management_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_ontology_global
  ON public.legal_ontology_entries (keyword) WHERE management_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_ontology_tenant
  ON public.legal_ontology_entries (keyword, management_number) WHERE management_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_ontology_domain ON public.legal_ontology_entries (domain);

-- 2) 업로드 법률문서 (ingest 부모)
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  management_number text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT '관련법률문서',
  domain text NOT NULL DEFAULT '전체',
  source_filename text,
  raw_text text,
  clause_count int NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_mgmt ON public.legal_documents (management_number, created_at DESC);

-- 3) 의미벡터 저장소 (딥러닝 DB)
CREATE TABLE IF NOT EXISTS public.legal_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  management_number text NOT NULL,
  document_id uuid REFERENCES public.legal_documents (id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'ingest',
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT '관련법률문서',
  domain text NOT NULL DEFAULT '전체',
  vector_dims jsonb NOT NULL DEFAULT '[]'::jsonb,
  magnitude numeric(12, 6) NOT NULL DEFAULT 0,
  feature_labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  clause_index int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_vectors_mgmt ON public.legal_vectors (management_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_vectors_doc ON public.legal_vectors (document_id);
CREATE INDEX IF NOT EXISTS idx_legal_vectors_domain ON public.legal_vectors (domain);

-- 4) 사용기록 DB (선택·검색·반복해결)
CREATE TABLE IF NOT EXISTS public.legal_usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  management_number text NOT NULL,
  login_id text NOT NULL,
  action text NOT NULL,
  keyword text,
  vector_id uuid REFERENCES public.legal_vectors (id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.legal_documents (id) ON DELETE SET NULL,
  section_id text,
  section_title text,
  feature_snapshot jsonb,
  ranking_score numeric(8, 2),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_usage_mgmt_kw ON public.legal_usage_records (management_number, keyword, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_usage_login ON public.legal_usage_records (login_id, created_at DESC);

-- 5) 자질값 가중치 학습 (반복해결 매커니즘)
CREATE TABLE IF NOT EXISTS public.legal_feature_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  management_number text NOT NULL,
  keyword text NOT NULL,
  feature_label text NOT NULL,
  feature_kind text NOT NULL DEFAULT 'keyword',
  weight numeric(8, 4) NOT NULL DEFAULT 1.0,
  selection_count int NOT NULL DEFAULT 0,
  last_selected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (management_number, keyword, feature_label)
);

CREATE INDEX IF NOT EXISTS idx_legal_feature_weights_lookup
  ON public.legal_feature_weights (management_number, keyword);

-- RLS: service role only (API 경유)
ALTER TABLE public.legal_ontology_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_feature_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_ontology_service_only ON public.legal_ontology_entries;
CREATE POLICY legal_ontology_service_only ON public.legal_ontology_entries FOR ALL USING (false);

DROP POLICY IF EXISTS legal_documents_service_only ON public.legal_documents;
CREATE POLICY legal_documents_service_only ON public.legal_documents FOR ALL USING (false);

DROP POLICY IF EXISTS legal_vectors_service_only ON public.legal_vectors;
CREATE POLICY legal_vectors_service_only ON public.legal_vectors FOR ALL USING (false);

DROP POLICY IF EXISTS legal_usage_service_only ON public.legal_usage_records;
CREATE POLICY legal_usage_service_only ON public.legal_usage_records FOR ALL USING (false);

DROP POLICY IF EXISTS legal_feature_weights_service_only ON public.legal_feature_weights;
CREATE POLICY legal_feature_weights_service_only ON public.legal_feature_weights FOR ALL USING (false);

-- 전역 온톨로지 시드 (민법·형법·상법·소송법)
INSERT INTO public.legal_ontology_entries (keyword, synonyms, domain, related_laws, management_number)
VALUES
  ('채권자취소권', '["사해행위","채권자취소","사해행위취소"]', '민법', '["민법 제406조","민사소송법"]', NULL),
  ('사해행위', '["채권자취소권","사해의사"]', '민법', '["민법 제406조"]', NULL),
  ('손해배상', '["불법행위","채무불이행","배상청구"]', '민법', '["민법 제750조","민법 제390조"]', NULL),
  ('불법행위', '["손해배상","과실상계"]', '민법', '["민법 제750조"]', NULL),
  ('계약해지', '["계약종료","해제","해지통보"]', '민법', '["민법 제543조"]', NULL),
  ('이혼', '["혼인파탄","재판이혼","협의이혼"]', '민법', '["민법 제840조"]', NULL),
  ('소멸시효', '["시효완성","시효중단"]', '민법', '["민법 제162조"]', NULL),
  ('임대차', '["전세","월세","임차권"]', '민법', '["민법 제618조","주택임대차보호법"]', NULL),
  ('횡령', '["배임","업무상횡령"]', '형법', '["형법 제355조","형법 제356조"]', NULL),
  ('배임', '["횡령","업무상배임"]', '형법', '["형법 제355조"]', NULL),
  ('사기', '["편취","기망","사기죄"]', '형법', '["형법 제347조"]', NULL),
  ('명예훼손', '["모욕","허위사실"]', '형법', '["형법 제307조"]', NULL),
  ('주주총회', '["주총","주주결의"]', '상법', '["상법 제363조"]', NULL),
  ('이사의책임', '["주의의무","충실의무"]', '상법', '["상법 제382조"]', NULL),
  ('회사해산', '["청산","해산사유"]', '상법', '["상법 제520조"]', NULL),
  ('소의제기', '["소장","제소"]', '민사소송법', '["민사소송법 제249조"]', NULL),
  ('가처분', '["가압류","보전처분"]', '민사소송법', '["민사소송법 제300조"]', NULL),
  ('구속영장', '["구속","영장실질심사"]', '형사소송법', '["형사소송법 제70조"]', NULL),
  ('기본권', '["평등권","자유권"]', '헌법', '["헌법 제10조"]', NULL),
  ('행정처분', '["취소소송","무효확인"]', '행정법', '["행정소송법"]', NULL),
  ('특허침해', '["특허권","실용신안"]', '기업법무', '["특허법"]', NULL),
  ('근로계약', '["해고","부당해고"]', '기업법무', '["근로기준법"]', NULL);
