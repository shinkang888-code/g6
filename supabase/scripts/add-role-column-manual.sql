-- site_users 테이블에 role(권한) 컬럼 추가
-- Supabase 대시보드 → SQL Editor에서 이 스크립트를 붙여넣고 실행하세요.
-- 이미 role 컬럼이 있으면 아무 작업도 하지 않습니다.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.site_users ADD COLUMN role TEXT;
    COMMENT ON COLUMN public.site_users.role IS '권한 (관리자, 임원, 변호사, 사무장, 국장, 직원, 사무원, 인턴)';
    RAISE NOTICE 'site_users.role 컬럼이 추가되었습니다.';
  ELSE
    RAISE NOTICE 'site_users.role 컬럼이 이미 존재합니다.';
  END IF;
END $$;
