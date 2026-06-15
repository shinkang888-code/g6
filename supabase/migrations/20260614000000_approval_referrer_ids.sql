-- 참조자 ID 저장 (부서 일괄 선택 시 직원별 열람 권한·알림용)
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS referrer_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.approvals.referrer_ids IS '참조/협조 직원 site_users.id 목록';
