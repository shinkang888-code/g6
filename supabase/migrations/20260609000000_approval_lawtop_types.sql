-- LawTop GL 전자결재 문서 유형 확장 (기안서·지급품의서·근태행선지)

ALTER TABLE public.approvals DROP CONSTRAINT IF EXISTS approvals_doc_type_check;

ALTER TABLE public.approvals
  ADD CONSTRAINT approvals_doc_type_check
  CHECK (doc_type IN (
    '기안서', '지급품의서', '근태행선지',
    '청구서', '보고서', '위임장', '계약서', '기타'
  ));

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.approvals.metadata IS '유형별 추가 필드 (지급목적, 행선지, 기간 등)';
