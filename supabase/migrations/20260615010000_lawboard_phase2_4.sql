-- LawBoard Phase 2-4: consultations, rooms, notices attachments, mail_messages
-- Applied to remote via Supabase MCP (tvyktmwubzsfyfayhark)

CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_date DATE NOT NULL,
  consultation_time TIME,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  consultation_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_staff TEXT,
  notes TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  management_number TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_date ON public.consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_mgmt ON public.consultations(management_number);

CREATE TABLE IF NOT EXISTS public.consultation_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  remarks TEXT,
  management_number TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_rooms_sort ON public.consultation_rooms(sort_order);

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.mail_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('draft', 'sent', 'received', 'failed')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  management_number TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_messages_mgmt ON public.mail_messages(management_number);
CREATE INDEX IF NOT EXISTS idx_mail_messages_status ON public.mail_messages(status);
CREATE INDEX IF NOT EXISTS idx_mail_messages_received ON public.mail_messages(received_at DESC);

COMMENT ON TABLE public.consultations IS 'LawBoard — 상담 일정';
COMMENT ON TABLE public.consultation_rooms IS 'LawBoard — 상담실';
COMMENT ON TABLE public.mail_messages IS 'LawBoard Phase3 — LawTopMail 대체';
