-- approvals.metadata — 지급품의·근태 등 유형별 필드 저장

ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.approvals.metadata IS '문서 유형별 추가 필드 (지급목적, 행선지 등)';
