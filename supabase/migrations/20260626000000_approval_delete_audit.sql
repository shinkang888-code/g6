-- 결재완료 문서 사내관리자 삭제 감사 로그 (문서 본문 스냅샷 보관)

CREATE TABLE IF NOT EXISTS public.approval_delete_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  approval_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('soft_delete', 'permanent_delete')),
  actor_id TEXT,
  actor_login_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  doc_title TEXT NOT NULL,
  doc_type TEXT,
  doc_status TEXT,
  doc_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_delete_audit_tenant ON public.approval_delete_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_delete_audit_approval ON public.approval_delete_audit_logs(approval_id);

COMMENT ON TABLE public.approval_delete_audit_logs IS '사내관리자 결재완료 문서 삭제 감사 (본문 스냅샷)';

ALTER TABLE public.approval_delete_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_delete_audit_service_all" ON public.approval_delete_audit_logs;
CREATE POLICY "approval_delete_audit_service_all"
  ON public.approval_delete_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
