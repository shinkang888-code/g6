-- LawTop GL 고객관리(guestlist) 확장: soft delete, 고유번호, 연락처 분리, 주민/사업자

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_mobile TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS biz_number TEXT;

COMMENT ON COLUMN public.clients.deleted_at IS '소프트 삭제 (LawTop 고객 비활성)';
COMMENT ON COLUMN public.clients.contact_mobile IS '이동전화 (guestlist 이동전화)';
COMMENT ON COLUMN public.clients.contact_phone IS '유선전화 (guestlist 전화)';

CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
