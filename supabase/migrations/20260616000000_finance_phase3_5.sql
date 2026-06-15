-- Phase 3~5: 청구항목·반복청구·통계·세금·결재 연동

CREATE TABLE IF NOT EXISTS public.billing_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  management_number TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  default_amount NUMERIC(15,0),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_day INT CHECK (recurring_day IS NULL OR (recurring_day >= 1 AND recurring_day <= 28)),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (management_number, name)
);

CREATE TABLE IF NOT EXISTS public.billing_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  billing_item_id UUID REFERENCES public.billing_items(id) ON DELETE SET NULL,
  amount NUMERIC(15,0) NOT NULL,
  interval_months INT NOT NULL DEFAULT 1 CHECK (interval_months >= 1 AND interval_months <= 12),
  next_bill_date DATE NOT NULL,
  description TEXT,
  management_number TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  management_number TEXT NOT NULL,
  finance_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('세금계산서', '현금영수증')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  amount NUMERIC(15,0) NOT NULL,
  client_name TEXT,
  issued_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS billing_item_id UUID;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS finance_entry_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_entries_billing_item_id_fkey'
  ) THEN
    ALTER TABLE public.finance_entries
      ADD CONSTRAINT finance_entries_billing_item_id_fkey
      FOREIGN KEY (billing_item_id) REFERENCES public.billing_items(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'approvals_finance_entry_id_fkey'
  ) THEN
    ALTER TABLE public.approvals
      ADD CONSTRAINT approvals_finance_entry_id_fkey
      FOREIGN KEY (finance_entry_id) REFERENCES public.finance_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_billing_items_management ON public.billing_items(management_number);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_case ON public.billing_schedules(case_id);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_next ON public.billing_schedules(management_number, next_bill_date) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_tax_documents_management ON public.tax_documents(management_number);
CREATE INDEX IF NOT EXISTS idx_approvals_finance_entry ON public.approvals(finance_entry_id);

COMMENT ON TABLE public.billing_items IS '청구항목 마스터 (착수금·성보 등)';
COMMENT ON TABLE public.billing_schedules IS '사건별 반복 청구 스케줄';
COMMENT ON TABLE public.tax_documents IS '세금계산서·현금영수증 발행 이력';
