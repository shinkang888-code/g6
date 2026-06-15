-- 사건 기일(deadlines) 테이블 - cases만 있고 deadlines가 없을 때 실행
-- datelist.xls 시드 및 기일 API 연동용

CREATE TABLE IF NOT EXISTS public.deadlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  deadline_date DATE NOT NULL,
  deadline_type TEXT NOT NULL,
  court TEXT,
  memo TEXT,
  is_immutable BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deadlines_case_id ON public.deadlines(case_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON public.deadlines(deadline_date);

COMMENT ON TABLE public.deadlines IS '사건별 기일 - datelist 연동, 다음 기일 산출';

ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deadlines_all" ON public.deadlines;
CREATE POLICY "deadlines_all" ON public.deadlines FOR ALL TO authenticated USING (true);
