-- 로이고법률백과 — 프로젝트(의뢰인+사건) · artifacts · project_id 확장

CREATE TABLE IF NOT EXISTS public.encyclopedia_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  management_number text NOT NULL,
  case_id uuid REFERENCES public.cases (id) ON DELETE SET NULL,
  client_name text NOT NULL,
  case_title text NOT NULL,
  project_key text NOT NULL,
  drive_folder_id text,
  drive_folder_path text,
  status text NOT NULL DEFAULT 'active',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_encyclopedia_projects_key
  ON public.encyclopedia_projects (management_number, project_key);

CREATE INDEX IF NOT EXISTS idx_encyclopedia_projects_case
  ON public.encyclopedia_projects (case_id);

CREATE TABLE IF NOT EXISTS public.encyclopedia_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.encyclopedia_projects (id) ON DELETE CASCADE,
  source_feature text NOT NULL,
  title text NOT NULL,
  content_text text,
  structured_json jsonb,
  drive_file_id text,
  drive_file_path text,
  legal_document_id uuid REFERENCES public.legal_documents (id) ON DELETE SET NULL,
  legal_vector_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encyclopedia_artifacts_project
  ON public.encyclopedia_artifacts (project_id, created_at DESC);

-- legal_* 테이블 project_id
ALTER TABLE public.legal_documents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.encyclopedia_projects (id) ON DELETE SET NULL;

ALTER TABLE public.legal_vectors
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.encyclopedia_projects (id) ON DELETE SET NULL;

ALTER TABLE public.legal_usage_records
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.encyclopedia_projects (id) ON DELETE SET NULL;

ALTER TABLE public.legal_feature_weights
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.encyclopedia_projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_legal_vectors_project ON public.legal_vectors (project_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_project ON public.legal_documents (project_id);

ALTER TABLE public.legal_feature_weights
  DROP CONSTRAINT IF EXISTS legal_feature_weights_management_number_keyword_feature_label_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_feature_weights_scope
  ON public.legal_feature_weights (
    management_number,
    keyword,
    feature_label,
    COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

ALTER TABLE public.encyclopedia_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encyclopedia_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS encyclopedia_projects_service ON public.encyclopedia_projects;
CREATE POLICY encyclopedia_projects_service ON public.encyclopedia_projects FOR ALL USING (false);

DROP POLICY IF EXISTS encyclopedia_artifacts_service ON public.encyclopedia_artifacts;
CREATE POLICY encyclopedia_artifacts_service ON public.encyclopedia_artifacts FOR ALL USING (false);
