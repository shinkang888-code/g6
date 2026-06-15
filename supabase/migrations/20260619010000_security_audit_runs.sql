-- fireauto security-guard 감사 실행 이력

CREATE TABLE IF NOT EXISTS public.security_audit_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  triggered_by TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_markdown TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_runs_created_at ON public.security_audit_runs(created_at DESC);

COMMENT ON TABLE public.security_audit_runs IS 'fireauto 8카테고리 보안 코드 감사 실행 이력';

ALTER TABLE public.security_audit_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "security_audit_runs_service_all" ON public.security_audit_runs;
CREATE POLICY "security_audit_runs_service_all"
  ON public.security_audit_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
