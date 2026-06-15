-- 사건 변경 감사 로그 (누가·언제·무엇을 변경했는지)

CREATE TABLE IF NOT EXISTS public.case_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  case_number TEXT,
  client_name TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'bulk_status', 'bulk_import',
    'institutions_update', 'parties_update'
  )),
  actor_id TEXT,
  actor_name TEXT NOT NULL DEFAULT '알 수 없음',
  actor_login_id TEXT,
  summary TEXT,
  changes JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_audit_logs_case_id ON public.case_audit_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_case_audit_logs_case_number ON public.case_audit_logs(case_number);
CREATE INDEX IF NOT EXISTS idx_case_audit_logs_created_at ON public.case_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_audit_logs_actor_login_id ON public.case_audit_logs(actor_login_id);

COMMENT ON TABLE public.case_audit_logs IS '사건 기록 변경 감사 로그';

ALTER TABLE public.case_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "case_audit_logs_authenticated_read" ON public.case_audit_logs;
DROP POLICY IF EXISTS "case_audit_logs_authenticated_insert" ON public.case_audit_logs;
CREATE POLICY "case_audit_logs_authenticated_read"
  ON public.case_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "case_audit_logs_authenticated_insert"
  ON public.case_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
