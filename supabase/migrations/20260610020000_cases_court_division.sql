-- 법원사건연동 재판부·기관연락처 (메모 3행용)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS court_division TEXT;

COMMENT ON COLUMN public.cases.court_division IS '재판부 및 기관연락처 (예: 제 3 형사부(나) (전화:031-828-0421 (...)))';
