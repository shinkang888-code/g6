-- 대법원 나의사건검색 비동기 작업 큐 (Vercel → Supabase → 로컬 봇)
CREATE TABLE IF NOT EXISTS public.scourt_search_jobs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  params JSONB NOT NULL,
  save_to_case BOOLEAN NOT NULL DEFAULT false,
  match_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  result JSONB,
  error TEXT,
  captcha_attempts INT,
  worker_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scourt_jobs_pending
  ON public.scourt_search_jobs (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scourt_jobs_user
  ON public.scourt_search_jobs (user_id, created_at DESC);

ALTER TABLE public.scourt_search_jobs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.scourt_search_jobs IS '나의사건검색 봇 작업 큐. 서버(service role) 및 로컬 워커만 접근.';
