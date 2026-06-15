-- 사건 당사자 (다중 의뢰인·상대방·제3자)

CREATE TABLE IF NOT EXISTS public.case_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('client', 'opponent', 'third_party')),
  sort_order INT NOT NULL DEFAULT 0,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  position TEXT,
  is_corporate BOOLEAN DEFAULT FALSE,
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  email TEXT,
  address TEXT,
  id_number TEXT,
  biz_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_parties_case_id ON public.case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_role ON public.case_parties(case_id, role);

DROP TRIGGER IF EXISTS case_parties_updated_at ON public.case_parties;
CREATE TRIGGER case_parties_updated_at
  BEFORE UPDATE ON public.case_parties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "case_parties_authenticated_all" ON public.case_parties;
CREATE POLICY "case_parties_authenticated_all"
  ON public.case_parties FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
