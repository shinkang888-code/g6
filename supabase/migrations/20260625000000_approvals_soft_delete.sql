-- 전자결재 소프트 삭제 (1차 삭제 → deleted_at, 2차 삭제 → 영구 삭제)

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_approvals_deleted_at ON public.approvals(deleted_at);

COMMENT ON COLUMN public.approvals.deleted_at IS '1차 삭제 시각. NULL이면 정상. 2차 삭제 시 행 제거';
