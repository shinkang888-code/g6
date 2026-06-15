-- public.cases 테이블이 없을 때 Supabase SQL Editor에서 이 스크립트를 실행하세요.
-- "Could not find the table 'public.cases' in the schema cache" 오류 해결용

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('변호사', '사무장', '사무원', '인턴', '관리자')),
  department TEXT DEFAULT '',
  email TEXT,
  phone TEXT,
  approval_level INT DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  position TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT NOT NULL UNIQUE,
  case_type TEXT NOT NULL,
  case_name TEXT NOT NULL,
  court TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_position TEXT,
  opponent_name TEXT,
  status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류', '취하', '종결')),
  assigned_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  assigned_staff_name TEXT NOT NULL,
  assistants TEXT DEFAULT '',
  received_date DATE NOT NULL,
  amount NUMERIC(15,0) DEFAULT 0,
  received_amount NUMERIC(15,0) DEFAULT 0,
  pending_amount NUMERIC(15,0) DEFAULT 0,
  is_electronic BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  is_immutable_deadline BOOLEAN DEFAULT FALSE,
  notes TEXT,
  closed_at DATE,
  closed_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_client_name ON public.cases(client_name);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_staff ON public.cases(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_cases_received_date ON public.cases(received_date);

DROP TRIGGER IF EXISTS cases_updated_at ON public.cases;
CREATE TRIGGER cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.cases;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.cases;
DROP POLICY IF EXISTS "Allow update for authenticated" ON public.cases;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON public.cases;
CREATE POLICY "Allow read for authenticated" ON public.cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated" ON public.cases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON public.cases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for authenticated" ON public.cases FOR DELETE TO authenticated USING (true);

-- service_role은 RLS 우회하므로 API(서버)에서 정상 동작합니다.
