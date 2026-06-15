-- 사건 계속기관(진행단계별 연락처) + cases 메타 필드

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS trial_level TEXT,
  ADD COLUMN IF NOT EXISTS management_key TEXT,
  ADD COLUMN IF NOT EXISTS active_stage TEXT;

COMMENT ON COLUMN public.cases.trial_level IS '대표 심급 (1심|2심|3심|기타)';
COMMENT ON COLUMN public.cases.management_key IS 'LawTop 키값';
COMMENT ON COLUMN public.cases.active_stage IS '현재 계속기관 단계';

CREATE TABLE IF NOT EXISTS public.case_institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('police', 'prosecution', 'court_1', 'court_2', 'court_3', 'detention')),
  sort_order INT NOT NULL DEFAULT 0,
  agency_name TEXT,
  case_number TEXT,
  case_name TEXT,
  department TEXT,
  contact_name TEXT,
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  email TEXT,
  room TEXT,
  notes TEXT,
  detention_agency TEXT,
  detention_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (case_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_case_institutions_case_id ON public.case_institutions(case_id);
CREATE INDEX IF NOT EXISTS idx_case_institutions_stage ON public.case_institutions(stage);

DROP TRIGGER IF EXISTS case_institutions_updated_at ON public.case_institutions;
CREATE TRIGGER case_institutions_updated_at
  BEFORE UPDATE ON public.case_institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_institutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "case_institutions_authenticated_all" ON public.case_institutions;
CREATE POLICY "case_institutions_authenticated_all"
  ON public.case_institutions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
