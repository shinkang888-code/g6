-- LawyGo 스키마 (LawTop GL 송무 로직 반영)
-- Supabase PostgreSQL

-- 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 직원/사용자 (staff, user_lawygo)
-- ============================================
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

COMMENT ON TABLE public.staff IS '담당자(직원) - 수행/보조, 결재선';

-- ============================================
-- 2. 의뢰인 (clients) - 상담→수임 전환
-- ============================================
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

COMMENT ON TABLE public.clients IS '의뢰인 마스터 (상담·수임 공통)';

-- ============================================
-- 3. 사건 (cases) - 핵심
-- ============================================
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

COMMENT ON TABLE public.cases IS '사건 마스터 - LawTop 진행관리 대응';

-- ============================================
-- 4. 기일 (deadlines)
-- ============================================
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

COMMENT ON TABLE public.deadlines IS '사건별 기일 - 다음 기일 산출용';

-- ============================================
-- 5. 타임라인/메모 (그누보드 연동 wr_1=case_id)
-- ============================================
CREATE TABLE IF NOT EXISTS public.timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('memo', 'court_update', 'document', 'status_change', 'finance')),
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_case_id ON public.timeline(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created_at ON public.timeline(created_at DESC);

COMMENT ON TABLE public.timeline IS '사건 타임라인 - 메모/법원업데이트/문서/수납';

-- ============================================
-- 6. 타임라인 첨부파일
-- ============================================
CREATE TABLE IF NOT EXISTS public.timeline_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeline_id UUID NOT NULL REFERENCES public.timeline(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INT DEFAULT 0,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 전자결재 (approvals)
-- ============================================
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('청구서', '보고서', '위임장', '계약서', '기타')),
  status TEXT NOT NULL DEFAULT '임시저장' CHECK (status IN ('임시저장', '결재요청', '결재중', '결재완료', '반려')),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  case_number TEXT,
  requester_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  amount NUMERIC(15,0),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.approval_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL,
  role TEXT,
  status TEXT NOT NULL DEFAULT '대기' CHECK (status IN ('대기', '승인', '반려')),
  signed_at TIMESTAMPTZ,
  comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_case_id ON public.approvals(case_id);

-- ============================================
-- 8. 수납/회계 (finance) - LawTopCashReceipt 대응
-- ============================================
CREATE TABLE IF NOT EXISTS public.finance_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('수납', '지출', '미수금')),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  case_number TEXT,
  client_name TEXT NOT NULL,
  amount NUMERIC(15,0) NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT '미확인' CHECK (status IN ('확인', '미확인', '매칭완료')),
  bank_transaction_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,
  depositor_name TEXT NOT NULL,
  amount NUMERIC(15,0) NOT NULL,
  bank_name TEXT,
  memo TEXT,
  matched_finance_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_entries_case_id ON public.finance_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_status ON public.finance_entries(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_matched ON public.bank_transactions(matched_finance_id);

-- ============================================
-- 9. 알림 (ChatNoti 대응)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('urgent_date', 'approval_request', 'memo', 'finance')),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- ============================================
-- 10. 상담 (선택 - 상담→수임 전환)
-- ============================================
CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  consultation_date DATE NOT NULL,
  content TEXT,
  converted_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security) - 기본 활성화
-- ============================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- 정책 예: 인증된 사용자만 전체 읽기 (실제로는 role/부서별 정책 적용)
CREATE POLICY "Allow read for authenticated" ON public.cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated" ON public.cases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON public.cases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for authenticated" ON public.cases FOR DELETE TO authenticated USING (true);

-- 나머지 테이블도 동일 패턴 적용 가능 (필요 시 세분화)
CREATE POLICY "staff_select" ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_all" ON public.clients FOR ALL TO authenticated USING (true);
CREATE POLICY "deadlines_all" ON public.deadlines FOR ALL TO authenticated USING (true);
CREATE POLICY "timeline_all" ON public.timeline FOR ALL TO authenticated USING (true);
CREATE POLICY "approvals_all" ON public.approvals FOR ALL TO authenticated USING (true);
CREATE POLICY "approval_steps_all" ON public.approval_steps FOR ALL TO authenticated USING (true);
CREATE POLICY "finance_all" ON public.finance_entries FOR ALL TO authenticated USING (true);
CREATE POLICY "bank_all" ON public.bank_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "notifications_all" ON public.notifications FOR ALL TO authenticated USING (true);
CREATE POLICY "consultations_all" ON public.consultations FOR ALL TO authenticated USING (true);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER approvals_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
