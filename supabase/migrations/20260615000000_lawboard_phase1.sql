-- LawBoard Phase 1: 상담 확장, 상담실, 게시판 메타, 공지 첨부

-- 상담 확장 (UI ConsultationItem 필드는 meta JSONB에 저장)
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS management_number TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_consultations_date ON public.consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_mgmt ON public.consultations(management_number);

-- 상담실
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

-- 게시판 메타 (localStorage boardStorage 대체)
CREATE TABLE IF NOT EXISTS public.site_boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  board_type TEXT NOT NULL DEFAULT 'general',
  sort_order INT NOT NULL DEFAULT 0,
  management_number TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_boards_sort ON public.site_boards(sort_order);

-- 공지 첨부 (base64 → JSON 배열)
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON TABLE public.consultation_rooms IS 'LawBoard Phase1 — 상담실';
COMMENT ON TABLE public.site_boards IS 'LawBoard Phase1 — 커스텀 게시판 메타';
COMMENT ON COLUMN public.consultations.meta IS 'startTime, endTime, roomId, consultants, status 등';
