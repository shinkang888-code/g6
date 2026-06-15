-- 고객(의뢰인) 테이블에 guestlist.xls 양식 반영용 컬럼 추가
-- 주소, 고유번호(guest_code) - 엑셀 업로드/연동 시 사용

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS guest_code TEXT;

COMMENT ON COLUMN public.clients.address IS '주소 (guestlist 주소 컬럼)';
COMMENT ON COLUMN public.clients.guest_code IS '고객 고유번호 (guestlist 고유번호, 예: C202603090030)';

CREATE INDEX IF NOT EXISTS idx_clients_guest_code ON public.clients(guest_code) WHERE guest_code IS NOT NULL;
