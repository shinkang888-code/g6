-- Phase 0: 회계/수납 — 테넌트 격리 및 테이블 보강

-- 사건 테이블: management_number 컬럼 보강 (기존 management_key 호환)
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS management_number TEXT;
UPDATE public.cases
SET management_number = COALESCE(NULLIF(trim(management_key), ''), '00000')
WHERE management_number IS NULL OR trim(management_number) = '';

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
  management_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,
  depositor_name TEXT NOT NULL,
  amount NUMERIC(15,0) NOT NULL,
  bank_name TEXT,
  memo TEXT,
  matched_finance_id UUID,
  management_number TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS management_number TEXT;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS bank_transaction_id UUID;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS management_number TEXT;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_transactions_matched_finance_id_fkey'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT bank_transactions_matched_finance_id_fkey
      FOREIGN KEY (matched_finance_id) REFERENCES public.finance_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cases_management_number ON public.cases(management_number);
CREATE INDEX IF NOT EXISTS idx_finance_entries_case_id ON public.finance_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_status ON public.finance_entries(status);
CREATE INDEX IF NOT EXISTS idx_finance_entries_management_number ON public.finance_entries(management_number);
CREATE INDEX IF NOT EXISTS idx_finance_entries_open_receivable
  ON public.finance_entries(management_number, status)
  WHERE entry_type = '미수금' AND status IN ('미확인', '확인');

CREATE INDEX IF NOT EXISTS idx_bank_transactions_matched ON public.bank_transactions(matched_finance_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_management_number ON public.bank_transactions(management_number);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_unmatched
  ON public.bank_transactions(management_number)
  WHERE matched_finance_id IS NULL;

-- 기존 행: 사건 management_number 또는 기본값으로 백필
UPDATE public.finance_entries fe
SET management_number = COALESCE(NULLIF(trim(c.management_number), ''), '00000')
FROM public.cases c
WHERE fe.case_id = c.id
  AND (fe.management_number IS NULL OR trim(fe.management_number) = '');

UPDATE public.finance_entries
SET management_number = '00000'
WHERE management_number IS NULL OR trim(management_number) = '';

UPDATE public.bank_transactions
SET management_number = '00000'
WHERE management_number IS NULL OR trim(management_number) = '';

COMMENT ON TABLE public.finance_entries IS '청구·미수·수납 확정 건 (LawTop 청구/미수)';
COMMENT ON TABLE public.bank_transactions IS '통장 입금 내역 (LawTop 입금관리)';
