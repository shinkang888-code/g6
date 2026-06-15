-- 사건 다중 수임(동일 사건번호 + 여러 의뢰인) 지원을 위해
-- case_number 컬럼의 UNIQUE 제약을 제거한다.

ALTER TABLE IF EXISTS public.cases
  DROP CONSTRAINT IF EXISTS cases_case_number_key;

