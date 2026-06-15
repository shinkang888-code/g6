-- Phase 2: 연동 계좌 (수동 등록 · 다계좌 UI 기반)

CREATE TABLE IF NOT EXISTS public.linked_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_code TEXT,
  bank_name TEXT NOT NULL,
  account_number_masked TEXT NOT NULL,
  account_holder TEXT,
  display_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'openbanking', 'toss_virtual', 'csv_import')),
  balance NUMERIC(15,0),
  management_number TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS linked_account_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_transactions_linked_account_id_fkey'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT bank_transactions_linked_account_id_fkey
      FOREIGN KEY (linked_account_id) REFERENCES public.linked_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_linked_accounts_management_number ON public.linked_accounts(management_number);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_linked_account ON public.bank_transactions(linked_account_id);

COMMENT ON TABLE public.linked_accounts IS '연동 계좌 (수동·오픈뱅킹·가상계좌)';
