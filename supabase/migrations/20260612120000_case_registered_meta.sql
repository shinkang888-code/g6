-- LawTop 호환: 등록일·등록인
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS registered_date DATE,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT DEFAULT '';

COMMENT ON COLUMN public.cases.registered_date IS 'LawTop 등록일 (없으면 created_at 날짜 사용)';
COMMENT ON COLUMN public.cases.created_by_name IS '등록인(작성자)';

CREATE INDEX IF NOT EXISTS idx_cases_registered_date ON public.cases(registered_date);
