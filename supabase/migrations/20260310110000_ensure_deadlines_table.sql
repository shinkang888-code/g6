-- 기일 엑셀 업로드 오류 "Could not find the table 'public.deadlines'" 해결용
-- Supabase SQL Editor에서 단독 실행 가능 (CREATE TABLE IF NOT EXISTS)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

COMMENT ON TABLE public.deadlines IS '사건별 기일 - datelist 엑셀 연동';

ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deadlines_all" ON public.deadlines;
CREATE POLICY "deadlines_all" ON public.deadlines FOR ALL TO authenticated USING (true);
