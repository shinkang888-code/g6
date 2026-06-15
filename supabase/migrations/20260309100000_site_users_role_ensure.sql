-- site_users.role 컬럼이 없으면 추가 (권한: 관리자, 변호사, 직원 등)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.site_users ADD COLUMN role TEXT;
    COMMENT ON COLUMN public.site_users.role IS '권한 (관리자, 임원, 변호사, 사무장, 국장, 직원, 사무원, 인턴)';
  END IF;
END $$;
